#pragma once

#include "BreathPacer.h"
#include "ParameterBox.h"
#include <cstdint>

namespace hertz {

class BinauralOscillator {
public:
    void setSampleRate(double sampleRate);

    /** Align smoothed render state to targets (avoids stale ramps after app resume). */
    void snapSmoothedStateTo(const ParameterSnapshot &snapshot);

    /**
     * Hold the output gate at zero for the given number of samples from the
     * next play() call.  This ensures any system-side pipeline settling
     * (MMAP HAL, Samsung EffectManager) happens in silence before the gate
     * opens.
     */
    void armStartupSilence(int32_t frames) noexcept;

    void render(float *output, int32_t frameCount, const ParameterBox &params);

private:
    double sampleRate_ = 48000.0;
    float smoothAlpha_ = 0.001f;
    float silenceSmoothAlpha_ = 0.01f;
    float noiseSmoothAlpha_ = 0.002f;

    double carrierPhase_ = 0.0;
    double beatPhase_ = 0.0;

    double currentCarrierHz_ = 220.0;
    double currentBeatHz_ = 10.0;
    float currentGain_ = 0.0f;
    float currentBalance_ = 0.0f;
    double currentPhaseAngleRad_ = 0.0;
    float currentNoiseWhite_ = 0.0f;
    float currentNoisePink_ = 0.0f;
    float currentNoiseBrown_ = 0.0f;
    float currentToneDuck_ = 1.0f;
    float outputGate_ = 0.0f;

    // Counts down (per render sample) after armStartupSilence() is called.
    // Gate stays at zero while this is positive.
    int32_t startupHoldFrames_ = 0;

    float dcStateL_ = 0.0f;
    float dcBlockL_ = 0.0f;
    float dcStateR_ = 0.0f;
    float dcBlockR_ = 0.0f;

    float diagPrevOutL_ = 0.0f;
    float diagPrevOutR_ = 0.0f;

    int targetModeCode_ = 0;
    int renderModeCode_ = 0;
    float modeCrossfadeT_ = 1.0f;
    float modeCrossfadeAlpha_ = 0.001f;

    void advancePhases(int modeCode) noexcept;
    void computeRawStereo(int modeCode,
                          double &rawLeft,
                          double &rawRight) const noexcept;

    uint32_t rngState_ = 0xA3C59AC3u;
    float pinkB0_ = 0.0f;
    float pinkB1_ = 0.0f;
    float pinkB2_ = 0.0f;
    float pinkB3_ = 0.0f;
    float pinkB4_ = 0.0f;
    float pinkB5_ = 0.0f;
    float pinkB6_ = 0.0f;
    float brownState_ = 0.0f;

    BreathPacer breathPacer_;
    uint64_t lastBreathGeneration_ = 0;

    void syncTargets(const ParameterSnapshot &snapshot);
    float nextNoiseSample();
    float dcBlock(float sample, float &state, float &blocked);
};

} // namespace hertz
