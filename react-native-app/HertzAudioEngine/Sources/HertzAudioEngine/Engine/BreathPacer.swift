import Foundation

/// Sample-accurate breath envelope — mirrors `BreathPacer.h` on Android.
enum BreathSegmentKind: UInt8 {
    case inhale = 0
    case holdPeak = 1
    case exhale = 2
    case holdTrough = 3
}

private struct BreathSegmentDef {
    let kind: BreathSegmentKind
    let durationSec: Float
}

public final class BreathPacer {
    private static let patternBox: [BreathSegmentDef] = [
        .init(kind: .inhale, durationSec: 4),
        .init(kind: .holdPeak, durationSec: 4),
        .init(kind: .exhale, durationSec: 4),
        .init(kind: .holdTrough, durationSec: 4),
    ]
    private static let pattern478: [BreathSegmentDef] = [
        .init(kind: .inhale, durationSec: 4),
        .init(kind: .holdPeak, durationSec: 7),
        .init(kind: .exhale, durationSec: 8),
    ]
    private static let patternResonant: [BreathSegmentDef] = [
        .init(kind: .inhale, durationSec: 5.5),
        .init(kind: .exhale, durationSec: 5.5),
    ]

    private var enabled = false
    private var patternId = 0
    private var deltaDb: Float = 4.5
    private var sampleRate: Double = 48_000
    private var phaseIndex = 0
    private var phaseSample = 0
    private var phaseDurationSamples = 1
    private var segments: [BreathSegmentDef] = patternBox

    public init() {}

    public func configure(enabled: Bool, patternId: Int, deltaDb: Float, sampleRate: Double) {
        let clampedDelta = max(3, min(6, deltaDb))
        let clampedPattern = max(0, min(2, patternId))
        let changed =
            enabled != self.enabled ||
            clampedPattern != self.patternId ||
            abs(clampedDelta - self.deltaDb) > 0.001
        self.enabled = enabled
        self.patternId = clampedPattern
        self.deltaDb = clampedDelta
        self.sampleRate = sampleRate > 0 ? sampleRate : 48_000
        segments = Self.segmentsForPattern(clampedPattern)
        if changed {
            phaseIndex = 0
            phaseSample = 0
            rebuildSegmentDuration()
        }
    }

    @inline(__always)
    public func advance() -> Float {
        guard enabled, !segments.isEmpty, phaseDurationSamples > 0 else {
            return 1
        }
        let progress = Float(phaseSample) / Float(phaseDurationSamples)
        let mult = envelopeAt(segments[phaseIndex].kind, t: progress)
        phaseSample += 1
        if phaseSample >= phaseDurationSamples {
            phaseSample = 0
            phaseIndex = (phaseIndex + 1) % segments.count
            rebuildSegmentDuration()
        }
        return mult
    }

    private static func segmentsForPattern(_ id: Int) -> [BreathSegmentDef] {
        switch id {
        case 1: return pattern478
        case 2: return patternResonant
        default: return patternBox
        }
    }

    private func rebuildSegmentDuration() {
        let durSec = segments[phaseIndex].durationSec
        phaseDurationSamples = max(1, Int((Double(durSec) * sampleRate).rounded()))
    }

    private func envelopeAt(_ kind: BreathSegmentKind, t: Float) -> Float {
        let peak = Self.dbToLinear(deltaDb * 0.5)
        let trough = Self.dbToLinear(-deltaDb * 0.5)
        switch kind {
        case .inhale:
            return trough + (peak - trough) * Self.smooth01(t)
        case .holdPeak:
            return peak
        case .exhale:
            return peak + (trough - peak) * Self.smooth01(t)
        case .holdTrough:
            return trough
        }
    }

    private static func dbToLinear(_ db: Float) -> Float {
        powf(10, db / 20)
    }

    private static func smooth01(_ t: Float) -> Float {
        let x = max(0, min(1, t))
        return 0.5 - 0.5 * cosf(x * Float.pi)
    }
}
