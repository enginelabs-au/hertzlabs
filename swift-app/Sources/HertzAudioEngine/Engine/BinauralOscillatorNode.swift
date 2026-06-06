import AVFoundation
import Darwin

// Keep in sync with `NATIVE_ENGINE_MODE_CODE` in `engineModeMapping.ts`.
private enum NativeEngineModeCode {
    static let binaural = 0
    static let monaural = 1
    static let isochronic = 2
    static let hemisphericSync = 3
    static let phaseModulated = 4
    static let pitchPanning = 5
    static let musicModulation = 6
}

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
    // τ = 50 ms → computed once at init
    private let smoothAlpha: Float
    /// Faster ramp for noise layers so toggles feel immediate.
    private let noiseSmoothAlpha: Float
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

        // Capture value-type state; closure is @Sendable and captures no reference types
        // except parameterBox (which is @unchecked Sendable, render-safe by design).
        let box = parameterBox
        let sr = sampleRate
        let alpha = smoothAlpha
        let noiseAlpha = noiseSmoothAlpha
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
                smGain     += alpha * (targetGain   - smGain)
                smBalance  += alpha * (targetBalance - smBalance)
                smNoiseWhite += noiseAlpha * (targetNoiseWhite - smNoiseWhite)
                smNoisePink  += noiseAlpha * (targetNoisePink  - smNoisePink)
                smNoiseBrown += noiseAlpha * (targetNoiseBrown - smNoiseBrown)
                smPhaseAngleRad += Double(alpha) * (targetPhaseAngleRad - smPhaseAngleRad)

                let leftHz  = max(0.001, smCarrier - smBeat * 0.5)
                let rightHz = max(0.001, smCarrier + smBeat * 0.5)
                let beatRateHz = max(0.001, abs(smBeat))

                var rawL: Float
                var rawR: Float

                switch modeCode {
                case NativeEngineModeCode.monaural:
                    // Two tones physically mixed before panning: both speakers/ears receive
                    // the same interference envelope, matching the acoustic monaural model.
                    phaseL_ += twoPiLocal * leftHz / sr
                    phaseR_ += twoPiLocal * rightHz / sr
                    rawL = Float((sin(phaseL_) + sin(phaseR_)) * 0.5)
                    rawR = rawL

                case NativeEngineModeCode.isochronic:
                    // One carrier gated by a smooth beat-rate pulse. Raised-cosine avoids
                    // hard switching clicks while preserving the strong rhythmic cue.
                    phaseL_ += twoPiLocal * max(0.001, smCarrier) / sr
                    phaseR_ += twoPiLocal * beatRateHz / sr
                    let pulse = 0.12 + 0.88 * (0.5 - 0.5 * cos(phaseR_))
                    let tone = Float(sin(phaseL_) * pulse)
                    rawL = tone
                    rawR = tone

                case NativeEngineModeCode.hemisphericSync:
                    // Same carrier to both ears; phase relationship carries the cue.
                    phaseL_ += twoPiLocal * max(0.001, smCarrier) / sr
                    phaseR_ += twoPiLocal * max(0.001, smCarrier) / sr
                    rawL = Float(sin(phaseL_))
                    rawR = Float(sin(phaseR_ + smPhaseAngleRad))

                case NativeEngineModeCode.phaseModulated:
                    // Carrier phase sweeps at the target beat rate. Default depth is audible
                    // even with the phase slider at 0; the slider increases/sets sweep depth.
                    phaseL_ += twoPiLocal * max(0.001, smCarrier) / sr
                    phaseR_ += twoPiLocal * beatRateHz / sr
                    let requestedDepth = abs(smPhaseAngleRad)
                    let depth = min(Double.pi, max(Double.pi / 4.0, requestedDepth))
                    let offset = sin(phaseR_) * depth
                    rawL = Float(sin(phaseL_ - offset))
                    rawR = Float(sin(phaseL_ + offset))

                case NativeEngineModeCode.pitchPanning:
                    // A carrier moves left↔right at the beat rate using constant-power gains.
                    phaseL_ += twoPiLocal * max(0.001, smCarrier) / sr
                    phaseR_ += twoPiLocal * beatRateHz / sr
                    let pan = 0.5 + 0.5 * sin(phaseR_)
                    let tone = sin(phaseL_)
                    rawL = Float(tone * sqrt(max(0, 1 - pan)))
                    rawR = Float(tone * sqrt(max(0, pan)))

                case NativeEngineModeCode.musicModulation:
                    // No music bed is present in the native scaffold yet, so embed the beat as
                    // a gentler full-output AM envelope that also rides any active noise layer.
                    phaseL_ += twoPiLocal * max(0.001, smCarrier) / sr
                    phaseR_ += twoPiLocal * beatRateHz / sr
                    let envelope = 0.72 + 0.28 * (0.5 + 0.5 * sin(phaseR_))
                    let tone = Float(sin(phaseL_) * envelope)
                    rawL = tone
                    rawR = tone

                case NativeEngineModeCode.binaural:
                    fallthrough
                default:
                    // Default binaural path: separate tones, one per ear.
                    phaseL_ += twoPiLocal * leftHz / sr
                    phaseR_ += twoPiLocal * rightHz / sr
                    rawL = Float(sin(phaseL_))
                    rawR = Float(sin(phaseR_ + smPhaseAngleRad))
                }

                if phaseL_ >= twoPiLocal { phaseL_ -= twoPiLocal }
                if phaseR_ >= twoPiLocal { phaseR_ -= twoPiLocal }
                if phaseL_ < 0 { phaseL_ += twoPiLocal }
                if phaseR_ < 0 { phaseR_ += twoPiLocal }

                // Balance: gainL = gain * max(0, 1 − balance), gainR = gain * max(0, 1 + balance)
                let gainL = smGain * max(0, 1.0 - smBalance)
                let gainR = smGain * max(0, 1.0 + smBalance)

                let clampedGainL = min(gainL, AudioConstants.kMaxAmplitude)
                let clampedGainR = min(gainR, AudioConstants.kMaxAmplitude)

                let toneL = rawL * clampedGainL
                let toneR = rawR * clampedGainR

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

                if modeCode == NativeEngineModeCode.musicModulation && noiseActive {
                    let envelope = Float(0.72 + 0.28 * (0.5 + 0.5 * sin(phaseR_)))
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
