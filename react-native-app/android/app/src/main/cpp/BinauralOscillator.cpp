#include "BinauralOscillator.h"

#include "NativeEngineModeDSP.h"

#include <algorithm>
#include <atomic>
#include <cmath>

namespace hertz {

// TEMP POPTRACE diagnostics — read by HertzAudioEngine monitor thread.
namespace diag {
std::atomic<uint64_t> g_frameCounter{0};
std::atomic<uint64_t> g_glitchCount{0};
std::atomic<float> g_lastGlitchDelta{0.0f};
std::atomic<uint64_t> g_lastGlitchFrame{0};
std::atomic<float> g_maxJump{0.0f};
}

namespace {
constexpr double kPiOver180 = M_PI / 180.0;
constexpr float kDcBlockCoeff = 0.995f;

float softLimit(float sample, float ceiling) {
    const float absS = std::abs(sample);
    if (absS <= ceiling) {
        return sample;
    }
    const float sign = sample >= 0.0f ? 1.0f : -1.0f;
    const float excess = absS - ceiling;
    return sign * (ceiling + excess / (1.0f + excess * 4.0f));
}
} // namespace

void BinauralOscillator::setSampleRate(double sampleRate) {
    sampleRate_ = sampleRate > 0.0 ? sampleRate : 48000.0;
    constexpr double tau = 0.080;
    smoothAlpha_ = static_cast<float>(1.0 - std::exp(-1.0 / (tau * sampleRate_)));
    constexpr double silenceTau = 0.030;
    silenceSmoothAlpha_ = static_cast<float>(1.0 - std::exp(-1.0 / (silenceTau * sampleRate_)));
    constexpr double noiseTau = 0.040;
    noiseSmoothAlpha_ = static_cast<float>(1.0 - std::exp(-1.0 / (noiseTau * sampleRate_)));
}

void BinauralOscillator::snapSmoothedStateTo(const ParameterSnapshot &snapshot) {
    currentCarrierHz_ = snapshot.targetCarrierHz;
    currentBeatHz_ = snapshot.targetBeatHz;
    currentGain_ = snapshot.targetGain;
    currentBalance_ = snapshot.targetBalance;
    currentPhaseAngleRad_ = snapshot.targetPhaseAngle * kPiOver180;
    currentNoiseWhite_ = snapshot.noiseWhiteGain;
    currentNoisePink_ = snapshot.noisePinkGain;
    currentNoiseBrown_ = snapshot.noiseBrownGain;
    targetModeCode_ = static_cast<int>(std::lround(snapshot.targetTimingDiffMs));
    currentToneDuck_ = 1.0f;
}

void BinauralOscillator::syncTargets(const ParameterSnapshot &snapshot) {
    const double carrierTarget = snapshot.targetCarrierHz;
    const double beatTarget = snapshot.targetBeatHz;
    currentCarrierHz_ += static_cast<double>(smoothAlpha_) * (carrierTarget - currentCarrierHz_);
    currentBeatHz_ += static_cast<double>(smoothAlpha_) * (beatTarget - currentBeatHz_);

    currentGain_ += smoothAlpha_ * (snapshot.targetGain - currentGain_);
    currentBalance_ += smoothAlpha_ * (snapshot.targetBalance - currentBalance_);

    const double phaseTarget = snapshot.targetPhaseAngle * kPiOver180;
    currentPhaseAngleRad_ += static_cast<double>(smoothAlpha_) * (phaseTarget - currentPhaseAngleRad_);

    currentNoiseWhite_ += noiseSmoothAlpha_ * (snapshot.noiseWhiteGain - currentNoiseWhite_);
    currentNoisePink_ += noiseSmoothAlpha_ * (snapshot.noisePinkGain - currentNoisePink_);
    currentNoiseBrown_ += noiseSmoothAlpha_ * (snapshot.noiseBrownGain - currentNoiseBrown_);

    targetModeCode_ = static_cast<int>(std::lround(snapshot.targetTimingDiffMs));
}

float BinauralOscillator::nextNoiseSample() {
    rngState_ = rngState_ * 1664525u + 1013904223u;
    const float whiteRaw =
        static_cast<float>((rngState_ & 0x7FFFFFFFu) / static_cast<float>(0x7FFFFFFFu)) * 2.0f - 1.0f;

    pinkB0_ = 0.99886f * pinkB0_ + whiteRaw * 0.0555179f;
    pinkB1_ = 0.99332f * pinkB1_ + whiteRaw * 0.0750759f;
    pinkB2_ = 0.96900f * pinkB2_ + whiteRaw * 0.1538520f;
    pinkB3_ = 0.86650f * pinkB3_ + whiteRaw * 0.3104856f;
    pinkB4_ = 0.55000f * pinkB4_ + whiteRaw * 0.5329522f;
    pinkB5_ = -0.7616f * pinkB5_ - whiteRaw * 0.0168980f;
    const float pinkRaw =
        (pinkB0_ + pinkB1_ + pinkB2_ + pinkB3_ + pinkB4_ + pinkB5_ + pinkB6_) * 0.11f;
    pinkB6_ = whiteRaw * 0.115926f;

    brownState_ = (brownState_ + whiteRaw * 0.02f) * 0.995f;
    brownState_ = std::clamp(brownState_, -1.2f, 1.2f);

    float noiseMono = currentNoiseWhite_ * whiteRaw;
    if (currentNoisePink_ > 0.0f) {
        noiseMono += currentNoisePink_ * std::clamp(pinkRaw, -1.5f, 1.5f);
    }
    if (currentNoiseBrown_ > 0.0f) {
        noiseMono += currentNoiseBrown_ * brownState_;
    }
    return noiseMono;
}

float BinauralOscillator::dcBlock(float sample, float &state, float &blocked) {
    blocked = sample - state + kDcBlockCoeff * blocked;
    state = sample;
    return blocked;
}

void BinauralOscillator::render(float *output,
                                int32_t frameCount,
                                const ParameterBox &params) {
    const double twoPi = NativeEngineModeDSP::kTwoPi;
    const ParameterSnapshot headSnap = params.snapshot();
    breathPacer_.configure(
        headSnap.breathPacerEnabled,
        headSnap.breathPatternId,
        headSnap.breathDeltaDb,
        sampleRate_);

    for (int32_t i = 0; i < frameCount; ++i) {
        const ParameterSnapshot snap = params.snapshot();
        syncTargets(snap);

        const float breathMult =
            snap.breathPacerEnabled && snap.playIntent ? breathPacer_.advance() : 1.0f;
        const float pacedGain = currentGain_ * breathMult;

        const float gateTarget = snap.playIntent ? 1.0f : 0.0f;
        const float gateDelta = gateTarget - outputGate_;
        const float gateAlpha = (gateDelta < 0.0f) ? silenceSmoothAlpha_ : smoothAlpha_;
        outputGate_ += gateAlpha * gateDelta;

        const auto mode = static_cast<NativeEngineModeCode>(targetModeCode_);

        const double leftHz = std::max(0.001, currentCarrierHz_ - currentBeatHz_ * 0.5);
        const double rightHz = std::max(0.001, currentCarrierHz_ + currentBeatHz_ * 0.5);
        const double beatRateHz = std::max(0.001, std::abs(currentBeatHz_));

        switch (mode) {
        case NativeEngineModeCode::Monaural:
        case NativeEngineModeCode::Isochronic:
        case NativeEngineModeCode::HemisphericSync:
        case NativeEngineModeCode::PhaseModulated:
        case NativeEngineModeCode::PitchPanning:
        case NativeEngineModeCode::MusicModulation:
            carrierPhase_ += twoPi * std::max(0.001, currentCarrierHz_) / sampleRate_;
            beatPhase_ += twoPi * beatRateHz / sampleRate_;
            break;
        case NativeEngineModeCode::Binaural:
        default:
            carrierPhase_ += twoPi * leftHz / sampleRate_;
            beatPhase_ += twoPi * rightHz / sampleRate_;
            break;
        }

        carrierPhase_ = NativeEngineModeDSP::wrapPhase(carrierPhase_);
        beatPhase_ = NativeEngineModeDSP::wrapPhase(beatPhase_);

        double rawLeft = 0.0;
        double rawRight = 0.0;
        NativeEngineModeDSP::rawStereo(
            targetModeCode_,
            carrierPhase_,
            beatPhase_,
            carrierPhase_,
            beatPhase_,
            currentPhaseAngleRad_,
            rawLeft,
            rawRight);

        const float gainL = pacedGain * std::max(0.0f, 1.0f - currentBalance_);
        const float gainR = pacedGain * std::max(0.0f, 1.0f + currentBalance_);

        float outL = static_cast<float>(rawLeft) * std::min(gainL, kPeakCeilingLinear);
        float outR = static_cast<float>(rawRight) * std::min(gainR, kPeakCeilingLinear);

        if (mode == NativeEngineModeCode::MusicModulation) {
            const float envelope =
                static_cast<float>(NativeEngineModeDSP::musicEnvelope(beatPhase_));
            outL *= envelope;
            outR *= envelope;
        }

        const float noiseSum = currentNoiseWhite_ + currentNoisePink_ + currentNoiseBrown_;
        float noiseMono = 0.0f;
        if (outputGate_ > 0.00005f && noiseSum > 0.00005f) {
            noiseMono = nextNoiseSample();
        }

        const bool noiseActive = noiseSum > 0.00005f && std::abs(noiseMono) > 0.00001f;
        const float targetDuck = noiseActive ? 0.72f : 1.0f;
        currentToneDuck_ += smoothAlpha_ * (targetDuck - currentToneDuck_);

        outL = (outL * currentToneDuck_ + noiseMono) * outputGate_;
        outR = (outR * currentToneDuck_ + noiseMono) * outputGate_;

        outL = softLimit(outL, kPeakCeilingLinear);
        outR = softLimit(outR, kPeakCeilingLinear);

        outL = dcBlock(outL, dcStateL_, dcBlockL_);
        outR = dcBlock(outR, dcStateR_, dcBlockR_);

        // TEMP POPTRACE: flag any large sample-to-sample jump while the gate is
        // open (ignores the intentional fade-in/out). A pop == discontinuity.
        if (outputGate_ > 0.5f) {
            const float dL = outL - diagPrevOutL_;
            const float dR = outR - diagPrevOutR_;
            const float jump = std::max(std::abs(dL), std::abs(dR));
            // Single writer (audio thread) — plain load/store is safe for diag.
            if (jump > diag::g_maxJump.load(std::memory_order_relaxed)) {
                diag::g_maxJump.store(jump, std::memory_order_relaxed);
            }
            if (jump > 0.05f) {
                diag::g_glitchCount.fetch_add(1, std::memory_order_relaxed);
                diag::g_lastGlitchDelta.store(jump, std::memory_order_relaxed);
                diag::g_lastGlitchFrame.store(
                    diag::g_frameCounter.load(std::memory_order_relaxed) +
                        static_cast<uint64_t>(i),
                    std::memory_order_relaxed);
            }
        }
        diagPrevOutL_ = outL;
        diagPrevOutR_ = outR;

        output[i * 2] = outL;
        output[i * 2 + 1] = outR;
    }

    diag::g_frameCounter.fetch_add(static_cast<uint64_t>(frameCount),
                                   std::memory_order_relaxed);
}

} // namespace hertz
