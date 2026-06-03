import Foundation
import GoogleGenerativeAI

// MARK: - GeminiClient

/// Calls gemini-1.5-flash via the GoogleGenerativeAI SDK.
/// API key is loaded once from SecretsLoader — never stored as a property after model init.
public final class GeminiClient {

    private static let modelName = "gemini-1.5-flash"

    /// System instruction forces strict JSON conforming to SessionRecommendation schema.
    private static let systemInstruction = """
    You are a binaural beat session designer. Respond ONLY with a single valid JSON object \
    matching this exact schema — no prose, no markdown fences, no extra keys:
    {
      "recommendation": {
        "carrierHz": <number 20–1500>,
        "beatHz": <number 0.5–100>,
        "durationSec": <integer>,
        "title": "<string>",
        "description": "<string>",
        "noiseType": "none" | "white" | "pink" | "brown",
        "noiseLevel": <number 0.0–1.0>,
        "fadeInMs": <integer>,
        "fadeOutMs": <integer>
      }
    }
    """

    /// Lazy model created on first generateSession call.
    /// The API key is loaded transiently and is not retained beyond model construction.
    private lazy var model: GenerativeModel = {
        // loadAPIKey() is called once; the key is not stored by GeminiClient.
        let key = (try? SecretsLoader.loadAPIKey()) ?? ""
        let config = GenerationConfig(
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMIMEType: "application/json"
        )
        return GenerativeModel(
            name: Self.modelName,
            apiKey: key,
            generationConfig: config,
            systemInstruction: ModelContent(role: "system", parts: [.text(Self.systemInstruction)])
        )
    }()

    public init() {}

    // MARK: - Public

    /// Generates a SessionPlan from a free-text prompt.
    /// Falls back to RegexFallback.extract(from:) if JSON parsing fails.
    public func generateSession(prompt: String) async throws -> SessionPlan {
        let response = try await model.generateContent(prompt)
        guard let text = response.text else {
            throw GeminiClientError.emptyResponse
        }

        // Attempt structured parse first
        if let plan = parseSessionPlan(from: text) {
            return plan
        }

        // JSON parse failed — delegate to offline regex fallback
        return try RegexFallback.extract(from: text.isEmpty ? prompt : text)
    }

    // MARK: - Private

    private func parseSessionPlan(from text: String) -> SessionPlan? {
        guard let data = text.data(using: .utf8) else { return nil }
        let decoder = JSONDecoder()
        // Try wrapper first
        if let wrapper = try? decoder.decode(SessionRecommendation.self, from: data) {
            return wrapper.recommendation
        }
        // Try bare SessionPlan
        return try? decoder.decode(SessionPlan.self, from: data)
    }
}

// MARK: - Error

public enum GeminiClientError: Error {
    case emptyResponse
}
