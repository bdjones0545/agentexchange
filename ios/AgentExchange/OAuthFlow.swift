import Foundation
import CryptoKit
import Security

/// A verifier is never persisted or sent through the browser. Each attempt is single-use.
struct OAuthFlow {
    static let callback = URL(string: "ai.agentsexchange.ios://auth/callback")!
    let id = UUID()
    let verifier: String
    let createdAt = Date()
    init() throws {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw ExchangeError.invalidResponse
        }
        verifier = Self.base64URL(Data(bytes))
    }
    static func base64URL(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
    static func challenge(for verifier: String) -> String {
        base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
    }
    func authorizationURL(configuration: AuthConfiguration) throws -> URL {
        var parts = URLComponents(url: try configuration.validatedURL().appendingPathComponent("auth/v1/authorize"), resolvingAgainstBaseURL: false)!
        parts.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: Self.callback.absoluteString),
            URLQueryItem(name: "scopes", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: Self.challenge(for: verifier)),
            URLQueryItem(name: "code_challenge_method", value: "s256")
        ]
        return parts.url!
    }
    static func code(from url: URL) throws -> String {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == callback.scheme, parts.host == callback.host,
              parts.path == callback.path, parts.port == nil, parts.user == nil,
              parts.password == nil, parts.fragment == nil else { throw ExchangeError.invalidResponse }
        let items = parts.queryItems ?? []
        guard !items.contains(where: { $0.name.hasPrefix("error") }),
              items.filter({ $0.name == "code" }).count == 1,
              let code = items.first(where: { $0.name == "code" })?.value,
              !code.isEmpty, code.count <= 4096 else { throw ExchangeError.invalidResponse }
        return code
    }
}
