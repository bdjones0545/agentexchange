import XCTest
@testable import AgentExchangeCore

final class StubProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (Int, Data))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            let (status, data) = try Self.handler!(request)
            client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type":"application/json"])!, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}
final class ExchangeTests: XCTestCase {
    private func client() -> ExchangeClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        return ExchangeClient(network: URLSession(configuration: config), restoreSession: false)
    }
    func testRedirectsCannotSendCredentialsAcrossOriginsOrDowngradeHTTPS() {
        let origin = URL(string: "https://ynkxhrptkvefcizxuvhk.supabase.co/auth/v1/token")!
        XCTAssertFalse(ExchangeRedirectGuard.permits(from: origin, to: URL(string: "https://attacker.invalid/collect")))
        XCTAssertFalse(ExchangeRedirectGuard.permits(from: origin, to: URL(string: "http://ynkxhrptkvefcizxuvhk.supabase.co/collect")))
        XCTAssertTrue(ExchangeRedirectGuard.permits(from: origin, to: URL(string: "https://ynkxhrptkvefcizxuvhk.supabase.co/auth/v1/token/")))
    }
    func testConfigurationRejectsUntrustedHostsAndCleartext() throws {
        for url in ["http://ynkxhrptkvefcizxuvhk.supabase.co", "https://attacker.invalid", "https://ynkxhrptkvefcizxuvhk.supabase.co.attacker.invalid"] {
            XCTAssertThrowsError(try AuthConfiguration(enabled: true, supabaseUrl: url, anonKey: "public-key").validatedURL())
        }
        XCTAssertThrowsError(try AuthConfiguration(enabled: false, supabaseUrl: "https://ynkxhrptkvefcizxuvhk.supabase.co", anonKey: "key").validatedURL())
    }
    func testSearchCombinesSavedAndHiddenAndSkills() {
        let agents = [ExchangeAgent(id: "1", name: "Research", specialty: "Analysis", description: nil, skills: ["Writing"], availability: "Available", verification_status: "Unverified"), ExchangeAgent(id: "2", name: "Writer", specialty: "Writing", description: nil, skills: [], availability: "Active", verification_status: "Unverified")]
        XCTAssertEqual(ExchangeSearch.filter(agents, query: " writing ", saved: nil, hidden: ["2"]).map(\.id), ["1"])
        XCTAssertEqual(ExchangeSearch.filter(agents, query: "", saved: ["2"], hidden: []).map(\.id), ["2"])
        XCTAssertTrue(ExchangeSearch.filter(agents, query: "", saved: ["2"], hidden: ["2"]).isEmpty)
    }
    func testPublicCatalogUsesAnonymousHeadersAndProjectsColumns() async throws {
        var calls = 0
        StubProtocol.handler = { request in
            calls += 1
            if request.url!.path == "/api/auth-config" {
                XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
                return (200, Data(#"{"enabled":true,"supabaseUrl":"https://ynkxhrptkvefcizxuvhk.supabase.co","anonKey":"public-only"}"#.utf8))
            }
            XCTAssertEqual(request.url!.host, "ynkxhrptkvefcizxuvhk.supabase.co")
            XCTAssertEqual(request.value(forHTTPHeaderField: "apikey"), "public-only")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer public-only")
            XCTAssertFalse(request.url!.query!.contains("owner_id"))
            return (200, Data(#"[{"id":"1","name":"Research","specialty":"Analysis","description":null,"skills":[],"availability":"Available","verification_status":"Unverified"}]"#.utf8))
        }
        let result = try await client().agents()
        XCTAssertEqual(result.first?.name, "Research")
        XCTAssertEqual(calls, 2)
    }
    func testPrivateWorkspaceCannotUseAnonymousFallback() async {
        StubProtocol.handler = { request in
            XCTAssertEqual(request.url!.path, "/api/auth-config")
            return (200, Data(#"{"enabled":true,"supabaseUrl":"https://ynkxhrptkvefcizxuvhk.supabase.co","anonKey":"public-only"}"#.utf8))
        }
        do { _ = try await client().contracts(); XCTFail("Expected sign-in requirement") }
        catch { XCTAssertEqual(error.localizedDescription, ExchangeError.signedOut.localizedDescription) }
    }
    func testProviderErrorsDoNotExposeRawResponse() async {
        StubProtocol.handler = { _ in (503, Data("private provider internals".utf8)) }
        do { _ = try await client().agents(); XCTFail("Expected error") }
        catch { XCTAssertFalse(error.localizedDescription.contains("private provider")) }
    }
    func testAuthenticationFailuresGiveSafeActionableMessages() async {
        for (code, expected) in [
            ("invalid_credentials", "Your email or password is incorrect. Please check your AgentExchange sign-in details."),
            ("email_not_confirmed", "Confirm your email address before signing in."),
            ("unexpected_provider_code", "Sign-in could not be completed. Please try again or contact support.")
        ] {
            StubProtocol.handler = { request in
                if request.url!.path == "/api/auth-config" {
                    return (200, Data(#"{"enabled":true,"supabaseUrl":"https://ynkxhrptkvefcizxuvhk.supabase.co","anonKey":"public-only"}"#.utf8))
                }
                XCTAssertEqual(request.url!.path, "/auth/v1/token")
                return (400, try JSONSerialization.data(withJSONObject: ["error_code": code, "msg": "private provider internals"]))
            }
            do { _ = try await client().signIn(email: "test@example.invalid", password: "test-only"); XCTFail("Expected sign-in rejection") }
            catch { XCTAssertEqual(error.localizedDescription, expected) }
        }
    }
    func testPKCEUsesRFC7636SHA256VectorAndUniqueVerifiers() throws {
        XCTAssertEqual(OAuthFlow.challenge(for: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
        let first = try OAuthFlow(), second = try OAuthFlow()
        XCTAssertNotEqual(first.verifier, second.verifier)
        XCTAssertEqual(first.verifier.count, 43)
        let url = try first.authorizationURL(configuration: AuthConfiguration(enabled: true, supabaseUrl: "https://ynkxhrptkvefcizxuvhk.supabase.co", anonKey: "public"))
        XCTAssertFalse(url.absoluteString.contains(first.verifier))
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)!.queryItems!
        XCTAssertEqual(items.first(where: { $0.name == "redirect_to" })?.value, OAuthFlow.callback.absoluteString)
        XCTAssertEqual(items.first(where: { $0.name == "code_challenge_method" })?.value, "s256")
    }
    func testOAuthRejectsForeignAmbiguousAndTokenCallbacks() throws {
        XCTAssertEqual(try OAuthFlow.code(from: URL(string: "ai.agentsexchange.ios://auth/callback?code=test")!), "test")
        for input in [
            "https://auth/callback?code=test", "ai.agentsexchange.ios://attacker/callback?code=test",
            "ai.agentsexchange.ios://auth/other?code=test", "ai.agentsexchange.ios://user@auth/callback?code=test",
            "ai.agentsexchange.ios://auth:443/callback?code=test", "ai.agentsexchange.ios://auth/callback?code=one&code=two",
            "ai.agentsexchange.ios://auth/callback?code=", "ai.agentsexchange.ios://auth/callback?error=denied&code=test",
            "ai.agentsexchange.ios://auth/callback#access_token=secret"
        ] { XCTAssertThrowsError(try OAuthFlow.code(from: URL(string: input)!)) }
    }
    func testCancelledAndReplacedOAuthAttemptsCannotExchangeCodes() async throws {
        var calls = 0
        StubProtocol.handler = { request in
            calls += 1
            XCTAssertEqual(request.url!.path, "/api/auth-config")
            return (200, Data(#"{"enabled":true,"supabaseUrl":"https://ynkxhrptkvefcizxuvhk.supabase.co","anonKey":"public-only"}"#.utf8))
        }
        let client = client()
        let first = try await client.beginGoogleSignIn()
        let second = try await client.beginGoogleSignIn()
        let callback = URL(string: "ai.agentsexchange.ios://auth/callback?code=test")!
        do { _ = try await client.completeGoogleSignIn(id: first.id, callback: callback); XCTFail("Old attempt accepted") } catch { }
        await client.cancelGoogleSignIn(id: second.id)
        do { _ = try await client.completeGoogleSignIn(id: second.id, callback: callback); XCTFail("Cancelled attempt accepted") } catch { }
        XCTAssertEqual(calls, 1)
    }

    func testExpiredSessionRefreshesBeforePrivateReadAndPersistsRotation() async throws {
        var saved: AuthSession?
        let expired = AuthSession(access_token: "expired", refresh_token: "refresh-one", expires_at: 1, user: AuthUser(id: "user", email: nil))
        let storage = SessionStorage(read: { expired }, save: { saved = $0 }, clear: {})
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [StubProtocol.self]
        var refreshCount = 0
        StubProtocol.handler = { request in
            if request.url!.path == "/api/auth-config" { return (200, Data(#"{"enabled":true,"supabaseUrl":"https://ynkxhrptkvefcizxuvhk.supabase.co","anonKey":"public-only"}"#.utf8)) }
            if request.url!.path == "/auth/v1/token" {
                XCTAssertTrue(request.url!.query!.contains("grant_type=refresh_token")); refreshCount += 1
                return (200, try JSONEncoder().encode(AuthSession(access_token: "fresh", refresh_token: "refresh-two", expires_at: Date().timeIntervalSince1970 + 3600, user: AuthUser(id: "user", email: nil))))
            }
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer fresh")
            return (200, Data("[]".utf8))
        }
        let client = ExchangeClient(network: URLSession(configuration: config), storage: storage)
        _ = try await client.contracts(); _ = try await client.contracts()
        XCTAssertEqual(refreshCount, 1); XCTAssertEqual(saved?.refresh_token, "refresh-two")
    }
    func testDeletionRequestKeepsSessionAndCompletedDeletionClearsIt() async throws {
        let session = AuthSession(access_token: "current", refresh_token: "refresh", expires_at: Date().timeIntervalSince1970 + 3600, user: AuthUser(id: "user", email: nil))
        var cleared = false; var completed = false
        let storage = SessionStorage(read: { session }, save: { _ in }, clear: { cleared = true })
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [StubProtocol.self]
        StubProtocol.handler = { request in
            XCTAssertEqual(request.url!.path, "/api/delete-account")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer current")
            return (completed ? 200 : 202, Data((completed ? #"{"status":"deleted","appleDisconnectRequired":true}"# : #"{"status":"requested","message":"Request saved"}"#).utf8))
        }
        let client = ExchangeClient(network: URLSession(configuration: config), storage: storage)
        let pending = try await client.deleteAccount()
        XCTAssertEqual(pending.status, "requested"); XCTAssertFalse(cleared)
        let user = await client.currentUser(); XCTAssertEqual(user?.id, "user")
        completed = true
        let deleted = try await client.deleteAccount()
        XCTAssertEqual(deleted.appleDisconnectRequired, true); XCTAssertTrue(cleared)
        let absent = await client.currentUser(); XCTAssertNil(absent)
    }

}
