import Foundation

// MARK: - HertzEngineDelegate

/// Callbacks from HertzEngineFacade to the host (RN bridge or profiling harness).
/// All methods are called on the main queue.
public protocol HertzEngineDelegate: AnyObject {
    /// Engine state change. state is EngineState.rawValue; route is OutputRoute.rawValue.
    func onEngineState(_ state: String, sampleRate: Double, route: String)

    /// Periodic position update (approximately once per second while playing).
    func onPosition(elapsedSec: Double)

    /// Fatal or recoverable error from the audio subsystem.
    func onError(code: String, message: String)

    /// AI session generation status: "idle" | "loading" | "done" | "error".
    func onAIStatus(_ status: String)

    /// Output volume exceeds 0.75 (safe listening advisory).
    func onHighVolumeWarning()

    /// No meaningful motion detected for 300 s — auto-sleep advisory.
    func onIdleAutoSleep()

    /// Audio output route changed. route is OutputRoute.rawValue.
    func onRouteChanged(route: String)
}
