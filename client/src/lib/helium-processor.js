/**
 * helium-processor.js — AudioWorklet OLA pitch shifter
 *
 * Reads from the input circular buffer at `pitch` × real-time speed.
 * When the read-head gets too close to the write-head we jump it back
 * by one grain and crossfade to remove the click. Result: same timing,
 * higher pitch → classic helium balloon voice.
 *
 * pitch > 1  →  higher pitch  (1.4 ≈ +6 semitones, natural helium)
 * pitch < 1  →  lower pitch
 */

const BUF   = 8192   // circular buffer length (must be power-of-two)
const MASK  = BUF - 1
const GRAIN = 1536   // larger grain for smoother jumps
const FADE  = 384    // longer crossfade for cleaner audio

class HeliumProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors () {
    return [{
      name: 'pitch',
      defaultValue: 1.4,
      minValue: 0.5,
      maxValue: 2.5,
      automationRate: 'k-rate',
    }]
  }

  constructor () {
    super()
    this._buf    = new Float32Array(BUF)
    this._wp     = 0      // write pointer  (integer)
    this._rp     = 0.0   // primary read pointer (float – sub-sample interp)
    this._rp2    = 0.0   // secondary read pointer during crossfade
    this._fading = false
    this._fadeI  = 0

    // Pre-bake a Hann window for smooth crossfades
    this._win = new Float32Array(FADE)
    for (let i = 0; i < FADE; i++) {
      this._win[i] = 0.5 * (1 - Math.cos(Math.PI * i / (FADE - 1)))
    }
  }

  /** Linear-interpolated read from the circular buffer */
  _lerp (pos) {
    const i = pos | 0
    const f = pos - i
    return this._buf[i & MASK] * (1 - f) + this._buf[(i + 1) & MASK] * f
  }

  process (inputs, outputs, parameters) {
    const inp = inputs[0]?.[0]
    const out = outputs[0]?.[0]
    if (!inp || !out) return true

    const pitch = parameters.pitch[0]

    for (let i = 0; i < inp.length; i++) {
      // 1. Write current input sample into circular buffer
      this._buf[this._wp & MASK] = inp[i]
      this._wp++

      // 2. How far behind the write head is our read head?
      const lag = this._wp - this._rp

      // 3. If the read head is about to overtake the write head,
      //    jump it back by GRAIN samples and start a crossfade
      if (lag < FADE && !this._fading) {
        this._rp2    = this._rp       // save current position for fade-out
        this._rp    -= GRAIN          // jump back to get more runway
        this._fading = true
        this._fadeI  = 0
      }

      // 4. Produce output sample (with optional crossfade)
      let sample
      if (this._fading) {
        const w  = this._win[this._fadeI]          // 0 → 1
        const s1 = this._lerp(this._rp2)           // old position  (fade out)
        const s2 = this._lerp(this._rp)            // new position  (fade in)
        sample = s1 * (1 - w) + s2 * w
        this._rp2 += pitch
        this._fadeI++
        if (this._fadeI >= FADE) this._fading = false
      } else {
        sample = this._lerp(this._rp)
      }

      out[i] = sample

      // 5. Advance primary read pointer at the pitch-shifted rate
      this._rp += pitch
    }

    return true   // keep processor alive
  }
}

registerProcessor('helium-processor', HeliumProcessor)
