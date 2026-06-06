import XCTest
@testable import HertzAudioEngine

final class NativeEngineModeDSPTests: XCTestCase {
    func testIsochronicGateHasClearOnAndOffWindows() {
        XCTAssertGreaterThan(NativeEngineModeDSP.isochronicGate(Double.pi / 2), 0.98)
        XCTAssertLessThan(NativeEngineModeDSP.isochronicGate(Double.pi * 1.5), 0.01)
    }

    func testIsochronicModeOutputsPulsedMonoCarrier() {
        let on = NativeEngineModeDSP.rawStereo(
            modeCode: NativeEngineModeCode.isochronic.rawValue,
            carrierPhase: Double.pi / 2,
            beatPhase: Double.pi / 2,
            leftPhase: 0,
            rightPhase: 0,
            phaseOffsetRad: 0
        )
        XCTAssertEqual(on.left, on.right, accuracy: 0.0001)
        XCTAssertGreaterThan(on.left, 0.98)

        let off = NativeEngineModeDSP.rawStereo(
            modeCode: NativeEngineModeCode.isochronic.rawValue,
            carrierPhase: Double.pi / 2,
            beatPhase: Double.pi * 1.5,
            leftPhase: 0,
            rightPhase: 0,
            phaseOffsetRad: 0
        )
        XCTAssertEqual(off.left, off.right, accuracy: 0.0001)
        XCTAssertLessThan(abs(off.left), 0.01)
    }

    func testMonauralModeOutputsSmoothMonoAmplitudeBeat() {
        let loud = NativeEngineModeDSP.rawStereo(
            modeCode: NativeEngineModeCode.monaural.rawValue,
            carrierPhase: Double.pi / 2,
            beatPhase: Double.pi / 2,
            leftPhase: Double.pi / 2,
            rightPhase: 0,
            phaseOffsetRad: 0
        )
        XCTAssertEqual(loud.left, loud.right, accuracy: 0.0001)
        XCTAssertGreaterThan(loud.left, 0.98)

        let quiet = NativeEngineModeDSP.rawStereo(
            modeCode: NativeEngineModeCode.monaural.rawValue,
            carrierPhase: Double.pi / 2,
            beatPhase: Double.pi * 1.5,
            leftPhase: Double.pi / 2,
            rightPhase: 0,
            phaseOffsetRad: 0
        )
        XCTAssertEqual(quiet.left, quiet.right, accuracy: 0.0001)
        XCTAssertGreaterThan(quiet.left, 0.17)
        XCTAssertLessThan(quiet.left, 0.19)
    }

    func testPitchPanningUsesConstantPowerMovement() {
        let hardRight = NativeEngineModeDSP.rawStereo(
            modeCode: NativeEngineModeCode.pitchPanning.rawValue,
            carrierPhase: Double.pi / 2,
            beatPhase: Double.pi / 2,
            leftPhase: 0,
            rightPhase: 0,
            phaseOffsetRad: 0
        )
        XCTAssertLessThan(abs(hardRight.left), 0.01)
        XCTAssertGreaterThan(hardRight.right, 0.98)

        let center = NativeEngineModeDSP.rawStereo(
            modeCode: NativeEngineModeCode.pitchPanning.rawValue,
            carrierPhase: Double.pi / 2,
            beatPhase: 0,
            leftPhase: 0,
            rightPhase: 0,
            phaseOffsetRad: 0
        )
        XCTAssertEqual(center.left * center.left + center.right * center.right, 1, accuracy: 0.0001)
    }

    func testPhaseModulatedModeSeparatesStereoPhaseAtBeatPeak() {
        let stereo = NativeEngineModeDSP.rawStereo(
            modeCode: NativeEngineModeCode.phaseModulated.rawValue,
            carrierPhase: 0,
            beatPhase: Double.pi / 2,
            leftPhase: 0,
            rightPhase: 0,
            phaseOffsetRad: Double.pi / 2
        )
        XCTAssertLessThan(stereo.left, -0.98)
        XCTAssertGreaterThan(stereo.right, 0.98)
    }

    func testPhaseOffsetAppliesInterauralShiftToMonoModes() {
        // A 180° inter-aural phase offset inverts the right channel relative to the
        // left in every previously-mono mode, so the phase slider is audible there.
        for mode in [NativeEngineModeCode.monaural, .isochronic, .musicModulation] {
            let s = NativeEngineModeDSP.rawStereo(
                modeCode: mode.rawValue,
                carrierPhase: Double.pi / 2,
                beatPhase: Double.pi / 2,
                leftPhase: 0,
                rightPhase: 0,
                phaseOffsetRad: Double.pi
            )
            XCTAssertGreaterThan(s.left, 0.98, "mode \(mode) left at carrier peak")
            XCTAssertLessThan(s.right, -0.98, "mode \(mode) right inverted by 180°")
        }

        // Pitch panning at center keeps equal magnitude but inverts the right phase.
        let pan = NativeEngineModeDSP.rawStereo(
            modeCode: NativeEngineModeCode.pitchPanning.rawValue,
            carrierPhase: Double.pi / 2,
            beatPhase: 0,
            leftPhase: 0,
            rightPhase: 0,
            phaseOffsetRad: Double.pi
        )
        XCTAssertGreaterThan(pan.left, 0.7)
        XCTAssertLessThan(pan.right, -0.7)
    }

    func testHemisphericSyncSwaysInterauralPhaseAtBeatRate() {
        // At beatPhase 0 the sway is zero, so both ears are aligned at the carrier.
        let aligned = NativeEngineModeDSP.rawStereo(
            modeCode: NativeEngineModeCode.hemisphericSync.rawValue,
            carrierPhase: Double.pi / 2,
            beatPhase: 0,
            leftPhase: 0,
            rightPhase: 0,
            phaseOffsetRad: 0
        )
        XCTAssertEqual(aligned.left, 1, accuracy: 0.0001)
        XCTAssertEqual(aligned.right, 1, accuracy: 0.0001)

        // At beatPhase π/2 the right channel phase has swung by +90°; the left
        // hemisphere stays the clean reference (unchanged by the beat).
        let swept = NativeEngineModeDSP.rawStereo(
            modeCode: NativeEngineModeCode.hemisphericSync.rawValue,
            carrierPhase: Double.pi / 2,
            beatPhase: Double.pi / 2,
            leftPhase: 0,
            rightPhase: 0,
            phaseOffsetRad: 0
        )
        XCTAssertEqual(swept.left, 1, accuracy: 0.0001)
        XCTAssertEqual(swept.right, 0, accuracy: 0.0001)
    }

    func testMusicEnvelopeIsSubtleAndBeatRateBounded() {
        XCTAssertEqual(NativeEngineModeDSP.musicEnvelope(Double.pi / 2), 1, accuracy: 0.0001)
        XCTAssertEqual(NativeEngineModeDSP.musicEnvelope(Double.pi * 1.5), 0.82, accuracy: 0.0001)
    }
}
