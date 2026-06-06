import Foundation

public final class NoiseGeneratorNode {
    public private(set) var type: NoiseType = .none
    public private(set) var level: Float = 0

    public init() {}

    public func update(type: NoiseType, level: Float) {
        self.type = type
        self.level = min(max(level, 0), AudioConstants.kMaxAmplitude)
    }
}
