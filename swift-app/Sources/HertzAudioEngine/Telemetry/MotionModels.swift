import Foundation
#if os(iOS)
import CoreMotion
#endif

/// All sensor channels normalized to Float in [0.0, 1.0].
/// Raw physical units never leave the Swift layer.
public struct NormalizedTelemetry: Equatable {
    public let gyroY: Float           // (gyroY_rad_s + π) / (2π)
    public let accelMagnitude: Float  // clamp((|a| + 9.81) / 49.05, 0, 1)
    public let roll: Float            // (roll + π) / (2π)
    public let pitch: Float           // (pitch + π/2) / π
    public let yaw: Float             // yaw / (2π)
    public let heading: Float         // heading_deg / 360
    public let stepCadence: Float     // clamp(cadence / 200, 0, 1)
    public let shakeDetected: Bool

    public static let zero = NormalizedTelemetry(
        gyroY: 0.5, accelMagnitude: 0, roll: 0.5, pitch: 0.5,
        yaw: 0, heading: 0, stepCadence: 0, shakeDetected: false
    )

    public func isApproxEqual(to other: NormalizedTelemetry, epsilon: Float) -> Bool {
        return abs(gyroY - other.gyroY) < epsilon &&
               abs(accelMagnitude - other.accelMagnitude) < epsilon &&
               abs(roll - other.roll) < epsilon &&
               abs(pitch - other.pitch) < epsilon &&
               abs(yaw - other.yaw) < epsilon &&
               abs(heading - other.heading) < epsilon &&
               abs(stepCadence - other.stepCadence) < epsilon &&
               shakeDetected == other.shakeDetected
    }
}

/// Input context assembled by HertzEngineFacade for Gemini/fallback calls.
public struct TelemetryContext {
    public let snapshot: NormalizedTelemetry
    public let currentBeatHz: Double
    public let sessionState: String   // "playing" | "paused" | "idle"

    public init(snapshot: NormalizedTelemetry, currentBeatHz: Double, sessionState: String) {
        self.snapshot = snapshot
        self.currentBeatHz = currentBeatHz
        self.sessionState = sessionState
    }
}
