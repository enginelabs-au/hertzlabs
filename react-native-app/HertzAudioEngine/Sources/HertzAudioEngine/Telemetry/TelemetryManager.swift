import Foundation
import simd
#if os(iOS)
import CoreMotion
#endif

// MARK: - SensorReading

/// Normalized sensor snapshot emitted by TelemetryManager.
/// All channel values are in [0.0, 1.0] after normalization by SensorFilter.
public struct SensorReading: Sendable {
    public let accelerometer: SIMD3<Float>   // (x, y, z) normalized g-force channels
    public let gyroscope: SIMD3<Float>       // (x, y, z) normalized rad/s channels
    public let stepCount: Int
    public let cadence: Float                // normalized steps/min in [0, 1]
    public let timestamp: Double             // seconds since reference date
}

// MARK: - TelemetryManagerDelegate

public protocol TelemetryManagerDelegate: AnyObject {
    func telemetryDidUpdate(_ reading: SensorReading)
    func telemetryDidEnterSleep()
}

// MARK: - TelemetryManager

/// Owns CMMotionManager + CMPedometer (iOS only; no-op stub on macOS).
///
/// Dynamic update-rate: 100 ms default, 40 ms when |gyroY| > 0.1 rad/s.
/// Auto-sleep idle gate: fires delegate.telemetryDidEnterSleep() after 300 s of
/// near-zero motion variance (< ε = 0.001).
public final class TelemetryManager {

    public weak var delegate: TelemetryManagerDelegate?

#if os(iOS)
    private let motionManager = CMMotionManager()
    private let pedometer = CMPedometer()
    private let motionQueue: OperationQueue = {
        let q = OperationQueue()
        q.maxConcurrentOperationCount = 1
        q.qualityOfService = .userInteractive
        return q
    }()

    private var currentInterval: TimeInterval = 0.1
    private var latestCadence: Float = 0
    private var latestStepCount: Int = 0
    private var isInIdleSleep: Bool = false
    private var motionVectorHistory: [SIMD3<Float>] = []

    private static let idleWindowSec: TimeInterval = 300
    private static let idleVarianceEpsilon: Float = 0.001
#endif

    public init() {}

    // MARK: - Public API

    public func start() {
#if os(iOS)
        guard motionManager.isDeviceMotionAvailable else { return }
        isInIdleSleep = false
        motionVectorHistory.removeAll()
        motionManager.deviceMotionUpdateInterval = currentInterval
        motionManager.startDeviceMotionUpdates(to: motionQueue) { [weak self] motion, _ in
            guard let self, let motion else { return }
            self.handleMotion(motion)
        }
        startPedometer()
#endif
    }

    public func stop() {
#if os(iOS)
        motionManager.stopDeviceMotionUpdates()
        pedometer.stopUpdates()
#endif
    }

#if os(iOS)
    // MARK: - Private iOS implementation

    private func startPedometer() {
        guard CMPedometer.isStepCountingAvailable() else { return }
        pedometer.startUpdates(from: Date()) { [weak self] data, _ in
            guard let self, let data else { return }
            self.latestStepCount = data.numberOfSteps.intValue
            if let pace = data.currentPace, pace.doubleValue > 0 {
                self.latestCadence = SensorFilter.normalizeCadence(Float(60.0 / pace.doubleValue))
            }
        }
    }

    private func handleMotion(_ motion: CMDeviceMotion) {
        let gyroY = motion.rotationRate.y

        // Dynamic interval scaling
        let targetInterval: TimeInterval = abs(gyroY) > 0.1 ? 0.04 : 0.1
        if abs(currentInterval - targetInterval) > 0.001 {
            currentInterval = targetInterval
            motionManager.deviceMotionUpdateInterval = targetInterval
        }

        let ax = SensorFilter.normalizeAccelG(Float(motion.userAcceleration.x))
        let ay = SensorFilter.normalizeAccelG(Float(motion.userAcceleration.y))
        let az = SensorFilter.normalizeAccelG(Float(motion.userAcceleration.z))
        let gx = SensorFilter.normalizeGyro(Float(motion.rotationRate.x))
        let gy = SensorFilter.normalizeGyro(Float(gyroY))
        let gz = SensorFilter.normalizeGyro(Float(motion.rotationRate.z))

        let accelVec = SIMD3<Float>(ax, ay, az)
        let gyroVec  = SIMD3<Float>(gx, gy, gz)

        updateIdleGate(accelVec: accelVec)

        let reading = SensorReading(
            accelerometer: accelVec,
            gyroscope: gyroVec,
            stepCount: latestStepCount,
            cadence: latestCadence,
            timestamp: Date().timeIntervalSinceReferenceDate
        )

        DispatchQueue.main.async { [weak self] in
            self?.delegate?.telemetryDidUpdate(reading)
        }
    }

    private func updateIdleGate(accelVec: SIMD3<Float>) {
        let maxSamples = max(1, Int(TelemetryManager.idleWindowSec / currentInterval))
        motionVectorHistory.append(accelVec)
        if motionVectorHistory.count > maxSamples {
            motionVectorHistory.removeFirst()
        }

        guard motionVectorHistory.count >= maxSamples else { return }

        let variance = SensorFilter.vectorVariance(readings: motionVectorHistory)
        if variance < TelemetryManager.idleVarianceEpsilon && !isInIdleSleep {
            isInIdleSleep = true
            stop()
            DispatchQueue.main.async { [weak self] in
                self?.delegate?.telemetryDidEnterSleep()
            }
        }
    }
#endif
}
