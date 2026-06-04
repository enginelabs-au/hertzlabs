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
        val noiseLevel = maxOf(noiseWhite, noisePink, noiseBrown)
        if (noiseLevel > 0) {
            nativeSetNoiseLevel(noiseLevel)
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun setNoise(type: String, level: Double) {
        nativeSetNoiseLevel(level)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun setNoiseLayers(white: Double, pink: Double, brown: Double) {
        val noiseLevel = maxOf(white, pink, brown)
        if (noiseLevel > 0) {
            nativeSetNoiseLevel(noiseLevel)
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun fade(toGain: Double, durationMs: Double) {
        nativeFade(toGain, durationMs.toInt())
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun setPhaseAndTiming(phase: Double, timingMs: Double) {
        // Phase/timing native path is iOS-first; Android Oboe engine uses balance/beat only for now.
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun loadPreset(presetJson: String) {
        // Preset decoding remains in TypeScript for the scaffold; native remains parameter-authoritative.
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
        @JvmStatic private external fun nativeSetNoiseLevel(level: Double)
        @JvmStatic private external fun nativeFade(toGain: Double, durationMs: Int)
        @JvmStatic private external fun nativeSampleRate(): Int
    }
}
