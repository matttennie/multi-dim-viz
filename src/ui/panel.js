/**
 * Builds the top-right control panel and wires it to callbacks.
 *
 * createPanel(options) -> {
 *   el,                 // the root HTMLElement to append into #ui
 *   setFps(value),      // update the FPS readout
 * }
 *
 * options = {
 *   shapes:  Array<{ value, label, usesSides }>,
 *   state:   shared state object (read for initial values),
 *   limits:  { DIM_MIN, DIM_MAX, SIDES_MIN, SIDES_MAX },
 *   onShape(value), onDim(value), onSides(value),
 *   onMode('lines'|'planes'), onProjection('perspective'|'orthographic'),
 *   onRotateToggle(boolean),
 * }
 */
export function createPanel(options) {
  const { shapes, state, limits, onShape, onDim, onSides, onMode, onProjection, onRotateToggle } =
    options

  const el = document.createElement('div')
  el.className = 'panel'

  // --- Top row: mode toggle + FPS ------------------------------------------
  const top = document.createElement('div')
  top.className = 'panel__top'

  const seg = document.createElement('div')
  seg.className = 'seg'
  const linesBtn = makeSegBtn('Lines', state.mode === 'lines')
  const planesBtn = makeSegBtn('Planes', state.mode === 'planes')
  seg.append(linesBtn, planesBtn)

  const setModeButtons = (mode) => {
    linesBtn.classList.toggle('seg__btn--active', mode === 'lines')
    planesBtn.classList.toggle('seg__btn--active', mode === 'planes')
  }
  linesBtn.addEventListener('click', () => {
    setModeButtons('lines')
    onMode('lines')
  })
  planesBtn.addEventListener('click', () => {
    setModeButtons('planes')
    onMode('planes')
  })

  const fps = document.createElement('div')
  fps.className = 'fps'
  const fpsValue = document.createElement('span')
  fpsValue.className = 'fps__value'
  fpsValue.textContent = '60'
  fps.append('FPS ', fpsValue)

  top.append(seg, fps)
  el.append(top)
  el.append(divider())

  // Each shape's valid parameter ranges (read from the SHAPES entries, with the
  // global limits as a fallback).
  const limitsForType = (type) => {
    const s = shapes.find((x) => x.value === type) || shapes[0]
    return {
      usesSides: s.usesSides,
      dimMin: s.dimMin ?? limits.DIM_MIN,
      dimMax: s.dimMax ?? limits.DIM_MAX,
      sidesMin: s.sidesMin ?? limits.SIDES_MIN,
      sidesMax: s.sidesMax ?? limits.SIDES_MAX,
    }
  }
  const initLim = limitsForType(state.type)

  // --- Shape dropdown (custom; menu renders inside the page) ----------------
  const dropdown = makeDropdown({
    options: shapes,
    value: state.type,
    // main.js clamps state into the new shape's range and calls syncShape().
    onChange: (value) => onShape(value),
  })
  const shapeRow = document.createElement('div')
  shapeRow.className = 'panel__row'
  // Stack the label above the full-width dropdown.
  shapeRow.style.flexDirection = 'column'
  shapeRow.style.alignItems = 'stretch'
  shapeRow.style.gap = '6px'
  shapeRow.append(label('Shape'), dropdown.el)
  el.append(shapeRow)

  // --- Dimensions stepper --------------------------------------------------
  const dimStepper = makeStepper({
    initial: state.dim,
    min: initLim.dimMin,
    max: initLim.dimMax,
    onChange: onDim,
  })
  el.append(row('Dimensions', dimStepper.el))

  // --- Sides stepper -------------------------------------------------------
  const sidesStepper = makeStepper({
    initial: state.sides,
    min: initLim.sidesMin,
    max: initLim.sidesMax,
    onChange: onSides,
  })
  const sidesRow = row('Sides', sidesStepper.el)
  el.append(sidesRow)

  // Reflect a shape's parameter ranges in the controls. Called by main.js right
  // after it clamps state into the newly selected shape's range.
  function syncShape(type, dim, sides) {
    const lim = limitsForType(type)
    dimStepper.setRange(lim.dimMin, lim.dimMax)
    dimStepper.setValue(dim)
    sidesStepper.setRange(lim.sidesMin, lim.sidesMax)
    sidesStepper.setValue(sides)
    sidesRow.classList.toggle('panel__row--disabled', !lim.usesSides)
  }
  sidesRow.classList.toggle('panel__row--disabled', !initLim.usesSides)

  el.append(divider())

  // --- Rotate toggle -------------------------------------------------------
  const rotateSwitch = makeSwitch(state.rotating, onRotateToggle)
  el.append(row('Rotate', rotateSwitch))

  // --- Projection toggle (perspective <-> orthographic) --------------------
  const projWrap = document.createElement('div')
  projWrap.className = 'seg'
  const perspBtn = makeSegBtn('Persp', state.projection === 'perspective')
  const orthoBtn = makeSegBtn('Ortho', state.projection === 'orthographic')
  projWrap.append(perspBtn, orthoBtn)
  const setProjButtons = (p) => {
    perspBtn.classList.toggle('seg__btn--active', p === 'perspective')
    orthoBtn.classList.toggle('seg__btn--active', p === 'orthographic')
  }
  perspBtn.addEventListener('click', () => {
    setProjButtons('perspective')
    onProjection('perspective')
  })
  orthoBtn.addEventListener('click', () => {
    setProjButtons('orthographic')
    onProjection('orthographic')
  })
  el.append(row('Projection', projWrap))

  const hint = document.createElement('div')
  hint.className = 'hint'
  hint.textContent = 'Drag to rotate · scroll/pinch to zoom'
  el.append(hint)

  return {
    el,
    setFps(value) {
      fpsValue.textContent = String(value)
    },
    syncShape,
  }
}

