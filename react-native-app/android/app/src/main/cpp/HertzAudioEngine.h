#pragma once

// HertzAudioEngine.h — Oboe stream engine for binaural beat generation.
//
// Implements both Oboe data and error callbacks.  All audio DSP work is
// delegated to BinauralOscillator; this class owns the stream lifecycle only.
// The render path (onAudioReady) performs no allocations, no locks, no logging.

#include "BinauralOscillator.h"
#include "ParameterBox.h"

#include <memory>
#include <oboe/Oboe.h>

class HertzAudioEngine final
    : public oboe::AudioStreamDataCallback,
      public oboe::AudioStreamErrorCallback {
public:
    HertzAudioEngine();
    ~HertzAudioEngine() override;

    // Open the Oboe stream and begin playback.
    // Returns true if the stream opened and started successfully.
    bool start();

    // Stop and close the Oboe stream.
    void stop();

    // Publish new binaural parameters to the lock-free ParameterBox.
    // Safe to call from any thread; never touches the render thread directly.
    void setParameters(double carrierHz, double beatHz, float gain, float balance);

    // ── Oboe data callback (real-time audio thread) ───────────────────────────
    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* audioStream,
        void*              audioData,
        int32_t            numFrames) override;

    // ── Oboe error callback (called on a non-render thread after stream closes) ─
    void onErrorAfterClose(
        oboe::AudioStream* audioStream,
        oboe::Result       error) override;

private:
    std::shared_ptr<oboe::AudioStream> stream_;
    ParameterBox                       paramBox_;
    BinauralOscillator                 oscillator_;

    // Pre-allocated per-channel work buffers — avoids any heap allocation inside
    // onAudioReady.  4096 frames covers all realistic low-latency burst sizes.
    static constexpr int32_t kMaxFrames = 4096;
    float tempL_[kMaxFrames];
    float tempR_[kMaxFrames];
};
