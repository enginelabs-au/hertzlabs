import Foundation
import HertzAudioEngine

@objc(HertzAudioEngineBridge)
final class HertzAudioEngineBridge: NSObject, HertzEngineDelegate {
  @objc weak var sink: (any HertzAudioEventSink)?

  func onEngineState(_ state: String, sampleRate: Double, route: String) {
    sink?.emitEngineState(withState: state, sampleRate: sampleRate, route: route)
  }

  func onPosition(elapsedSec: Double) {
    sink?.emitPosition(withElapsedSec: elapsedSec)
  }

  func onError(code: String, message: String) {
    sink?.emitError(withCode: code, message: message)
  }

  func onAIStatus(_ status: String) {}

  func onHighVolumeWarning() {}

  func onIdleAutoSleep() {}

  func onRouteChanged(route: String) {
    sink?.emitEngineState(withState: "playing", sampleRate: 48_000, route: route)
  }
}
