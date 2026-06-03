import XCTest
@testable import HertzAudioEngine

final class ParameterBoxTests: XCTestCase {
    func testPublishesClampedSafeParameters() throws {
        let box = ParameterBox()
        // beatHz 100 is at max boundary; gain 1.0 clamps to 1.0; balance 2 clamps to 1
        let snapshot = try XCTUnwrap(box.publish(carrierHz: 220, beatHz: 100, gain: 1, balance: 2))

        XCTAssertEqual(snapshot.targetBeatHz, 100, accuracy: 0.001)
        XCTAssertEqual(snapshot.targetGain, 1.0, accuracy: 0.001)
        XCTAssertEqual(snapshot.targetBalance, 1.0, accuracy: 0.001)
    }
}
