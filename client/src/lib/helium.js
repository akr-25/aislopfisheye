/**
 * helium.js — HeliumAudio
 *
 * Pipes a MediaStream through the helium-processor AudioWorklet and
 * returns a new MediaStream containing the pitch-shifted audio track.
 *
 * Usage:
 *   const helium = new HeliumAudio()
 *   const processedStream = await helium.process(localStream)
 *   // use processedStream.getAudioTracks()[0] in your RTCPeerConnection
 *   helium.stop() // when done
 */

import processorUrl from './helium-processor.js?url'

export class HeliumAudio {
  constructor () {
    this._ctx    = null
    this._source = null
    this._node   = null
    this._dest   = null
  }

  /**
   * @param {MediaStream} inputStream  - the raw mic stream
   * @param {number}      pitchFactor  - >1 = higher pitch (default 1.4 ≈ helium)
   * @returns {Promise<MediaStream>}   - stream with processed audio track
   */
  async process (inputStream, pitchFactor = 1.4) {
    // AudioContext must be created (or resumed) from a user-gesture context,
    // so the caller must invoke this from a button click handler.
    this._ctx = new AudioContext()

    // If the context was suspended (auto-play policy), resume it
    if (this._ctx.state === 'suspended') {
      await this._ctx.resume()
    }

    // Register the worklet processor module
    await this._ctx.audioWorklet.addModule(processorUrl)

    // Build the chain:  mic source → worklet node → stream destination
    this._source = this._ctx.createMediaStreamSource(inputStream)

    this._node = new AudioWorkletNode(this._ctx, 'helium-processor', {
      numberOfInputs:  1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      parameterData: { pitch: pitchFactor },
    })

    this._dest = this._ctx.createMediaStreamDestination()

    this._source.connect(this._node)
    this._node.connect(this._dest)

    return this._dest.stream
  }

  /**
   * Update pitch in real-time without restarting the pipeline.
   * @param {number} pitchFactor
   */
  setPitch (pitchFactor) {
    if (!this._node) return
    const param = this._node.parameters.get('pitch')
    if (param) param.setTargetAtTime(pitchFactor, this._ctx.currentTime, 0.01)
  }

  /** Tear down the audio graph and close the AudioContext. */
  stop () {
    try { this._node?.disconnect()   } catch {}
    try { this._source?.disconnect() } catch {}
    try { this._ctx?.close()         } catch {}
    this._ctx = this._source = this._node = this._dest = null
  }
}
