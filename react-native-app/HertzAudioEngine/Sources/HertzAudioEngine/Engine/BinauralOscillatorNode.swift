import AVFoundation
import Darwin

// MARK: - BinauralOscillatorNode

/// Encapsulates AVAudioSourceNode for stereo binaural beat synthesis.
///
/// DSP invariants (render thread only):
/// - Phase accumulation in Double precision; no modulo, no zero-snap on wrap.
/// - Per-sample exponential smoothing (τ = 50 ms) for all continuous params.
/// - Hard ceiling: kMaxAmplitude = -6 dBFS (0.5011872336 linear).
/// - Balance law: gainL = gain * max(0, 1−balance), gainR = gain * max(0, 1+balance).
/// - Phase angle offset applied to right channel at accumulation time.
/// - No locks, no allocations, no logging inside the render block.
public final class BinauralOscillatorNode {
    public private(set) var sourceNode: AVAudioSourceNode!

    private let parameterBox: ParameterBox
    private let sampleRate: Double

    // Exponential smoothing coefficient: alpha = 1 − exp(−1 / (τ × sampleRate))
    // τ = 80 ms → computed once at init
    private let smoothAlpha: Float
    /// Faster ramp for noise layers so toggles feel immediate.
    private let noiseSmoothAlpha: Float
    /// Very fast ramp (τ = 15 ms) used only when gain falls to zero on pause/stop.
    private let silenceSmoothAlpha: Float
    private let twoPi = 2.0 * Double.pi

    // Phase accumulators (Double)
    private var phaseL: Double = 0
    private var phaseR: Double = 0

    // Smoothed parameter values (Float unless noted)
    private var smCarrierHz: Double = 200.0
    private var smBeatHz: Double = 10.0
    private var smGain: Float = 0
    private var smBalance: Float = 0
    // phaseAngle is applied directly from snapshot each sample (no smoothing needed for angle)

    private var observedGeneration: UInt64 = 0

