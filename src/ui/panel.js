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
 *   onShape(value), onDim(value), onSides(value),
 *   onMode('lines'|'planes'), onProjection('perspective'|'orthographic'),
 *   onRotateToggle(boolean), onShapeChangeToggle(boolean),
 * }
 */
import { shapeLimits } from '../geometry/shapes.js'

export function createPanel(options) {
  const {
    shapes,
    state,
    onShape,
    onDim,
    onSides,
    onMode,
    onProjection,
    onRotateToggle,
    onShapeChangeToggle,
  } = options

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
    linesBtn.setAttribute('aria-pressed', String(mode === 'lines'))
    planesBtn.setAttribute('aria-pressed', String(mode === 'planes'))
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

  const initLim = shapeLimits(state.type)

  // --- Shape dropdown (custom; menu renders inside the page) ----------------
  const dropdown = makeDropdown({
    options: shapes,
    value: state.type,
    label: 'Shape',
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
    label: 'Dimensions',
    initial: state.dim,
    min: initLim.dimMin,
    max: initLim.dimMax,
    onChange: onDim,
  })
  const dimRow = row('Dimensions', dimStepper.el)
  el.append(dimRow)

  // --- Sides stepper -------------------------------------------------------
  const sidesStepper = makeStepper({
    label: 'Sides',
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
    const lim = shapeLimits(type)
    dimStepper.setRange(lim.dimMin, lim.dimMax)
    dimStepper.setValue(dim)
    dimStepper.setDisabled(lim.dimMin === lim.dimMax)
    dimRow.classList.toggle('panel__row--disabled', lim.dimMin === lim.dimMax)
    sidesStepper.setRange(lim.sidesMin, lim.sidesMax)
    sidesStepper.setValue(sides)
    sidesStepper.setDisabled(!lim.usesSides)
    sidesRow.classList.toggle('panel__row--disabled', !lim.usesSides)
  }
  dimStepper.setDisabled(initLim.dimMin === initLim.dimMax)
  dimRow.classList.toggle(
    'panel__row--disabled',
    initLim.dimMin === initLim.dimMax,
  )
  sidesStepper.setDisabled(!initLim.usesSides)
  sidesRow.classList.toggle('panel__row--disabled', !initLim.usesSides)

  el.append(divider())

  // --- Rotate toggle -------------------------------------------------------
  const rotateSwitch = makeSwitch(state.spaceRotating, 'Rotate', onRotateToggle)
  el.append(row('Rotate', rotateSwitch.el))

  const shapeChangeSwitch = makeSwitch(
    state.shapeChanging,
    'Shape Change',
    onShapeChangeToggle,
  )
  const shapeChangeRow = row('Shape Change', shapeChangeSwitch.el)
  el.append(shapeChangeRow)

  // --- Projection toggle (perspective <-> orthographic) --------------------
  const projWrap = document.createElement('div')
  projWrap.className = 'seg'
  const perspBtn = makeSegBtn('Persp', state.projection === 'perspective')
  const orthoBtn = makeSegBtn('Ortho', state.projection === 'orthographic')
  projWrap.append(perspBtn, orthoBtn)
  const setProjButtons = (p) => {
    perspBtn.classList.toggle('seg__btn--active', p === 'perspective')
    orthoBtn.classList.toggle('seg__btn--active', p === 'orthographic')
    perspBtn.setAttribute('aria-pressed', String(p === 'perspective'))
    orthoBtn.setAttribute('aria-pressed', String(p === 'orthographic'))
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
    setRotate(value) {
      rotateSwitch.setChecked(value)
    },
    setShapeChange(value) {
      shapeChangeSwitch.setChecked(value)
    },
    // Shape Change only has meaning above 3 dimensions; main.js disables it
    // (without clearing the underlying state) whenever nothing is hidden.
    setShapeChangeEnabled(on) {
      shapeChangeSwitch.setDisabled(!on)
      shapeChangeRow.classList.toggle('panel__row--disabled', !on)
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
  b.setAttribute('aria-pressed', String(active))
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

function makeStepper({ label, initial, min, max, onChange }) {
  const wrap = document.createElement('div')
  wrap.className = 'stepper'
  wrap.setAttribute('role', 'group')
  wrap.setAttribute('aria-label', label)

  const minus = document.createElement('button')
  minus.className = 'stepper__btn'
  minus.type = 'button'
  minus.textContent = '−' // minus sign
  minus.setAttribute('aria-label', `Decrease ${label}`)

  const input = document.createElement('input')
  input.className = 'stepper__input'
  input.type = 'number'
  input.setAttribute('aria-label', label)
  input.min = String(min)
  input.max = String(max)
  input.value = String(initial)

  const plus = document.createElement('button')
  plus.className = 'stepper__btn'
  plus.type = 'button'
  plus.textContent = '+'
  plus.setAttribute('aria-label', `Increase ${label}`)

  let value = initial
  let curMin = min
  let curMax = max
  let disabled = false

  const clamp = (v) => Math.max(curMin, Math.min(curMax, v))
  const refresh = () => {
    input.value = String(value)
    input.disabled = disabled
    minus.disabled = disabled || value <= curMin
    plus.disabled = disabled || value >= curMax
    wrap.setAttribute('aria-disabled', String(disabled))
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
  const setDisabled = (on) => {
    disabled = on
    refresh()
  }

  minus.addEventListener('click', () => apply(value - 1))
  plus.addEventListener('click', () => apply(value + 1))
  input.addEventListener('focus', () => input.select())
  input.addEventListener('mouseup', (event) => {
    // Keep the whole number highlighted after a mouse click instead of placing
    // the caret at the clicked character.
    event.preventDefault()
  })
  input.addEventListener('change', () => apply(parseInt(input.value, 10)))

  refresh()
  wrap.append(minus, input, plus)
  return { el: wrap, setRange, setValue, setDisabled }
}

function makeSwitch(initial, label, onChange) {
  const labelEl = document.createElement('label')
  labelEl.className = 'switch'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = initial
  input.setAttribute('aria-label', label)
  const track = document.createElement('span')
  track.className = 'switch__track'
  const thumb = document.createElement('span')
  thumb.className = 'switch__thumb'
  track.append(thumb)
  labelEl.append(input, track)
  input.addEventListener('change', () => onChange(input.checked))
  return {
    el: labelEl,
    setChecked(value) {
      input.checked = value
    },
    setDisabled(value) {
      input.disabled = value
    },
  }
}

/**
 * A classic dropdown whose menu is plain DOM positioned within the page (not a
 * native OS popup), so it always renders inside the browser window.
 *   options : Array<{ value, label }>
 *   value   : initial selected value
 *   onChange(value)
 */
let dropdownId = 0

function makeDropdown({ options, value, label, onChange }) {
  dropdownId += 1
  const menuId = `shape-dropdown-${dropdownId}`
  const root = document.createElement('div')
  root.className = 'dropdown'

  const field = document.createElement('button')
  field.type = 'button'
  field.className = 'dropdown__field'
  field.setAttribute('role', 'combobox')
  field.setAttribute('aria-label', label)
  field.setAttribute('aria-haspopup', 'listbox')
  field.setAttribute('aria-expanded', 'false')
  field.setAttribute('aria-controls', menuId)
  const fieldText = document.createElement('span')
  fieldText.className = 'dropdown__text'
  const caret = document.createElement('span')
  caret.className = 'dropdown__caret'
  caret.textContent = '▾'
  field.append(fieldText, caret)

  const menu = document.createElement('div')
  menu.className = 'dropdown__menu'
  menu.id = menuId
  menu.setAttribute('role', 'listbox')
  menu.setAttribute('aria-label', label)

  let current = value
  const labelFor = (v) => {
    const o = options.find((opt) => opt.value === v)
    return o ? o.label : ''
  }
  fieldText.textContent = labelFor(current)

  const optionEls = options.map((o) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.id = `${menuId}-${o.value}`
    item.className =
      'dropdown__option' +
      (o.value === current ? ' dropdown__option--active' : '')
    item.textContent = o.label
    item.dataset.value = o.value
    item.setAttribute('role', 'option')
    item.setAttribute('aria-selected', String(o.value === current))
    item.addEventListener('click', () => {
      choose(o.value)
      close()
      field.focus()
    })
    menu.append(item)
    return item
  })
  const initialActive = optionEls.find((item) => item.dataset.value === current)
  if (initialActive)
    field.setAttribute('aria-activedescendant', initialActive.id)

  root.append(field, menu)

  let open = false
  const openMenu = () => {
    open = true
    root.classList.add('dropdown--open')
    field.setAttribute('aria-expanded', 'true')
    document.addEventListener('pointerdown', onOutside, true)
    document.addEventListener('keydown', onKey)
  }
  const close = () => {
    open = false
    root.classList.remove('dropdown--open')
    field.setAttribute('aria-expanded', 'false')
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
    optionEls.forEach((elx) => {
      const selected = elx.dataset.value === v
      elx.classList.toggle('dropdown__option--active', selected)
      elx.setAttribute('aria-selected', String(selected))
      if (selected) field.setAttribute('aria-activedescendant', elx.id)
    })
    onChange(v)
  }

  field.addEventListener('click', () => (open ? close() : openMenu()))
  field.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
      e.preventDefault()
      openMenu()
    }
  })

  return { el: root }
}
