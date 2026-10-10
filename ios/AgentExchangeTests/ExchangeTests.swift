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
}
