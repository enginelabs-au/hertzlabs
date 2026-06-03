#include "BinauralOscillator.h"

#include <algorithm>
#include <cmath>

// ─── Constants ────────────────────────────────────────────────────────────────

static constexpr double kTwoPi          = 2.0 * M_PI;
static constexpr double kRampDurationSec = 0.075;       // 75 ms — within the 50-100 ms window
static constexpr float  kPeakCeiling    = 0.501187f;    // −6 dBFS hard ceiling

// ─── BinauralOscillator::process ─────────────────────────────────────────────

void BinauralOscillator::process(float* outputL, float* outputR,
                                 int32_t numFrames, const AudioParams& target) {

    // ── Step 1: derive target L/R frequencies from the snapshot ONCE per quantum.
    // These represent where the oscillators are heading; we do not use them
    // directly in the per-sample loop — the smoothed carrier/beat are the live
    // state — but computing them here documents the intended steady-state.
    [[maybe_unused]] const double targetLeftHz  = target.carrierHz - target.beatHz / 2.0;
    [[maybe_unused]] const double targetRightHz = target.carrierHz + target.beatHz / 2.0;

    // ── Step 2: derive current L/R frequencies from smoothed values.
    double leftHz  = currentCarrierHz - currentBeatHz / 2.0;
    double rightHz = currentCarrierHz + currentBeatHz / 2.0;

    // ── Smoothing coefficient — computed ONCE per quantum (constant for a given
    //    sampleRate + rampDuration; recomputing per-sample would be wasteful and
    //    violates the spec directive).
    const double smoothingCoeff = 1.0 / (sampleRate * kRampDurationSec);

    // ── Per-sample loop ────────────────────────────────────────────────────────
    for (int32_t i = 0; i < numFrames; ++i) {

        // Step 3a: one-pole smooth each parameter toward its target.
        currentCarrierHz += (target.carrierHz                  - currentCarrierHz) * smoothingCoeff;
        currentBeatHz    += (target.beatHz                     - currentBeatHz)    * smoothingCoeff;
        currentGain      += (target.gain      - currentGain)   * static_cast<float>(smoothingCoeff);
        currentBalance   += (target.balance   - currentBalance) * static_cast<float>(smoothingCoeff);

        // Step 3b: recompute L/R frequencies from the newly smoothed carrier/beat.
        leftHz  = currentCarrierHz - currentBeatHz / 2.0;
        rightHz = currentCarrierHz + currentBeatHz / 2.0;

        // Step 3c: advance phase accumulators.
        leftPhase  += (kTwoPi * leftHz)  / sampleRate;
        rightPhase += (kTwoPi * rightHz) / sampleRate;

        // Step 3d: wrap phases into [0, 2π) using subtraction — avoids the
        //          division inherent in fmod on the real-time render path.
        if (leftPhase  >= kTwoPi) leftPhase  -= kTwoPi;
        if (rightPhase >= kTwoPi) rightPhase -= kTwoPi;

        // Step 3e: generate raw samples.
        const float rawL = currentGain * sinf(static_cast<float>(leftPhase));
        const float rawR = currentGain * sinf(static_cast<float>(rightPhase));

        // Step 3f: apply linear stereo balance.
        //   balance = -1.0 → full left;  0.0 → centre;  +1.0 → full right.
        const float leftLevel  = 1.0f - std::max(0.0f, currentBalance);
        const float rightLevel = 1.0f + std::min(0.0f, currentBalance);

        outputL[i] = rawL * leftLevel;
        outputR[i] = rawR * rightLevel;
    }

    // ── Step 4: hard gain-ceiling clamp on the entire output arrays.
    //    Applied after the loop so the balance computation above does not
    //    interact with the clamp logic per-sample.
    for (int32_t i = 0; i < numFrames; ++i) {
        if (outputL[i] >  kPeakCeiling)  outputL[i] =  kPeakCeiling;
        if (outputL[i] < -kPeakCeiling)  outputL[i] = -kPeakCeiling;
        if (outputR[i] >  kPeakCeiling)  outputR[i] =  kPeakCeiling;
        if (outputR[i] < -kPeakCeiling)  outputR[i] = -kPeakCeiling;
    }
}
