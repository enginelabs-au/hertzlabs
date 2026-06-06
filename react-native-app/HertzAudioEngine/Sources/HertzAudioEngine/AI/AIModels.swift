import Foundation

// MARK: - SessionPlan

/// A complete AI-generated or preset-based session specification.
public struct SessionPlan: Codable, Sendable {
    public let carrierHz: Double
    public let beatHz: Double
    public let durationSec: Int
    public let title: String
    public let description: String
    public let noiseType: String       // "none" | "white" | "pink" | "brown"
    public let noiseLevel: Float
    public let fadeInMs: Int
    public let fadeOutMs: Int

    public init(
        carrierHz: Double,
        beatHz: Double,
        durationSec: Int,
        title: String,
        description: String,
        noiseType: String = "none",
        noiseLevel: Float = 0,
        fadeInMs: Int = 0,
        fadeOutMs: Int = 0
    ) {
        self.carrierHz = carrierHz
        self.beatHz = beatHz
        self.durationSec = durationSec
        self.title = title
        self.description = description
        self.noiseType = noiseType
        self.noiseLevel = noiseLevel
        self.fadeInMs = fadeInMs
        self.fadeOutMs = fadeOutMs
    }
}

// MARK: - SessionRecommendation

/// Top-level JSON wrapper returned by Gemini.
public struct SessionRecommendation: Codable, Sendable {
    public let recommendation: SessionPlan

    public init(recommendation: SessionPlan) {
        self.recommendation = recommendation
    }
}

// MARK: - Internal engine types

/// Brainwave band keywords and their canonical beat Hz values.
enum BrainwaveBand: String {
    case epsilon, delta, theta, alpha, smr, beta, gamma, lambda

    var canonicalBeatHz: Double {
        switch self {
        case .epsilon: return 0.5
        case .delta:   return 2.0
        case .theta:   return 6.0
        case .alpha:   return 10.0
        case .smr:     return 13.0
        case .beta:    return 20.0
        case .gamma:   return 40.0
        case .lambda:  return 100.0
        }
    }

    var title: String {
        switch self {
        case .epsilon: return "Epsilon"
        case .delta:   return "Delta"
        case .theta:   return "Theta"
        case .alpha:   return "Alpha"
        case .smr:     return "SMR"
        case .beta:    return "Beta"
        case .gamma:   return "Gamma"
        case .lambda:  return "Lambda"
        }
    }
}

// MARK: - EngineConfig (public, lives here to avoid circular deps)

public struct EngineConfig: Sendable {
    public let preferredSampleRate: Double
    public let preferredBufferDurationMs: Double

    public init(preferredSampleRate: Double = 48_000, preferredBufferDurationMs: Double = 10) {
        self.preferredSampleRate = preferredSampleRate
        self.preferredBufferDurationMs = preferredBufferDurationMs
    }
}
