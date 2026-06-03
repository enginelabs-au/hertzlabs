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
    balance: Float
  ) {
    facade.setBinauralParameters(
      carrierHz: carrierHz,
      beatHz: beatHz,
      gain: gain,
      balance: balance
    )
  }

  @objc func setNoise(type: String, level: Float) {
    facade.setNoise(type: type, level: level)
  }

  @objc func fade(toGain: Float, durationMs: Int) {
    facade.fade(toGain: toGain, durationMs: durationMs)
  }

  @objc func setPhaseAndTiming(phase: Double, timingMs: Double) {
    facade.setPhaseAndTiming(phaseAngle: phase, timingDiffMs: timingMs)
  }
}
