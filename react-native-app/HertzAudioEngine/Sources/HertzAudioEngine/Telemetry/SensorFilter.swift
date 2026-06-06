import Foundation
import simd
#if os(iOS)
import CoreMotion
#endif

// MARK: - SensorFilter

/// Stateless normalization helpers. All outputs are Float in [0.0, 1.0].
/// Equations per Plan 04 spec.
public enum SensorFilter {

    // Constants
    private static let gyroMaxRadS: Float = Float.pi      // ±π rad/s
    private static let accelMaxG: Float = 2.0             // ±2g
    private static let shakeThresholdG: Float = 2.5       // 2.5g
    private static let cadenceMaxSpm: Float = 200

    // MARK: - Plan 04 normalization equations

    /// Accelerometer normalization (g-force clamp ±2g → 0..1):
    /// normalized = (rawG + 2.0) / 4.0  clamped to [0, 1]
    public static func normalizeAccelG(_ gForce: Float) -> Float {
        clamp01((gForce + accelMaxG) / (2 * accelMaxG))
    }

    /// Gyroscope normalization (rad/s clamp ±π → 0..1):
    /// normalized = (rawGyro + π) / (2π)  clamped to [0, 1]
    public static func normalizeGyro(_ radS: Float) -> Float {
        clamp01((radS + gyroMaxRadS) / (2 * gyroMaxRadS))
    }

    /// Cadence normalization (steps/min, max 200 spm → 0..1):
    /// normalized = cadence / 200  clamped to [0, 1]
    public static func normalizeCadence(_ stepsPerMin: Float) -> Float {
        clamp01(stepsPerMin / cadenceMaxSpm)
    }

    // MARK: - Existing channel helpers (legacy compat)

    public static func normalizeGyroY(_ radS: Double) -> Float {
        normalizeGyro(Float(radS))
    }

    public static func normalizeRoll(_ rad: Double) -> Float {
        clamp01((Float(rad) + Float.pi) / (2 * Float.pi))
    }

    public static func normalizePitch(_ rad: Double) -> Float {
        clamp01((Float(rad) + Float.pi / 2) / Float.pi)
    }

    public static func normalizeYaw(_ rad: Double) -> Float {
        clamp01(Float(rad) / (2 * Float.pi))
    }

    public static func normalizeHeading(_ degrees: Double) -> Float {
        clamp01(Float(degrees) / 360)
    }

    public static func normalizeCadence(_ stepsPerMinute: Double) -> Float {
        normalizeCadence(Float(stepsPerMinute))
    }

    /// Returns (normalizedMagnitude, overShakeThreshold).
    /// CMDeviceMotion.userAcceleration is in g; magnitude = |a| (gravity-subtracted).
    public static func normalizeAccel(x: Double, y: Double, z: Double) -> (magnitude: Float, overThreshold: Bool) {
        let mag = Float(sqrt(x*x + y*y + z*z))
        return (normalizeAccelG(mag), mag > shakeThresholdG)
    }

    // MARK: - Idle-gate variance

    /// Variance of the magnitudes of a series of SIMD3<Float> sensor vectors.
    /// Used for the 300-second idle-gate check in TelemetryManager.
    public static func vectorVariance(readings: [SIMD3<Float>]) -> Float {
        guard readings.count > 1 else { return 0 }

        let magnitudes = readings.map { simd_length($0) }
        let count = Float(magnitudes.count)
        let mean = magnitudes.reduce(0, +) / count
        let variance = magnitudes.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / count
        return variance
    }

    // MARK: - Private

    @inline(__always)
    private static func clamp01(_ v: Float) -> Float {
        min(max(v, 0), 1)
    }
}
