import Atomics
import Foundation

// MARK: - Constants shared across the engine

public enum AudioConstants {
    /// -6 dBFS = 10^(-6/20) ≈ 0.5011872336
    public static let kMaxAmplitude: Float = 0.5011872336
    public static let defaultRampMs: Double = 75
    public static let minRampMs: Double = 50
    public static let maxRampMs: Double = 100
    /// Experimental mode spans infrasonic → ultrasonic; JS sanitizes normal ranges.
    public static let minBeatHz: Double = 1e-18
    public static let maxBeatHz: Double = 1_000_000
    public static let minCarrierHz: Double = 0.001
    public static let maxCarrierHz: Double = 1_000_000
}

// MARK: - Parameter snapshot

/// Value type read by the audio render thread and written by the control thread.
/// All fields use Double for phase-critical values; gain/balance use Float.
public struct ParameterSnapshot: Sendable, Equatable {
    public var targetCarrierHz: Double       // 20–1500 Hz
    public var targetBeatHz: Double          // 0–100 Hz
    public var targetGain: Float             // 0.0–1.0
    public var targetBalance: Float          // -1.0 to 1.0
    public var targetPhaseAngle: Double      // degrees 0–360
    // RN currently uses this bridge slot as a compact engine-mode code. It stays
    // clamped to the original ±500 ms safety range until a dedicated native
    // mode field is added to the TurboModule contract.
    public var targetTimingDiffMs: Double    // ±500 ms / native mode code
    public var playIntent: Bool
    public var noiseWhiteGain: Float
    public var noisePinkGain: Float
    public var noiseBrownGain: Float
    public var generationCounter: UInt64     // monotonically incrementing

    public static let initial = ParameterSnapshot(
        targetCarrierHz: 200,
        targetBeatHz: 10,
        targetGain: 0,
        targetBalance: 0,
        targetPhaseAngle: 0,
        targetTimingDiffMs: 0,
        playIntent: false,
        noiseWhiteGain: 0,
        noisePinkGain: 0,
        noiseBrownGain: 0,
        generationCounter: 0
    )
}

// MARK: - Backward-compat type alias used by older engine code

public typealias HertzAudioParameters = ParameterSnapshot

// MARK: - ParameterBox

/// Lock-free double-buffered parameter container.
/// Control thread writes; audio render thread reads.
/// Zero locks, zero heap allocations in the read path.
public final class ParameterBox: @unchecked Sendable {
    private let slots: UnsafeMutablePointer<ParameterSnapshot>
    /// Index of the snapshot currently visible to the render thread (0 or 1).
    private let publishedIndex = ManagedAtomic<Int>(0)
    private let nextGeneration = ManagedAtomic<UInt64>(1)

    public init(initial: ParameterSnapshot = .initial) {
        slots = UnsafeMutablePointer<ParameterSnapshot>.allocate(capacity: 2)
        slots.initialize(repeating: initial, count: 2)
    }

    deinit {
        slots.deinitialize(count: 2)
        slots.deallocate()
    }

    // MARK: Render thread read — must not allocate or block

    @inline(__always)
    public func read() -> ParameterSnapshot {
        let index = publishedIndex.load(ordering: .acquiring)
        return slots.advanced(by: index).pointee
    }

    // MARK: Control thread write

    @discardableResult
    public func write(_ snapshot: ParameterSnapshot) -> ParameterSnapshot {
        let currentIndex = publishedIndex.load(ordering: .acquiring)
        let writeIndex = 1 - currentIndex
        var s = snapshot
        // Sanitize
        s.targetCarrierHz = max(AudioConstants.minCarrierHz,
                                min(AudioConstants.maxCarrierHz, s.targetCarrierHz))
        s.targetBeatHz = max(AudioConstants.minBeatHz,
                             min(AudioConstants.maxBeatHz, s.targetBeatHz))
        s.targetGain = max(0, min(1, s.targetGain))
        s.targetBalance = max(-1, min(1, s.targetBalance))
        s.targetPhaseAngle = max(0, min(360, s.targetPhaseAngle))
        s.targetTimingDiffMs = max(-500, min(500, s.targetTimingDiffMs))
        s.generationCounter = nextGeneration.wrappingIncrementThenLoad(ordering: .relaxed)

        slots.advanced(by: writeIndex).pointee = s
        publishedIndex.store(writeIndex, ordering: .releasing)
        return s
    }