// ---------------------------------------------------------------------------
// Small DOM helpers
// ---------------------------------------------------------------------------
function makeSegBtn(text, active) {
  const b = document.createElement('button')
  b.className = 'seg__btn' + (active ? ' seg__btn--active' : '')
  b.textContent = text
  b.type = 'button'
  return b
}

function label(text) {
  const l = document.createElement('span')
  l.className = 'panel__label'
  l.textContent = text
  return l
}

function row(labelText, control) {
  const r = document.createElement('div')
  r.className = 'panel__row'
  r.append(label(labelText), control)
  return r
}

function divider() {
  const d = document.createElement('div')
  d.className = 'panel__divider'
  return d
}

function makeStepper({ initial, min, max, onChange }) {
  const wrap = document.createElement('div')
  wrap.className = 'stepper'

  const minus = document.createElement('button')
  minus.className = 'stepper__btn'
  minus.type = 'button'
  minus.textContent = '−' // minus sign

  const input = document.createElement('input')
  input.className = 'stepper__input'
  input.type = 'number'
  input.min = String(min)
  input.max = String(max)
  input.value = String(initial)

  const plus = document.createElement('button')
  plus.className = 'stepper__btn'
  plus.type = 'button'
  plus.textContent = '+'

  let value = initial
  let curMin = min
  let curMax = max

  const clamp = (v) => Math.max(curMin, Math.min(curMax, v))
  const refresh = () => {
    input.value = String(value)
    minus.disabled = value <= curMin
    plus.disabled = value >= curMax
  }
  // User-initiated change: clamp, reflect, and notify.
  const apply = (v) => {
    if (Number.isNaN(v)) {
      refresh()
      return
    }
    value = clamp(v)
    refresh()
    onChange(value)
  }
  // External sync: reflect a value WITHOUT notifying (avoids rebuild loops).
  const setValue = (v) => {
    value = clamp(v)
    refresh()
  }
  // Update the allowed range (e.g. when the selected shape changes) and re-clamp.
  const setRange = (mn, mx) => {
    curMin = mn
    curMax = mx
    input.min = String(mn)
    input.max = String(mx)
    value = clamp(value)
    refresh()
  }

  minus.addEventListener('click', () => apply(value - 1))
  plus.addEventListener('click', () => apply(value + 1))
  input.addEventListener('change', () => apply(parseInt(input.value, 10)))

  refresh()
  wrap.append(minus, input, plus)
  return { el: wrap, setRange, setValue }
}

function makeSwitch(initial, onChange) {
  const labelEl = document.createElement('label')
  labelEl.className = 'switch'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = initial
  const track = document.createElement('span')
  track.className = 'switch__track'
  const thumb = document.createElement('span')
  thumb.className = 'switch__thumb'
  track.append(thumb)
  labelEl.append(input, track)
  input.addEventListener('change', () => onChange(input.checked))
  return labelEl
}

/**
 * A classic dropdown whose menu is plain DOM positioned within the page (not a
 * native OS popup), so it always renders inside the browser window.
 *   options : Array<{ value, label }>
 *   value   : initial selected value
 *   onChange(value)
 */
function makeDropdown({ options, value, onChange }) {
  const root = document.createElement('div')
  root.className = 'dropdown'

  const field = document.createElement('button')
  field.type = 'button'
  field.className = 'dropdown__field'
  const fieldText = document.createElement('span')
  fieldText.className = 'dropdown__text'
  const caret = document.createElement('span')
  caret.className = 'dropdown__caret'
  caret.textContent = '▾'
  field.append(fieldText, caret)

  const menu = document.createElement('div')
  menu.className = 'dropdown__menu'

  let current = value
  const labelFor = (v) => {
    const o = options.find((opt) => opt.value === v)
    return o ? o.label : ''
  }
  fieldText.textContent = labelFor(current)

  const optionEls = options.map((o) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className =
      'dropdown__option' + (o.value === current ? ' dropdown__option--active' : '')
    item.textContent = o.label
    item.dataset.value = o.value
    item.addEventListener('click', () => {
      choose(o.value)
      close()
      field.focus()
    })
    menu.append(item)
    return item
  })

  root.append(field, menu)

  let open = false
  const openMenu = () => {
    open = true
    root.classList.add('dropdown--open')
    document.addEventListener('pointerdown', onOutside, true)
    document.addEventListener('keydown', onKey)
  }
  const close = () => {
    open = false
    root.classList.remove('dropdown--open')
    document.removeEventListener('pointerdown', onOutside, true)
    document.removeEventListener('keydown', onKey)
  }
  const onOutside = (e) => {
    if (!root.contains(e.target)) close()
  }
  const onKey = (e) => {
    if (e.key === 'Escape') {
      close()
      field.focus()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const i = options.findIndex((o) => o.value === current)
      const next =
        e.key === 'ArrowDown'
          ? Math.min(options.length - 1, i + 1)
          : Math.max(0, i - 1)
      choose(options[next].value)
      optionEls[next].focus()
    }
  }
  const choose = (v) => {
    current = v
    fieldText.textContent = labelFor(v)
    optionEls.forEach((elx) =>
      elx.classList.toggle('dropdown__option--active', elx.dataset.value === v),
    )
    onChange(v)
  }

  field.addEventListener('click', () => (open ? close() : openMenu()))

  return { el: root, getValue: () => current, setValue: choose }
}
