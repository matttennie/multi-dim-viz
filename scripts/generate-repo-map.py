#!/usr/bin/env python3
"""Generate `.repo-map` — a structural summary of this codebase.

Pure-Python heuristic extraction (no third-party dependencies):

  - exports are found by regex over `export` declarations;
  - an import graph is built by resolving relative imports;
  - files are ranked by PageRank over that graph.

Run from the repo root:  python3 scripts/generate-repo-map.py
Regenerate after structural changes (new files, renamed exports).
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ["src", "scripts", "tests"]
SKIP_PARTS = {"node_modules", "dist", ".git"}
SOURCE_SUFFIXES = {".js"}

# `export function foo` / `export const foo` / `export class Foo` / etc.
EXPORT_DECL = re.compile(
    r"^export\s+(?:default\s+)?(?:async\s+)?"
    r"(function|const|let|class)\s+([A-Za-z0-9_$]+)",
    re.MULTILINE,
)
# `export { a, b as c }` re-exports.
EXPORT_NAMED = re.compile(r"^export\s*\{([^}]*)\}", re.MULTILINE)
# Any import/re-export specifier string.
IMPORT_FROM = re.compile(r"""(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]""")


def iter_source_files() -> list[Path]:
    files: list[Path] = []
    for scan in SCAN_DIRS:
        base = REPO_ROOT / scan
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.suffix not in SOURCE_SUFFIXES:
                continue
            if any(part in SKIP_PARTS for part in path.relative_to(REPO_ROOT).parts):
                continue
            files.append(path)
    return sorted(files)


def extract_exports(text: str) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for _kind, name in EXPORT_DECL.findall(text):
        if name not in seen:
            seen.add(name)
            names.append(name)
    for block in EXPORT_NAMED.findall(text):
        for piece in block.split(","):
            token = piece.strip()
            if " as " in token:
                token = token.split(" as ")[-1].strip()
            if token and token != "default" and token not in seen and re.fullmatch(r"[A-Za-z0-9_$]+", token):
                seen.add(token)
                names.append(token)
    return names


def resolve_import(spec: str, from_file: Path, files: set[Path]) -> Path | None:
    """Resolve a relative import specifier to a file in our set, or None."""
    if not spec.startswith("."):
        return None  # bare external package (e.g. three)
    base = (from_file.parent / spec).resolve()
    for cand in (base, base.with_suffix(".js"), base / "index.js"):
        if cand in files:
            return cand
    return None


def pagerank(edges: dict[Path, set[Path]], nodes: list[Path], damping: float = 0.85, iterations: int = 40) -> dict[Path, float]:
    n = len(nodes)
    if n == 0:
        return {}
    rank = {node: 1.0 / n for node in nodes}
    incoming: dict[Path, list[Path]] = {node: [] for node in nodes}
    out_degree: dict[Path, int] = {node: len(edges.get(node, ())) for node in nodes}
    for src, dsts in edges.items():
        for dst in dsts:
            if dst in incoming:
                incoming[dst].append(src)
    for _ in range(iterations):
        dangling = sum(rank[node] for node in nodes if out_degree[node] == 0)
        new_rank: dict[Path, float] = {}
        for node in nodes:
            inbound = sum(rank[src] / out_degree[src] for src in incoming[node] if out_degree[src] > 0)
            new_rank[node] = (1 - damping) / n + damping * (inbound + dangling / n)
        rank = new_rank
    return rank


def main() -> None:
    files = iter_source_files()
    file_set = set(files)

    exports: dict[Path, list[str]] = {}
    edges: dict[Path, set[Path]] = {}
    texts: dict[Path, str] = {}
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        texts[path] = text
        exports[path] = extract_exports(text)
        targets: set[Path] = set()
        for spec in set(IMPORT_FROM.findall(text)):
            resolved = resolve_import(spec, path, file_set)
            if resolved and resolved != path:
                targets.add(resolved)
        edges[path] = targets

    rank = pagerank(edges, files)
    in_degree: dict[Path, int] = {f: 0 for f in files}
    for dsts in edges.values():
        for dst in dsts:
            if dst in in_degree:
                in_degree[dst] += 1

    rel = lambda p: str(p.relative_to(REPO_ROOT))
    loc = lambda p: texts[p].count("\n") + 1

    out: list[str] = []
    out.append("# .repo-map — multi-dim-viz")
    out.append("")
    out.append("Auto-generated structural summary. Regenerate with:")
    out.append("    python3 scripts/generate-repo-map.py")
    out.append("")
    out.append(
        f"Heuristic extraction (regex exports + import-graph PageRank). "
        f"{len(files)} source files across {SCAN_DIRS}."
    )
    out.append("")
    out.append("## Most-depended-on files (PageRank · inbound imports)")
    out.append("")
    ranked = sorted(files, key=lambda p: (-rank.get(p, 0.0), -in_degree[p], rel(p)))
    for path in ranked[:10]:
        names = exports[path]
        head = ", ".join(names[:6]) + ("…" if len(names) > 6 else "")
        out.append(f"- `{rel(path)}`  (in:{in_degree[path]})  — {head}")
    out.append("")
    out.append("## Structure by directory")
    out.append("")

    by_area: dict[str, list[Path]] = {}
    for path in files:
        by_area.setdefault(str(path.relative_to(REPO_ROOT).parent), []).append(path)

    def area_rank(area: str) -> float:
        return max((rank.get(p, 0.0) for p in by_area[area]), default=0.0)

    for area in sorted(by_area, key=lambda a: (-area_rank(a), a)):
        out.append(f"### {area}/")
        for path in sorted(by_area[area], key=lambda p: (-rank.get(p, 0.0), rel(p))):
            names = exports[path]
            shown = ", ".join(names[:8]) + ("…" if len(names) > 8 else "")
            line = f"- {path.name}  ({loc(path)} loc)"
            if shown:
                line += f": {shown}"
            out.append(line)
        out.append("")

    target = REPO_ROOT / ".repo-map"
    target.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")
    print(f"Wrote {rel(target)} — {len(files)} files, {sum(len(v) for v in exports.values())} exports.")


if __name__ == "__main__":
    main()
