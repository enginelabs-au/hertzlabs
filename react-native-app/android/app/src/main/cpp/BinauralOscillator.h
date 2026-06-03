#pragma once

#include "ParameterBox.h"
#include <cstdint>

namespace hertz {

// ---------------------------------------------------------------------------
// BinauralOscillator
//
// Renders one stereo sine-wave buffer per audio quantum.
//
// Thread ownership: instance is owned exclusively by the audio render
// callback (HertzAudioEngine::onAudioReady).  No other thread may call
// render() concurrently.  setSampleRate() must be called from the control
// thread before the stream starts and never during active rendering.
// ---------------------------------------------------------------------------
class BinauralOscillator {
public:
    // Must be called once with the stream's actual sample rate before the
    // first render() call.  Safe to call from the control thread.
    void setSampleRate(double sampleRate);

    // Fill `output` with `frameCount` interleaved stereo float32 frames.
    // Reads target parameters from `snapshot` (obtained once per quantum
    // by the engine).  Applies audio-rate linear ramps for all parameters
    // and enforces the -6 dBFS ceiling in a dedicated final pass.
    void render(float *output, int32_t frameCount, const ParameterSnapshot &snapshot);

private:
    // Stream configuration.
    double sampleRate_ = 48000.0;

    // Independent phase accumulators — double precision to minimise
    // long-session drift (Plan 02 §1.2).  Never reset on frequency changes.
    double leftPhase_  = 0.0;
    double rightPhase_ = 0.0;

    // Current (in-flight) parameter values being rendered this quantum.
    double currentCarrierHz_ = 220.0;
    double currentBeatHz_    = 10.0;
    float  currentGain_      = 0.0f;
    float  currentBalance_   = 0.0f;

    // Target values for the active ramp.
    double targetCarrierHz_ = 220.0;
    double targetBeatHz_    = 10.0;
    float  targetGain_      = 0.0f;
    float  targetBalance_   = 0.0f;

    // Per-sample step deltas (linear ramp, Plan 02 §5.2).
    double carrierStep_  = 0.0;
    double beatStep_     = 0.0;
    float  gainStep_     = 0.0f;
    float  balanceStep_  = 0.0f;

    int32_t  rampSamplesRemaining_ = 0;
    uint64_t observedGeneration_   = 0;

    // Compute new ramp descriptors from a freshly observed snapshot.
    void prepareRamp(const ParameterSnapshot &snapshot);

    // Advance all ramped values by one sample.
    void advanceRamp() noexcept;

    // Wrap a phase value into [0, 2π).
    double wrapPhase(double phase) const noexcept;
};

} // namespace hertz
