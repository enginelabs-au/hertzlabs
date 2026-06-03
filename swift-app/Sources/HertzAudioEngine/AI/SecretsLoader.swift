import Foundation

// MARK: - SecretsLoader

/// Reads the Gemini API key from the untracked GenerativeAI-Info.plist.
///
/// Key encoding: each byte of the plaintext key is XOR'd with 0xAB and stored as a
/// two-character lowercase hex string (e.g. byte 0x41 → 0xEA → "ea").
/// All hex bytes are concatenated without separators: "ea...".
///
/// API_KEY_SCHEME must equal "xor-v1" or the load fails with a thrown error.
/// The plaintext key is held only transiently — never stored as a property.
public enum SecretsLoader {

    private static let plistName = "GenerativeAI-Info"
    private static let xorMask: UInt8 = 0xAB

    /// Loads and de-obfuscates the API key from the bundle plist.
    /// Searches Bundle.main (the host app bundle when linked as a library).
    /// Throws `SecretsError` if the plist is missing, the scheme is wrong, or the encoding is invalid.
    public static func loadAPIKey() throws -> String {
        guard let url = Bundle.main.url(forResource: plistName, withExtension: "plist"),
              let dict = NSDictionary(contentsOf: url) as? [String: String] else {
            throw SecretsError.plistNotFound
        }
        guard let scheme = dict["API_KEY_SCHEME"] else {
            throw SecretsError.missingScheme
        }
        guard scheme == "xor-v1" else {
            throw SecretsError.unsupportedScheme(scheme)
        }
        guard let encoded = dict["API_KEY"] else {
            throw SecretsError.plistNotFound
        }
        return try hexXORDecode(encoded)
    }

    // MARK: - Private

    /// Decodes a concatenated hex string where each byte was XOR'd with 0xAB.
    private static func hexXORDecode(_ hex: String) throws -> String {
        let trimmed = hex.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, trimmed.count % 2 == 0 else {
            throw SecretsError.invalidEncoding
        }

        var decoded = [UInt8]()
        decoded.reserveCapacity(trimmed.count / 2)

        var idx = trimmed.startIndex
        while idx < trimmed.endIndex {
            let nextIdx = trimmed.index(idx, offsetBy: 2)
            let byteStr = String(trimmed[idx..<nextIdx])
            guard let encodedByte = UInt8(byteStr, radix: 16) else {
                throw SecretsError.invalidEncoding
            }
            decoded.append(encodedByte ^ xorMask)
            idx = nextIdx
        }

        guard let result = String(bytes: decoded, encoding: .utf8) else {
            throw SecretsError.invalidEncoding
        }
        return result
    }
}

// MARK: - SecretsError

public enum SecretsError: Error, Equatable {
    case plistNotFound
    case missingScheme
    case unsupportedScheme(String)
    case invalidEncoding
}
