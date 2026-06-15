#pragma once

#include "BinauralOscillator.h"
#include "ParameterBox.h"

#include <atomic>
#include <memory>
#include <mutex>
#include <oboe/Oboe.h>

namespace hertz {

enum class EngineState : int {
    Uninitialized = 0,
    Ready,
    Starting,
    Playing,
    Pausing,
    Paused,
    Stopping,
    Stopped,
    Interrupted,
    Rebuilding,
    Error
};

class HertzAudioEngine final
    : public oboe::AudioStreamDataCallback,
      public oboe::AudioStreamErrorCallback {
public:
    HertzAudioEngine();
    ~HertzAudioEngine() override;

    bool configure(int32_t requestedSampleRate,
                   int32_t requestedBufferFrames,
                   bool allowSharedFallback);
    bool play();
    void pause();
    void stop();

    bool setBinauralParameters(double carrierHz,
                               double beatHz,
                               float gain,
                               float balance);
    void setPhaseAndTiming(double phaseAngleDeg, double timingDiffMs);
    void setNoiseLevel(float level);
    void setNoiseLayers(float white, float pink, float brown);
    void fade(float toGain, int32_t durationMs);

    EngineState state() const noexcept;
    int32_t sampleRate() const noexcept;
    int32_t framesPerBurst() const noexcept;
    int32_t bufferSizeInFrames() const noexcept;
    int32_t xRunCount() const;

    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream *audioStream,
        void *audioData,
        int32_t numFrames) override;

    bool onError(oboe::AudioStream *audioStream, oboe::Result error) override;

    void onErrorAfterClose(
        oboe::AudioStream *audioStream,
        oboe::Result error) override;

private:
    bool openStreamLocked(int32_t requestedSampleRate, int32_t requestedBufferFrames);
    void closeStreamLocked();
    void restartFromError();

    mutable std::mutex lifecycleMutex_;
    std::atomic<bool> allowSharedFallback_{false};
    std::atomic<EngineState> state_{EngineState::Uninitialized};
    ParameterBox parameterBox_;
    std::shared_ptr<oboe::AudioStream> stream_;
    BinauralOscillator oscillator_;
    std::atomic<int32_t> actualSampleRate_{0};
    std::atomic<int32_t> actualFramesPerBurst_{0};
    std::atomic<int32_t> actualBufferSize_{0};
};

} // namespace hertz
