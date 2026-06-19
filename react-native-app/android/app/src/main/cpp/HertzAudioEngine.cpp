#include "HertzAudioEngine.h"

#include <algorithm>
#include <chrono>
#include <thread>
#include <android/log.h>

namespace hertz {

// TEMP POPTRACE diagnostics defined in BinauralOscillator.cpp.
namespace diag {
extern std::atomic<uint64_t> g_frameCounter;
extern std::atomic<uint64_t> g_glitchCount;
extern std::atomic<float> g_lastGlitchDelta;
extern std::atomic<uint64_t> g_lastGlitchFrame;
extern std::atomic<float> g_maxJump;
}

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
    state_.store(EngineState::Starting, std::memory_order_release);
    if (stream_->getState() != oboe::StreamState::Started &&
        stream_->requestStart() != oboe::Result::OK) {
        state_.store(EngineState::Error, std::memory_order_release);
        return false;
    }
    const ParameterSnapshot snap = parameterBox_.snapshot();
    if (snap.playIntent == false) {
        oscillator_.snapSmoothedStateTo(snap);
    }
    // Hold silence for ~300ms so any residual system-side pipeline settling
    // (AAudio volume ramps, HAL initialisation) happens before audio is audible.
    oscillator_.armStartupSilence(
        static_cast<int32_t>(actualSampleRate_.load(std::memory_order_relaxed) * 0.30f));
    parameterBox_.setPlayIntent(true);
    state_.store(EngineState::Playing, std::memory_order_release);

