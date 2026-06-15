#include "../HertzAudioEngine.h"

#include <jni.h>
#include <memory>

// ---------------------------------------------------------------------------
// Singleton engine instance.
//
// The engine is created lazily on the first JNI call and persists for the
// process lifetime.  All allocation happens on the calling control thread —
// never inside the audio render callback.
//
// No JVM allocations, no logging, and no exception throws may appear in any
// code path reachable from the audio render callback (Plan 02 §2.3).
// This file is the boundary; enforce that rule here at the call site level.
// ---------------------------------------------------------------------------
namespace {

std::unique_ptr<hertz::HertzAudioEngine> gEngine;

hertz::HertzAudioEngine &engine() {
    if (!gEngine) {
        gEngine = std::make_unique<hertz::HertzAudioEngine>();
    }
    return *gEngine;
}

// Map the C++ EngineState enum to a stable integer value for Java/Kotlin.
// Matches the EngineState enum order declared in HertzAudioEngine.h.
jint engineStateToInt(hertz::EngineState s) noexcept {
    return static_cast<jint>(s);
}

} // namespace

// ---------------------------------------------------------------------------
// Stream lifecycle
// ---------------------------------------------------------------------------

extern "C" JNIEXPORT jboolean JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeConfigure(
    JNIEnv * /*env*/,
    jclass   /*cls*/,
    jdouble  sampleRate,
    jdouble  bufferDurationMs)
{
    const auto frames = static_cast<int32_t>(sampleRate * bufferDurationMs / 1000.0);
    return static_cast<jboolean>(
        engine().configure(static_cast<int32_t>(sampleRate), frames, /*allowSharedFallback=*/false)
    );
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativePlay(
    JNIEnv * /*env*/,
    jclass   /*cls*/)
{
    return static_cast<jboolean>(engine().play());
}

extern "C" JNIEXPORT void JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativePause(
    JNIEnv * /*env*/,
    jclass   /*cls*/)
{
    engine().pause();
}

extern "C" JNIEXPORT void JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeStop(
    JNIEnv * /*env*/,
    jclass   /*cls*/)
{
    engine().stop();
}

// ---------------------------------------------------------------------------
// Parameter updates (lock-free path through ParameterBox)
// ---------------------------------------------------------------------------

extern "C" JNIEXPORT jboolean JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeSetBinauralParameters(
    JNIEnv * /*env*/,
    jclass   /*cls*/,
    jdouble  carrierHz,
    jdouble  beatHz,
    jdouble  gain,
    jdouble  balance)
{
    return static_cast<jboolean>(
        engine().setBinauralParameters(
            carrierHz,
            beatHz,
            static_cast<float>(gain),
            static_cast<float>(balance)
        )
    );
}

extern "C" JNIEXPORT void JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeSetPhaseAndTiming(
    JNIEnv * /*env*/,
    jclass   /*cls*/,
    jdouble  phaseAngleDeg,
    jdouble  timingDiffMs)
{
    engine().setPhaseAndTiming(phaseAngleDeg, timingDiffMs);
}

extern "C" JNIEXPORT void JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeSetNoiseLayers(
    JNIEnv * /*env*/,
    jclass   /*cls*/,
    jdouble  white,
    jdouble  pink,
    jdouble  brown)
{
    engine().setNoiseLayers(
        static_cast<float>(white),
        static_cast<float>(pink),
        static_cast<float>(brown));
}

extern "C" JNIEXPORT void JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeSetNoiseLevel(
    JNIEnv * /*env*/,
    jclass   /*cls*/,
    jdouble  level)
{
    engine().setNoiseLevel(static_cast<float>(level));
}

extern "C" JNIEXPORT void JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeFade(
    JNIEnv * /*env*/,
    jclass   /*cls*/,
    jdouble  toGain,
    jint     durationMs)
{
    engine().fade(static_cast<float>(toGain), static_cast<int32_t>(durationMs));
}

// ---------------------------------------------------------------------------
// Stream variable queries
// Kotlin uses these to mirror actual hardware stream config back to the JS
// engine-state store (Plan 02 §10.2).
// ---------------------------------------------------------------------------

extern "C" JNIEXPORT jint JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeSampleRate(
    JNIEnv * /*env*/,
    jclass   /*cls*/)
{
    return static_cast<jint>(engine().sampleRate());
}

extern "C" JNIEXPORT jint JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeFramesPerBurst(
    JNIEnv * /*env*/,
    jclass   /*cls*/)
{
    return static_cast<jint>(engine().framesPerBurst());
}

extern "C" JNIEXPORT jint JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeBufferSizeInFrames(
    JNIEnv * /*env*/,
    jclass   /*cls*/)
{
    return static_cast<jint>(engine().bufferSizeInFrames());
}

extern "C" JNIEXPORT jint JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeXRunCount(
    JNIEnv * /*env*/,
    jclass   /*cls*/)
{
    return static_cast<jint>(engine().xRunCount());
}

// Returns the current EngineState as the integer ordinal defined in
// HertzAudioEngine.h (Uninitialized=0 … Error=10).
extern "C" JNIEXPORT jint JNICALL
Java_com_hertzlabs_binauralbeats_audio_HertzAudioModule_nativeEngineState(
    JNIEnv * /*env*/,
    jclass   /*cls*/)
{
    return engineStateToInt(engine().state());
}