    public init(parameterBox: ParameterBox, format: AVAudioFormat) {
        self.parameterBox = parameterBox
        self.sampleRate = format.sampleRate

        let tau: Double = 0.080 // 80 ms — reduces zipper/crackle on gain & carrier moves
        smoothAlpha = Float(1.0 - exp(-1.0 / (tau * sampleRate)))
        let noiseTau: Double = 0.040 // 40 ms — avoids noise-layer zipper noise
        noiseSmoothAlpha = Float(1.0 - exp(-1.0 / (noiseTau * sampleRate)))
        // 15 ms fast-silence ramp — used when gain is falling toward zero on pause/stop.
        // At the 80 ms engine.pause() delay the gain is at e^(-80/15) ≈ 0.5 %, inaudible.
        let silenceTau: Double = 0.015
        silenceSmoothAlpha = Float(1.0 - exp(-1.0 / (silenceTau * sampleRate)))

        // Capture value-type state; closure is @Sendable and captures no reference types
        // except parameterBox (which is @unchecked Sendable, render-safe by design).
        let box = parameterBox
        let sr = sampleRate
        let alpha = smoothAlpha
        let noiseAlpha = noiseSmoothAlpha
        let silenceAlpha = silenceSmoothAlpha
        let twoPiLocal = twoPi
        let ceiling = AudioConstants.kMaxAmplitude

        var phaseL_: Double = 0
        var phaseR_: Double = 0
        var smCarrier: Double = 200.0
        var smBeat: Double = 10.0
        var smGain: Float = 0
        var smBalance: Float = 0
        var smNoiseWhite: Float = 0
        var smNoisePink: Float = 0
        var smNoiseBrown: Float = 0
        var smPhaseAngleRad: Double = 0
        var smToneDuck: Float = 1.0
        var lastGeneration: UInt64 = 0
        let breathPacer = BreathPacer()
        var rngState: UInt32 = 0xA3C59AC3
        var pinkB0: Float = 0, pinkB1: Float = 0, pinkB2: Float = 0
        var pinkB3: Float = 0, pinkB4: Float = 0, pinkB5: Float = 0, pinkB6: Float = 0
        var brownState: Float = 0

        sourceNode = AVAudioSourceNode(format: format) { [box, sr, alpha, twoPiLocal]
            silence, _, frameCount, audioBufferList -> OSStatus in

            let snap = box.read()

            // Update smoothing targets only when a new generation is published
            if snap.generationCounter != lastGeneration {
                lastGeneration = snap.generationCounter
            }

            let targetCarrier = snap.targetCarrierHz
            let targetBeat    = snap.targetBeatHz
            let targetGain    = snap.playIntent ? snap.targetGain : Float(0)
            let targetBalance = snap.targetBalance
            // Layer gains stay in the snapshot while paused; output is gated via targetGain.
            let targetNoiseWhite = snap.noiseWhiteGain
            let targetNoisePink  = snap.noisePinkGain
            let targetNoiseBrown = snap.noiseBrownGain

            // Target phase offset (degrees → rad); smoothed per-sample below.
            let targetPhaseAngleRad = snap.targetPhaseAngle * (.pi / 180.0)
            let modeCode = Int(snap.targetTimingDiffMs.rounded())
            breathPacer.configure(
                enabled: snap.breathPacerEnabled,
                patternId: snap.breathPatternId,
                deltaDb: snap.breathDeltaDb,
                sampleRate: sr
            )

            let buffers = UnsafeMutableAudioBufferListPointer(audioBufferList)
            guard !buffers.isEmpty else {
                silence.pointee = true
                return noErr
            }

            silence.pointee = false
            let frames = Int(frameCount)

            let hasSeparateChannels = buffers.count >= 2
            let leftBuf  = hasSeparateChannels
                ? buffers[0].mData?.assumingMemoryBound(to: Float.self)
                : buffers[0].mData?.assumingMemoryBound(to: Float.self)
            let rightBuf = hasSeparateChannels
                ? buffers[1].mData?.assumingMemoryBound(to: Float.self)
                : nil

            for i in 0..<frames {
                // Per-sample exponential smoothing (Double carriers, Float for gain/balance)
                smCarrier  += Double(alpha) * (targetCarrier - smCarrier)
                smBeat     += Double(alpha) * (targetBeat    - smBeat)
                // Use the fast-silence ramp when gain is falling toward zero (pause/stop).
                // This avoids the click caused by engine.pause() cutting the render mid-fade.
                let gainDelta = targetGain - smGain
                smGain += (gainDelta < 0 && targetGain == 0 ? silenceAlpha : alpha) * gainDelta
                smBalance  += alpha * (targetBalance - smBalance)
                smNoiseWhite += noiseAlpha * (targetNoiseWhite - smNoiseWhite)
                smNoisePink  += noiseAlpha * (targetNoisePink  - smNoisePink)
                smNoiseBrown += noiseAlpha * (targetNoiseBrown - smNoiseBrown)
                smPhaseAngleRad += Double(alpha) * (targetPhaseAngleRad - smPhaseAngleRad)

                let breathMult =
                    snap.breathPacerEnabled && snap.playIntent ? breathPacer.advance() : Float(1)
                let pacedGain = smGain * breathMult

                let mode = NativeEngineModeCode(rawValue: modeCode) ?? .binaural
                let leftHz  = max(0.001, smCarrier - smBeat * 0.5)
                let rightHz = max(0.001, smCarrier + smBeat * 0.5)
                let beatRateHz = max(0.001, abs(smBeat))

                switch mode {
                case .monaural, .isochronic, .hemisphericSync, .phaseModulated, .pitchPanning, .musicModulation:
                    phaseL_ += twoPiLocal * max(0.001, smCarrier) / sr
                    phaseR_ += twoPiLocal * beatRateHz / sr
                case .binaural:
                    phaseL_ += twoPiLocal * leftHz / sr
                    phaseR_ += twoPiLocal * rightHz / sr
                }

                phaseL_ = NativeEngineModeDSP.wrapPhase(phaseL_)
                phaseR_ = NativeEngineModeDSP.wrapPhase(phaseR_)

                let raw = NativeEngineModeDSP.rawStereo(
                    modeCode: modeCode,
                    carrierPhase: phaseL_,
                    beatPhase: phaseR_,
                    leftPhase: phaseL_,
                    rightPhase: phaseR_,
                    phaseOffsetRad: smPhaseAngleRad
                )

                // Balance: gainL = gain * max(0, 1 − balance), gainR = gain * max(0, 1 + balance)
                let gainL = pacedGain * max(0, 1.0 - smBalance)
                let gainR = pacedGain * max(0, 1.0 + smBalance)

                let clampedGainL = min(gainL, AudioConstants.kMaxAmplitude)
                let clampedGainR = min(gainR, AudioConstants.kMaxAmplitude)

                let toneL = Float(raw.left) * clampedGainL
                let toneR = Float(raw.right) * clampedGainR

                var noiseMono: Float = 0
                let noiseSum = smNoiseWhite + smNoisePink + smNoiseBrown
                if snap.playIntent && noiseSum > 0.00005 {
                    rngState = rngState &* 1664525 &+ 1013904223
                    let u = Float(rngState & 0x7FFF_FFFF) / Float(0x7FFF_FFFF)
                    let whiteRaw = u * 2.0 - 1.0

                    pinkB0 = 0.99886 * pinkB0 + whiteRaw * 0.0555179
                    pinkB1 = 0.99332 * pinkB1 + whiteRaw * 0.0750759
                    pinkB2 = 0.96900 * pinkB2 + whiteRaw * 0.1538520
                    pinkB3 = 0.86650 * pinkB3 + whiteRaw * 0.3104856
                    pinkB4 = 0.55000 * pinkB4 + whiteRaw * 0.5329522
                    pinkB5 = -0.7616 * pinkB5 - whiteRaw * 0.0168980
                    let pinkRaw = (pinkB0 + pinkB1 + pinkB2 + pinkB3 + pinkB4 + pinkB5 + pinkB6) * 0.11
                    pinkB6 = whiteRaw * 0.115926

                    brownState = (brownState + whiteRaw * 0.02) * 0.995
                    brownState = min(max(brownState, -1.2), 1.2)
                    let brownRaw = brownState

                    noiseMono += smNoiseWhite * whiteRaw
                    if smNoisePink > 0 {
                        noiseMono += smNoisePink * min(max(pinkRaw, -1.5), 1.5)
                    }
                    if smNoiseBrown > 0 {
                        noiseMono += smNoiseBrown * brownRaw
                    }
                }

                // Duck tone when noise is active; smooth duck factor (hard switch caused crackle).
                let noiseActive = noiseSum > 0.00005 && abs(noiseMono) > 0.00001
                let targetDuck: Float = noiseActive ? 0.72 : 1.0
                smToneDuck += alpha * (targetDuck - smToneDuck)
                var outL = toneL * smToneDuck + noiseMono
                var outR = toneR * smToneDuck + noiseMono

                if mode == .musicModulation {
                    let envelope = Float(NativeEngineModeDSP.musicEnvelope(phaseR_))
                    outL *= envelope
                    outR *= envelope
                }

                outL = Self.softLimit(outL, ceiling: ceiling)
                outR = Self.softLimit(outR, ceiling: ceiling)

                if hasSeparateChannels {
                    leftBuf?[i]  = outL
                    rightBuf?[i] = outR
                } else {
                    leftBuf?[i * 2]     = outL
                    leftBuf?[i * 2 + 1] = outR
                }
            }

            return noErr
        }
    }

    /// Gentle compression above ceiling — avoids hard-clip crackle on tone+noise sums.
    @inline(__always)
    private static func softLimit(_ sample: Float, ceiling: Float) -> Float {
        let absS = abs(sample)
        if absS <= ceiling { return sample }
        let sign: Float = sample >= 0 ? 1 : -1
        let excess = absS - ceiling
        return sign * (ceiling + excess / (1 + excess * 4))
    }
}
