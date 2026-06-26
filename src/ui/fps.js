/**
 * Rolling frames-per-second meter.
 *
 * Call `tick(now)` once per rendered frame (passing the same high-res timestamp
 * used by the render loop). Read `value` for a smoothed, rounded FPS estimate.
 */
export class FpsMeter {
  constructor(smoothing = 0.9) {
    this.smoothing = smoothing
    this._last = 0
    this._avgDelta = 1000 / 60
    this.value = 60
  }

  tick(now) {
    if (this._last !== 0) {
      const delta = now - this._last
      // Exponential moving average of frame delta -> stable readout.
      this._avgDelta =
        this.smoothing * this._avgDelta + (1 - this.smoothing) * delta
      this.value = Math.round(1000 / this._avgDelta)
    }
    this._last = now
  }
}
