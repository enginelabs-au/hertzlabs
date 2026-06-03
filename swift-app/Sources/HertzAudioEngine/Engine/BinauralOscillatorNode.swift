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
    // τ = 50 ms → computed once at init
    private let smoothAlpha: Float
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

        let tau: Double = 0.050 // 50 ms
        smoothAlpha = Float(1.0 - exp(-1.0 / (tau * sampleRate)))

        // Capture value-type state; closure is @Sendable and captures no reference types
        // except parameterBox (which is @unchecked Sendable, render-safe by design).
        let box = parameterBox
        let sr = sampleRate
        let alpha = smoothAlpha
        let twoPiLocal = twoPi

        var phaseL_: Double = 0
        var phaseR_: Double = 0
        var smCarrier: Double = 200.0
        var smBeat: Double = 10.0
        var smGain: Float = 0
        var smBalance: Float = 0
        var lastGeneration: UInt64 = 0

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

            // Phase offset from right-channel timing difference:
            // timingDiffMs in ±500 ms → extra phase advance in radians
            // Also apply phaseAngle (degrees) offset to right channel
            let phaseAngleRad = snap.targetPhaseAngle * (.pi / 180.0)

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

                // Derived per-ear Hz
                let leftHz  = max(0.001, smCarrier - smBeat * 0.5)
                let rightHz = max(0.001, smCarrier + smBeat * 0.5)

                // Phase accumulation in Double, no modulo, no zero-snap
                phaseL_ += twoPiLocal * leftHz / sr
                if phaseL_ >= twoPiLocal { phaseL_ -= twoPiLocal }

                phaseR_ += twoPiLocal * rightHz / sr
                if phaseR_ >= twoPiLocal { phaseR_ -= twoPiLocal }
                if phaseR_ < 0           { phaseR_ += twoPiLocal }

                // Balance: gainL = gain * max(0, 1 − balance), gainR = gain * max(0, 1 + balance)
                let gainL = smGain * max(0, 1.0 - smBalance)
                let gainR = smGain * max(0, 1.0 + smBalance)

                let clampedGainL = min(gainL, AudioConstants.kMaxAmplitude)
                let clampedGainR = min(gainR, AudioConstants.kMaxAmplitude)

                var outL = Float(sin(phaseL_)) * clampedGainL
                // Phase offset on right ear — radians added at sample, not per-sample rate.
                var outR = Float(sin(phaseR_ + phaseAngleRad)) * clampedGainR

                // Sample-domain hard ceiling
                let ceil = AudioConstants.kMaxAmplitude
                outL = min(max(outL, -ceil), ceil)
                outR = min(max(outR, -ceil), ceil)

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
}
