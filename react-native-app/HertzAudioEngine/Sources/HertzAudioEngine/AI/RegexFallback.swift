import Foundation

// MARK: - RegexFallback

/// Stateless, network-free offline recovery engine.
/// Extracts SessionPlan fields from free-text using regex and keyword matching.
public enum RegexFallback {

    // MARK: - Default values

    private static let defaultCarrierHz: Double = 200.0
    private static let defaultBeatHz: Double = 10.0
    private static let defaultDurationSec: Int = 1200   // 20 minutes

    // MARK: - Public API

    /// Extracts a SessionPlan from free-text by applying pattern-matching rules.
    /// Never throws in normal operation; throws only on irrecoverable internal error (rare).
    public static func extract(from text: String) throws -> SessionPlan {
        let carrierHz  = extractCarrierHz(from: text) ?? defaultCarrierHz
        let beatHz     = extractBeatHz(from: text) ?? defaultBeatHz
        let durationSec = extractDurationSec(from: text) ?? defaultDurationSec

        let bandTitle = brainwaveBandTitle(for: beatHz)
        let title = "\(bandTitle) Session \(Int(carrierHz)) Hz"
        let description = "Carrier \(Int(carrierHz)) Hz · beat \(beatHz) Hz · \(durationSec / 60) min"

        return SessionPlan(
            carrierHz: carrierHz,
            beatHz: beatHz,
            durationSec: durationSec,
            title: title,
            description: description,
            noiseType: "none",
            noiseLevel: 0,
            fadeInMs: 3000,
            fadeOutMs: 3000
        )
    }

    // MARK: - Rule 1: Carrier Hz extraction

    /// Regex: `\b(\d{2,4})\s*[Hh][Zz]\b` → first match → Double
    static func extractCarrierHz(from text: String) -> Double? {
        let pattern = #"\b(\d{2,4})\s*[Hh][Zz]\b"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              let captureRange = Range(match.range(at: 1), in: text),
              let value = Double(text[captureRange]),
              value >= 20 && value <= 1500 else { return nil }
        return value
    }

    // MARK: - Rule 2: Beat Hz / brainwave band keyword extraction

    private static let bandKeywordMap: [(pattern: String, band: BrainwaveBand)] = [
        ("epsilon", .epsilon),
        ("delta",   .delta),
        ("theta",   .theta),
        ("alpha",   .alpha),
        ("\\bsmr\\b", .smr),
        ("beta",    .beta),
        ("gamma",   .gamma),
        ("lambda",  .lambda)
    ]

    /// Checks for brainwave band keywords (case-insensitive), returns canonical beat Hz.
    static func extractBeatHz(from text: String) -> Double? {
        let lowered = text.lowercased()
        for entry in bandKeywordMap {
            if let regex = try? NSRegularExpression(pattern: entry.pattern, options: .caseInsensitive) {
                let range = NSRange(lowered.startIndex..., in: lowered)
                if regex.firstMatch(in: lowered, range: range) != nil {
                    return entry.band.canonicalBeatHz
                }
            }
        }
        return nil
    }

    // MARK: - Rule 3: Duration extraction

    /// Regex: `\b(\d+)\s*(min(ute)?s?|sec(ond)?s?)\b` → converts to seconds.
    static func extractDurationSec(from text: String) -> Int? {
        let pattern = #"\b(\d+)\s*(min(?:ute)?s?|sec(?:ond)?s?)\b"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return nil
        }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              let numRange = Range(match.range(at: 1), in: text),
              let unitRange = Range(match.range(at: 2), in: text),
              let number = Int(text[numRange]) else { return nil }

        let unit = text[unitRange].lowercased()
        if unit.hasPrefix("min") {
            return number * 60
        } else {
            return number
        }
    }

    // MARK: - Private helpers

    private static func brainwaveBandTitle(for beatHz: Double) -> String {
        switch beatHz {
        case ..<0.5:           return "Epsilon"
        case 0.5..<4:          return "Delta"
        case 4..<8:            return "Theta"
        case 8..<12:           return "Alpha"
        case 12..<15:          return "SMR"
        case 15..<30:          return "Beta"
        case 30..<100:         return "Gamma"
        default:               return "Lambda"
        }
    }
}
