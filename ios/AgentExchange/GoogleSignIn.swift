import AuthenticationServices
import UIKit

@MainActor
final class GoogleSignIn: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?
    private var anchor: ASPresentationAnchor?

    func signIn(client: ExchangeClient) async throws -> AuthUser {
        guard session == nil,
              let window = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
                .filter({ $0.activationState == .foregroundActive })
                .flatMap(\.windows).first(where: \.isKeyWindow) else {
            throw ExchangeError.invalidResponse
        }
        anchor = window
        let attempt = try await client.beginGoogleSignIn()
        defer { session = nil; anchor = nil }
        do {
            let callback = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
                let session = ASWebAuthenticationSession(url: attempt.url, callbackURLScheme: OAuthFlow.callback.scheme) { url, error in
                    if let error { continuation.resume(throwing: error) }
                    else if let url { continuation.resume(returning: url) }
                    else { continuation.resume(throwing: ExchangeError.invalidResponse) }
                }
                session.presentationContextProvider = self
                // Preserve the user's existing Google sign-in in the system browser.
                session.prefersEphemeralWebBrowserSession = false
                self.session = session
                if !session.start() { continuation.resume(throwing: ExchangeError.invalidResponse) }
            }
            return try await client.completeGoogleSignIn(id: attempt.id, callback: callback)
        } catch {
            await client.cancelGoogleSignIn(id: attempt.id)
            throw error
        }
    }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchor ?? ASPresentationAnchor()
    }
}
