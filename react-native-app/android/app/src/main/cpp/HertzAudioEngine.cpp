#include "HertzAudioEngine.h"

#include <algorithm>
#include <thread>

namespace hertz {

// ---------------------------------------------------------------------------
HertzAudioEngine::HertzAudioEngine() = default;

HertzAudioEngine::~HertzAudioEngine() {
    stop();
}

// ---------------------------------------------------------------------------
bool HertzAudioEngine::configure(int32_t requestedSampleRate,
                                 int32_t requestedBufferFrames,
                                 bool    allowSharedFallback) {
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    allowSharedFallback_.store(allowSharedFallback, std::memory_order_relaxed);
    closeStreamLocked();
    if (!openStreamLocked(requestedSampleRate, requestedBufferFrames)) {
        state_.store(EngineState::Error, std::memory_order_release);
        return false;
    }
    state_.store(EngineState::Ready, std::memory_order_release);
    return true;
}

// ---------------------------------------------------------------------------
bool HertzAudioEngine::play() {
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    if (!stream_) {
        if (!openStreamLocked(actualSampleRate_.load(std::memory_order_relaxed), 0)) {
            state_.store(EngineState::Error, std::memory_order_release);
            return false;
        }
    }
    parameterBox_.setPlayIntent(true);
    state_.store(EngineState::Starting, std::memory_order_release);
    if (stream_->requestStart() != oboe::Result::OK) {
        state_.store(EngineState::Error, std::memory_order_release);
        return false;
    }
    state_.store(EngineState::Playing, std::memory_order_release);
    return true;
}

// ---------------------------------------------------------------------------
void HertzAudioEngine::pause() {
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    // Signal the oscillator to ramp gain to zero.  The stream is paused
    // immediately after; any residual samples in the driver buffer will be
    // near-silent because gain ramps toward zero from this quantum onward.
    parameterBox_.setPlayIntent(false);
    state_.store(EngineState::Pausing, std::memory_order_release);
    if (stream_) {
        stream_->requestPause();
    }
    state_.store(EngineState::Paused, std::memory_order_release);
}

// ---------------------------------------------------------------------------
void HertzAudioEngine::stop() {
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    parameterBox_.setPlayIntent(false);
    state_.store(EngineState::Stopping, std::memory_order_release);
    closeStreamLocked();
    state_.store(EngineState::Stopped, std::memory_order_release);
}

// ---------------------------------------------------------------------------
bool HertzAudioEngine::setBinauralParameters(double carrierHz, double beatHz,
                                              float gain, float balance) {
    const bool playIntent = parameterBox_.snapshot().playIntent;
    return parameterBox_.publish(carrierHz, beatHz, gain, balance,
                                 kDefaultRampMs, playIntent);
}

void HertzAudioEngine::setNoiseLevel(float level) {
    parameterBox_.setNoiseLevel(level);
    noiseGenerator_.setLevel(level);
}

void HertzAudioEngine::fade(float toGain, int32_t durationMs) {
    const ParameterSnapshot cur = parameterBox_.snapshot();
    parameterBox_.publish(cur.carrierHz, cur.beatHz, toGain, cur.balance,
                          static_cast<double>(durationMs), cur.playIntent);
}

// ---------------------------------------------------------------------------
// Accessors (lock-free reads from atomic fields)
// ---------------------------------------------------------------------------
EngineState HertzAudioEngine::state() const noexcept {
    return state_.load(std::memory_order_acquire);
}

int32_t HertzAudioEngine::sampleRate() const noexcept {
    return actualSampleRate_.load(std::memory_order_acquire);
}

int32_t HertzAudioEngine::framesPerBurst() const noexcept {
    return actualFramesPerBurst_.load(std::memory_order_acquire);
}

int32_t HertzAudioEngine::bufferSizeInFrames() const noexcept {
    return actualBufferSize_.load(std::memory_order_acquire);
}

// xRunCount() accesses stream_ which is lifecycle-mutex-protected.
int32_t HertzAudioEngine::xRunCount() const {
    std::lock_guard<std::mutex> lock(lifecycleMutex_);
    return stream_ ? stream_->getXRunCount() : 0;
}

// ---------------------------------------------------------------------------
// Render callback — real-time thread
// ---------------------------------------------------------------------------
oboe::DataCallbackResult HertzAudioEngine::onAudioReady(
    oboe::AudioStream *audioStream,
    void              *audioData,
    int32_t            numFrames)
{
    // Verify stream format matches what we requested.  If not, the stream
    // has been reopened with incompatible settings — stop rendering.
    if (audioStream->getFormat()       != oboe::AudioFormat::Float ||
        audioStream->getChannelCount() != oboe::ChannelCount::Stereo) {
        return oboe::DataCallbackResult::Stop;
    }

    // Read one parameter snapshot for the entire quantum (Plan 02 §2.1).
    // No locks, no JNI, no logging inside this path.
    auto *output           = static_cast<float *>(audioData);
    const ParameterSnapshot snap = parameterBox_.snapshot();
    oscillator_.render(output, numFrames, snap);
    return oboe::DataCallbackResult::Continue;
}

// ---------------------------------------------------------------------------
// Error callbacks — called on Oboe's error-handling thread
// ---------------------------------------------------------------------------

// Called before the stream is closed.  Mark the engine state and return true
// to allow Oboe to proceed with closing the stream.
bool HertzAudioEngine::onError(oboe::AudioStream * /*audioStream*/,
                                oboe::Result       /*error*/) {
    state_.store(EngineState::Interrupted, std::memory_order_release);
    return true;   // let Oboe close the stream
}

// Called after Oboe has fully closed the disconnected stream.
// Schedules a stream restart on a detached thread (Plan 02 §8.2).
// The detached thread takes lifecycleMutex_ independently; onErrorAfterClose
// must return quickly to not block the Oboe error-handling thread.
void HertzAudioEngine::onErrorAfterClose(oboe::AudioStream * /*audioStream*/,
                                          oboe::Result       /*error*/) {
    restartFromError();
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

bool HertzAudioEngine::openStreamLocked(int32_t requestedSampleRate,
                                         int32_t requestedBufferFrames) {
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Output)
           ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
           ->setSharingMode(oboe::SharingMode::Exclusive)
           ->setFormat(oboe::AudioFormat::Float)
           ->setChannelCount(oboe::ChannelCount::Stereo)
           ->setDataCallback(this)
           ->setErrorCallback(this);

    if (requestedSampleRate > 0) {
        builder.setSampleRate(requestedSampleRate);
    }

    auto result = builder.openStream(stream_);

    // If exclusive mode is denied and the caller has opted in to a fallback,
    // retry with shared low-latency mode (Plan 02 §4.1 open decision).
    if (result != oboe::Result::OK &&
        allowSharedFallback_.load(std::memory_order_relaxed)) {
        builder.setSharingMode(oboe::SharingMode::Shared);
        result = builder.openStream(stream_);
    }

    if (result != oboe::Result::OK || !stream_) {
        return false;
    }

    // Ingest actual stream variables to drive the rendering canvas
    // and surface accurate latency info to JS (Plan 02 §4.1, §10.2).
    const int32_t actualRate  = stream_->getSampleRate();
    const int32_t burstFrames = stream_->getFramesPerBurst();

    actualSampleRate_.store(actualRate,  std::memory_order_release);
    actualFramesPerBurst_.store(burstFrames, std::memory_order_release);
    oscillator_.setSampleRate(static_cast<double>(actualRate));

    // Buffer size: caller hint > 0 overrides; otherwise default to 2 bursts.
    const int32_t targetSize = (requestedBufferFrames > 0)
                               ? requestedBufferFrames
                               : std::max(1, burstFrames) * 2;
    stream_->setBufferSizeInFrames(targetSize);
    actualBufferSize_.store(stream_->getBufferSizeInFrames(),
                             std::memory_order_release);
    return true;
}

void HertzAudioEngine::closeStreamLocked() {
    if (stream_) {
        stream_->requestStop();
        stream_->close();
        stream_.reset();
    }
}

// Restarts the stream on a detached background thread after a disconnect.
// The thread captures `this`; HertzAudioEngine must outlive the thread.
// In practice, the JNI layer holds the engine alive for the app lifetime.
void HertzAudioEngine::restartFromError() {
    std::thread([this] {
        std::lock_guard<std::mutex> lock(lifecycleMutex_);
        state_.store(EngineState::Rebuilding, std::memory_order_release);
        closeStreamLocked();

        if (openStreamLocked(actualSampleRate_.load(std::memory_order_relaxed), 0)) {
            const bool wasPlaying = parameterBox_.snapshot().playIntent;
            if (wasPlaying && stream_->requestStart() == oboe::Result::OK) {
                state_.store(EngineState::Playing, std::memory_order_release);
            } else {
                state_.store(EngineState::Ready, std::memory_order_release);
            }
        } else {
            state_.store(EngineState::Error, std::memory_order_release);
        }
    }).detach();
}

} // namespace hertz
