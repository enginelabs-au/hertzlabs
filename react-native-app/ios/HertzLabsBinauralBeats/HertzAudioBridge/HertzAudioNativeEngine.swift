import Foundation
import HertzAudioEngine

@objc(HertzAudioNativeEngine)
final class HertzAudioNativeEngine: NSObject {
  private let facade = HertzEngineFacade()
  private let bridge = HertzAudioEngineBridge()

  @objc weak var eventSink: (any HertzAudioEventSink)? {
    didSet { bridge.sink = eventSink }
  }

  override init() {
    super.init()
    facade.delegate = bridge
  }

  @objc func configure(sampleRate: Double, bufferDurationMs: Double) {
    facade.configure(sampleRate: sampleRate, bufferDurationMs: bufferDurationMs)
  }

  @objc func play() {
    facade.play()
  }

  @objc func pause() {
    facade.pause()
  }

  @objc func stop() {
    facade.stop()
  }

  @objc func setBinauralParameters(
    carrierHz: Double,
    beatHz: Double,
    gain: Float,
    balance: Float,
    noiseWhite: Float,
    noisePink: Float,
    noiseBrown: Float
  ) {
    facade.setBinauralParameters(
      carrierHz: carrierHz,
      beatHz: beatHz,
      gain: gain,
      balance: balance,
      noiseWhite: noiseWhite,
      noisePink: noisePink,
      noiseBrown: noiseBrown
    )
  }

  @objc func setNoise(type: String, level: Float) {
    facade.setNoise(type: type, level: level)
  }

  @objc func setNoiseLayers(white: Float, pink: Float, brown: Float) {
    facade.setNoiseLayers(white: white, pink: pink, brown: brown)
  }

  @objc func fade(toGain: Float, durationMs: Int) {
    facade.fade(toGain: toGain, durationMs: durationMs)
  }

  @objc func setPhaseAndTiming(phase: Double, timingMs: Double) {
    facade.setPhaseAndTiming(phaseAngle: phase, timingDiffMs: timingMs)
  }

  @objc func setBackgroundPlaybackEnabled(_ enabled: Bool) {
    AudioSessionController.shared.backgroundPlaybackEnabled = enabled
  }

  @objc(setBreathPacerWithEnabled:patternId:deltaDb:)
  func setBreathPacerWithEnabled(_ enabled: Bool, patternId: Int, deltaDb: Float) {
    facade.setBreathPacer(enabled: enabled, patternId: patternId, deltaDb: deltaDb)
  }
}