    // TEMP POPTRACE: monitor xRun + signal discontinuities for the first few seconds.
    diag::g_glitchCount.store(0, std::memory_order_relaxed);
    diag::g_maxJump.store(0.0f, std::memory_order_relaxed);
    std::thread([this] {
        const double rate = std::max(1, actualSampleRate_.load(std::memory_order_relaxed));
        uint64_t lastGlitch = 0;
        for (int i = 0; i < 40; ++i) {
            int32_t xr = -1;
            {
                std::lock_guard<std::mutex> lk(lifecycleMutex_);
                if (stream_) {
                    xr = stream_->getXRunCount().value();
                }
            }
            const uint64_t gc = diag::g_glitchCount.load(std::memory_order_relaxed);
            if (gc != lastGlitch) {
                lastGlitch = gc;
                const uint64_t frame = diag::g_lastGlitchFrame.load(std::memory_order_relaxed);
                const float delta = diag::g_lastGlitchDelta.load(std::memory_order_relaxed);
                __android_log_print(ANDROID_LOG_WARN, "POPTRACE_NATIVE",
                    "*** GLITCH count=%llu atFrame=%llu (%.0fms) jump=%.4f xrun=%d",
                    static_cast<unsigned long long>(gc),
                    static_cast<unsigned long long>(frame),
                    1000.0 * static_cast<double>(frame) / rate, delta, xr);
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
        __android_log_print(ANDROID_LOG_INFO, "POPTRACE_NATIVE",
            "monitor done totalGlitches=%llu maxJump=%.5f rate=%d",
            static_cast<unsigned long long>(diag::g_glitchCount.load(std::memory_order_relaxed)),
            diag::g_maxJump.load(std::memory_order_relaxed),
            actualSampleRate_.load(std::memory_order_relaxed));
    }).detach();

    return true;
}

// ---------------------------------------------------------------------------
void HertzAudioEngine::pause() {
    // Mute via playIntent + gain ramp only. Do not requestPause() — stopping the
    // Oboe stream causes an audible click on resume on many devices.
    parameterBox_.setPlayIntent(false);
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

void HertzAudioEngine::setPhaseAndTiming(double phaseAngleDeg, double timingDiffMs) {
    parameterBox_.setPhaseAndTiming(phaseAngleDeg, timingDiffMs);
}

void HertzAudioEngine::setNoiseLevel(float level) {
    parameterBox_.setNoiseLevel(level);
}

void HertzAudioEngine::setNoiseLayers(float white, float pink, float brown) {
    parameterBox_.setNoiseLayers(white, pink, brown);
}

void HertzAudioEngine::setBreathPacer(bool enabled, int patternId, float deltaDb) {
    parameterBox_.setBreathPacer(enabled, patternId, deltaDb);
}

void HertzAudioEngine::fade(float toGain, int32_t durationMs) {
    const ParameterSnapshot cur = parameterBox_.snapshot();
    parameterBox_.publish(cur.targetCarrierHz, cur.targetBeatHz, toGain, cur.targetBalance,
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
    return stream_ ? stream_->getXRunCount().value() : 0;
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

    auto *output = static_cast<float *>(audioData);
    oscillator_.render(output, numFrames, parameterBox_);
    return oboe::DataCallbackResult::Continue;
}

// ---------------------------------------------------------------------------
// Error callbacks — called on Oboe's error-handling thread
// ---------------------------------------------------------------------------

// Called before the stream is closed.  Mark the engine state and return true
// to allow Oboe to proceed with closing the stream.
bool HertzAudioEngine::onError(oboe::AudioStream * /*audioStream*/,
                                oboe::Result       error) {
    // #region agent log
    __android_log_print(ANDROID_LOG_WARN, "POPTRACE_NATIVE",
        "*** onError result=%d (%s) — stream being closed", static_cast<int>(error),
        oboe::convertToText(error));
    // #endregion
    state_.store(EngineState::Interrupted, std::memory_order_release);
    return true;   // let Oboe close the stream
}

// Called after Oboe has fully closed the disconnected stream.
// Schedules a stream restart on a detached thread (Plan 02 §8.2).
// The detached thread takes lifecycleMutex_ independently; onErrorAfterClose
// must return quickly to not block the Oboe error-handling thread.
void HertzAudioEngine::onErrorAfterClose(oboe::AudioStream * /*audioStream*/,
                                          oboe::Result       error) {
    // #region agent log
    __android_log_print(ANDROID_LOG_WARN, "POPTRACE_NATIVE",
        "*** onErrorAfterClose result=%d — scheduling restart", static_cast<int>(error));
    // #endregion
    restartFromError();
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

bool HertzAudioEngine::openStreamLocked(int32_t requestedSampleRate,
                                         int32_t requestedBufferFrames) {
    oboe::AudioStreamBuilder builder;
    // PerformanceMode::None forces the normal AudioFlinger mixer path, avoiding
    // the MMAP exclusive fast-path "HAL settling" pop that Samsung devices
    // produce ~700ms after a new MMAP session starts.  For a continuous-tone app
    // the ~30ms extra latency of the mixer path is inaudible and irrelevant.
    //
    // Usage::Game bypasses Samsung's Dolby Atmos EffectManager, which otherwise
    // reconfigures its effect chain ~660–700ms after the first audio of a new
    // non-game session, producing a second potential pop.
    //
    // SharingMode::Shared is consistent with the normal mixer path and prevents
    // MMAP-exclusive allocation on devices that tie LowLatency to Shared MMAP.
    builder.setDirection(oboe::Direction::Output)
           ->setPerformanceMode(oboe::PerformanceMode::None)
           ->setSharingMode(oboe::SharingMode::Shared)
           ->setUsage(oboe::Usage::Game)
           ->setFormat(oboe::AudioFormat::Float)
           ->setChannelCount(oboe::ChannelCount::Stereo)
           ->setDataCallback(this)
           ->setErrorCallback(this);

    if (requestedSampleRate > 0) {
        builder.setSampleRate(requestedSampleRate);
    }

    auto result = builder.openStream(stream_);

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
                               : std::max(1, burstFrames) * 3;
    stream_->setBufferSizeInFrames(targetSize);
    actualBufferSize_.store(stream_->getBufferSizeInFrames(),
                             std::memory_order_release);

    // TEMP POPTRACE: confirm the granted sharing/perf mode + usage/contentType.
    __android_log_print(ANDROID_LOG_INFO, "POPTRACE_NATIVE",
        "stream opened: sharing=%d perf=%d usage=%d content=%d rate=%d burst=%d",
        static_cast<int>(stream_->getSharingMode()),
        static_cast<int>(stream_->getPerformanceMode()),
        static_cast<int>(stream_->getUsage()),
        static_cast<int>(stream_->getContentType()),
        actualRate, burstFrames);

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
