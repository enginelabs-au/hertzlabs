package com.hertzlabs.binauralbeats.audio

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.turbomodule.core.interfaces.TurboModule

class HertzAudioModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), TurboModule {

    override fun getName(): String = NAME

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configure(sampleRate: Double, bufferDurationMs: Double) {
        nativeConfigure(sampleRate, bufferDurationMs)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun play() {
        nativePlay()
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun pause() {
        nativePause()
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun stop() {
        nativeStop()
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun setBinauralParameters(
        carrierHz: Double,
        beatHz: Double,
        gain: Double,
        balance: Double,
        noiseWhite: Double,
        noisePink: Double,
        noiseBrown: Double,
    ) {
        nativeSetBinauralParameters(carrierHz, beatHz, gain, balance)
        nativeSetNoiseLayers(noiseWhite, noisePink, noiseBrown)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun setNoise(type: String, level: Double) {
        when (type) {
            "pink" -> nativeSetNoiseLayers(0.0, level, 0.0)
            "brown" -> nativeSetNoiseLayers(0.0, 0.0, level)
            "none" -> nativeSetNoiseLayers(0.0, 0.0, 0.0)
            else -> nativeSetNoiseLayers(level, 0.0, 0.0)
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun setNoiseLayers(white: Double, pink: Double, brown: Double) {
        nativeSetNoiseLayers(white, pink, brown)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun fade(toGain: Double, durationMs: Double) {
        nativeFade(toGain, durationMs.toInt())
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun setPhaseAndTiming(phase: Double, timingMs: Double) {
        nativeSetPhaseAndTiming(phase, timingMs)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun loadPreset(presetJson: String) {
        // Preset decoding remains in TypeScript for the scaffold; native remains parameter-authoritative.
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun setBackgroundPlaybackEnabled(enabled: Boolean) {
        // iOS AudioSessionController; Android uses HertzAudioService when foreground service is started.
    }

    companion object {
        const val NAME = "HertzAudio"

        init {
            System.loadLibrary("hertz_audio")
        }

        @JvmStatic private external fun nativeConfigure(sampleRate: Double, bufferDurationMs: Double): Boolean
        @JvmStatic private external fun nativePlay(): Boolean
        @JvmStatic private external fun nativePause()
        @JvmStatic private external fun nativeStop()
        @JvmStatic private external fun nativeSetBinauralParameters(
            carrierHz: Double,
            beatHz: Double,
            gain: Double,
            balance: Double
        ): Boolean
        @JvmStatic private external fun nativeSetPhaseAndTiming(phaseAngleDeg: Double, timingDiffMs: Double)
        @JvmStatic private external fun nativeSetNoiseLevel(level: Double)
        @JvmStatic private external fun nativeSetNoiseLayers(white: Double, pink: Double, brown: Double)
        @JvmStatic private external fun nativeFade(toGain: Double, durationMs: Int)
        @JvmStatic private external fun nativeSampleRate(): Int
    }
}