    // MARK: Convenience partial-update helpers (control thread)

    public func setBinaural(
        carrierHz: Double,
        beatHz: Double,
        gain: Float,
        balance: Float,
        noiseWhite: Float? = nil,
        noisePink: Float? = nil,
        noiseBrown: Float? = nil
    ) {
        var s = read()
        s.targetCarrierHz = carrierHz
        s.targetBeatHz = beatHz
        s.targetGain = gain
        s.targetBalance = balance
        let clamp: (Float) -> Float = { max(0, min(AudioConstants.kMaxAmplitude, $0)) }
        if let noiseWhite { s.noiseWhiteGain = clamp(noiseWhite) }
        if let noisePink { s.noisePinkGain = clamp(noisePink) }
        if let noiseBrown { s.noiseBrownGain = clamp(noiseBrown) }
        write(s)
    }

    public func setPhaseAndTiming(phaseAngle: Double, timingDiffMs: Double) {
        var s = read()
        s.targetPhaseAngle = phaseAngle
        s.targetTimingDiffMs = timingDiffMs
        write(s)
    }

    public func setPlayIntent(_ intent: Bool) {
        var s = read()
        s.playIntent = intent
        // Do not zero targetGain here — the render path already mutes when playIntent
        // is false. Clearing gain breaks resume after pause/stop.
        write(s)
    }

    public func setNoise(type: NoiseType, level: Float) {
        var s = read()
        let clamped = max(0, min(AudioConstants.kMaxAmplitude, level))
        switch type {
        case .white: s.noiseWhiteGain = clamped
        case .pink:  s.noisePinkGain = clamped
        case .brown: s.noiseBrownGain = clamped
        case .none:
            s.noiseWhiteGain = 0
            s.noisePinkGain = 0
            s.noiseBrownGain = 0
        }
        write(s)
    }

    /// Atomic update — avoids partial state between per-type bridge calls.
    public func setNoiseLayers(white: Float, pink: Float, brown: Float) {
        var s = read()
        let clamp: (Float) -> Float = { max(0, min(AudioConstants.kMaxAmplitude, $0)) }
        s.noiseWhiteGain = clamp(white)
        s.noisePinkGain = clamp(pink)
        s.noiseBrownGain = clamp(brown)
        write(s)
    }

    // MARK: Legacy shim — publish() — used by existing engine call sites

    @discardableResult
    public func publish(
        carrierHz: Double,
        beatHz: Double,
        gain: Float,
        balance: Float,
        noiseType: NoiseType? = nil,
        noiseLevel: Float? = nil,
        rampDurationMs: Double? = nil,
        playIntent: Bool? = nil
    ) -> ParameterSnapshot? {
        guard carrierHz.isFinite, beatHz.isFinite, gain.isFinite, balance.isFinite else {
            return nil
        }
        var s = read()
        s.targetCarrierHz = carrierHz
        s.targetBeatHz = beatHz
        s.targetGain = gain
        s.targetBalance = balance
        if let intent = playIntent { s.playIntent = intent }
        return write(s)
    }

    /// Legacy shim for existing callers using renderSnapshot()
    @inline(__always)
    public func renderSnapshot() -> ParameterSnapshot { read() }
}

// MARK: - NoiseType (defined here; referenced by ParameterBox helpers)

public enum NoiseType: String, Sendable, Codable, CaseIterable {
    case none
    case white
    case pink
    case brown
}
