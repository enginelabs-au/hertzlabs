import Darwin

// Keep in sync with `NATIVE_ENGINE_MODE_CODE` in `engineModeMapping.ts`.
enum NativeEngineModeCode: Int {
    case binaural = 0
    case monaural = 1
    case isochronic = 2
    case hemisphericSync = 3
    case phaseModulated = 4
    case pitchPanning = 5
    case musicModulation = 6
}

enum NativeEngineModeDSP {
    static let twoPi = 2.0 * Double.pi

    static func wrapPhase(_ phase: Double) -> Double {
        var wrapped = phase.truncatingRemainder(dividingBy: twoPi)
        if wrapped < 0 {
            wrapped += twoPi
        }
        return wrapped
    }

    static func smoothStep(_ x: Double) -> Double {
        let t = min(1, max(0, x))
        return t * t * (3 - 2 * t)
    }

    static func isochronicGate(_ beatPhase: Double) -> Double {
        let p = wrapPhase(beatPhase) / twoPi
        let duty = 0.5
        let edge = 0.04

        if p < edge {
            return smoothStep(p / edge)
        }
        if p < duty - edge {
            return 1
        }
        if p < duty + edge {
            return 1 - smoothStep((p - (duty - edge)) / (edge * 2))
        }
        return 0
    }

    static func monauralEnvelope(_ beatPhase: Double) -> Double {
        0.18 + 0.82 * (0.5 + 0.5 * sin(beatPhase))
    }

    static func musicEnvelope(_ beatPhase: Double) -> Double {
        0.82 + 0.18 * (0.5 + 0.5 * sin(beatPhase))
    }

    static func rawStereo(
        modeCode: Int,
        carrierPhase: Double,
        beatPhase: Double,
        leftPhase: Double,
        rightPhase: Double,
        phaseOffsetRad: Double
    ) -> (left: Double, right: Double) {
        switch NativeEngineModeCode(rawValue: modeCode) ?? .binaural {
        case .monaural:
            // Mono AM beat. The phase slider applies an inter-aural phase offset to
            // the right channel (audible spatial shift on headphones; no-op at 0).
            let env = monauralEnvelope(beatPhase)
            return (sin(carrierPhase) * env, sin(carrierPhase + phaseOffsetRad) * env)

        case .isochronic:
            // Gated pulse. Phase slider shifts the right channel relative to the left.
            let gate = isochronicGate(beatPhase)
            return (sin(carrierPhase) * gate, sin(carrierPhase + phaseOffsetRad) * gate)

        case .hemisphericSync:
            // Same carrier pitch in both ears (no arithmetic beat). The inter-aural
            // phase offset sways around the controlled base offset at the beat rate,
            // so the brain tracks a moving phase relationship that follows the freq
            // slider. Left stays the clean reference hemisphere.
            let sway = (Double.pi / 2) * sin(beatPhase)
            return (sin(carrierPhase), sin(carrierPhase + phaseOffsetRad + sway))

        case .phaseModulated:
            let requestedDepth = abs(phaseOffsetRad)
            let depth = min(Double.pi, max(Double.pi / 4.0, requestedDepth))
            let offset = sin(beatPhase) * depth
            return (sin(carrierPhase - offset), sin(carrierPhase + offset))

        case .pitchPanning:
            // Constant-power pan at the beat rate; phase slider adds an inter-aural
            // phase offset to the right channel on top of the lateral movement.
            let pan = 0.5 + 0.5 * sin(beatPhase)
            return (
                sin(carrierPhase) * sqrt(max(0, 1 - pan)),
                sin(carrierPhase + phaseOffsetRad) * sqrt(max(0, pan))
            )

        case .musicModulation:
            // Subtle AM bed (envelope applied downstream). Phase slider offsets the
            // right channel for an audible inter-aural phase relationship.
            return (sin(carrierPhase), sin(carrierPhase + phaseOffsetRad))

        case .binaural:
            return (sin(leftPhase), sin(rightPhase + phaseOffsetRad))
        }
    }
}
