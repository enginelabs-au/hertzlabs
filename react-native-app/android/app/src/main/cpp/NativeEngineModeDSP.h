#pragma once

#include <algorithm>
#include <cmath>

namespace hertz {

// Keep in sync with NATIVE_ENGINE_MODE_CODE in engineModeMapping.ts and
// NativeEngineModeCode in NativeEngineModeDSP.swift.
enum class NativeEngineModeCode : int {
    Binaural = 0,
    Monaural = 1,
    Isochronic = 2,
    HemisphericSync = 3,
    PhaseModulated = 4,
    PitchPanning = 5,
    MusicModulation = 6,
};

struct NativeEngineModeDSP {
    static constexpr double kTwoPi = 2.0 * M_PI;

    static double wrapPhase(double phase) noexcept {
        double wrapped = std::fmod(phase, kTwoPi);
        if (wrapped < 0.0) {
            wrapped += kTwoPi;
        }
        return wrapped;
    }

    static double smoothStep(double x) noexcept {
        const double t = std::clamp(x, 0.0, 1.0);
        return t * t * (3.0 - 2.0 * t);
    }

    static double isochronicGate(double beatPhase) noexcept {
        const double p = wrapPhase(beatPhase) / kTwoPi;
        constexpr double duty = 0.5;
        constexpr double edge = 0.04;

        if (p < edge) {
            return smoothStep(p / edge);
        }
        if (p < duty - edge) {
            return 1.0;
        }
        if (p < duty + edge) {
            return 1.0 - smoothStep((p - (duty - edge)) / (edge * 2.0));
        }
        return 0.0;
    }

    static double monauralEnvelope(double beatPhase) noexcept {
        return 0.18 + 0.82 * (0.5 + 0.5 * std::sin(beatPhase));
    }

    static double musicEnvelope(double beatPhase) noexcept {
        return 0.82 + 0.18 * (0.5 + 0.5 * std::sin(beatPhase));
    }

    static void rawStereo(int modeCode,
                          double carrierPhase,
                          double beatPhase,
                          double leftPhase,
                          double rightPhase,
                          double phaseOffsetRad,
                          double &outLeft,
                          double &outRight) noexcept {
        const auto mode = static_cast<NativeEngineModeCode>(modeCode);

        switch (mode) {
        case NativeEngineModeCode::Monaural: {
            const double env = monauralEnvelope(beatPhase);
            outLeft = std::sin(carrierPhase) * env;
            outRight = std::sin(carrierPhase + phaseOffsetRad) * env;
            break;
        }
        case NativeEngineModeCode::Isochronic: {
            const double gate = isochronicGate(beatPhase);
            outLeft = std::sin(carrierPhase) * gate;
            outRight = std::sin(carrierPhase + phaseOffsetRad) * gate;
            break;
        }
        case NativeEngineModeCode::HemisphericSync: {
            const double sway = (kTwoPi / 4.0) * std::sin(beatPhase);
            outLeft = std::sin(carrierPhase);
            outRight = std::sin(carrierPhase + phaseOffsetRad + sway);
            break;
        }
        case NativeEngineModeCode::PhaseModulated: {
            const double requestedDepth = std::abs(phaseOffsetRad);
            const double depth = std::clamp(requestedDepth, kTwoPi / 4.0, kTwoPi);
            const double offset = std::sin(beatPhase) * depth;
            outLeft = std::sin(carrierPhase - offset);
            outRight = std::sin(carrierPhase + offset);
            break;
        }
        case NativeEngineModeCode::PitchPanning: {
            const double pan = 0.5 + 0.5 * std::sin(beatPhase);
            outLeft = std::sin(carrierPhase) * std::sqrt(std::max(0.0, 1.0 - pan));
            outRight = std::sin(carrierPhase + phaseOffsetRad) * std::sqrt(std::max(0.0, pan));
            break;
        }
        case NativeEngineModeCode::MusicModulation:
            outLeft = std::sin(carrierPhase);
            outRight = std::sin(carrierPhase + phaseOffsetRad);
            break;
        case NativeEngineModeCode::Binaural:
        default:
            outLeft = std::sin(leftPhase);
            outRight = std::sin(rightPhase + phaseOffsetRad);
            break;
        }
    }
};

} // namespace hertz
