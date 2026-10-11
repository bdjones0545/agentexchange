import Foundation

final class ExchangeRedirectGuard: NSObject, URLSessionTaskDelegate {
    static func permits(from: URL?, to: URL?) -> Bool {
        guard let from, let to else { return false }
        return to.scheme == "https" && from.host == to.host && from.port == to.port
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(Self.permits(from: response.url, to: request.url) ? request : nil)
    }
}

actor ExchangeClient {
    static let website = URL(string: "https://www.agentsexchange.ai")!
    private let network: URLSession
    private let storage: SessionStorage
    private var config: AuthConfiguration?
    private var session: AuthSession?
    private var refreshTask: Task<AuthSession, Error>?
    private var sessionGeneration = 0
    private var pendingOAuth: OAuthFlow?
    init(network: URLSession = URLSession(configuration: .ephemeral, delegate: ExchangeRedirectGuard(), delegateQueue: nil), restoreSession: Bool = true, storage: SessionStorage = .keychain) {
        self.network = network
        self.storage = storage
        self.session = restoreSession ? storage.read() : nil
    }
    func currentUser() -> AuthUser? { session?.user }
    private func configuration() async throws -> AuthConfiguration {
        if let config { return config }
        let data = try await send(URLRequest(url: Self.website.appendingPathComponent("api/auth-config")))
        let value = try JSONDecoder().decode(AuthConfiguration.self, from: data)
        _ = try value.validatedURL()
        config = value
        return value
    }
    private func send(_ request: URLRequest, authentication: Bool = false) async throws -> Data {
        var request = request
        request.timeoutInterval = 25
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let (data, response) = try await network.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ExchangeError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message: String
            switch http.statusCode {
            case 400 where authentication:
                let response = try? JSONDecoder().decode(AuthenticationFailure.self, from: data)
                switch response?.error_code {
                case "invalid_credentials": message = "Your email or password is incorrect. Please check your AgentExchange sign-in details."
                case "email_not_confirmed": message = "Confirm your email address before signing in."
                default: message = "Sign-in could not be completed. Please try again or contact support."
                }
            case 401: message = "Your session has expired or your sign-in details are incorrect. Please sign in again."
            case 403: message = "This action requires a recent sign-in or additional account authorization."
            case 409: message = "This action could not complete. Please update the app and try again."
            case 429: message = "Too many requests. Please wait a moment and try again."
            default: message = "The service is unavailable right now. Please try again."
            }
            throw ExchangeError.response(http.statusCode, message)
        }
        return data
    }
    private func authenticate(grant: String, body: [String: String]) async throws -> AuthSession {
        let config = try await configuration()
        var components = URLComponents(url: try config.validatedURL().appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: grant)]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try JSONDecoder().decode(AuthSession.self, from: await send(request, authentication: true))
    }
    private struct AuthenticationFailure: Decodable { let error_code: String? }
    func signIn(email: String, password: String) async throws -> AuthUser {
        let generation = sessionGeneration
        let value = try await authenticate(grant: "password", body: ["email": email.trimmingCharacters(in: .whitespacesAndNewlines), "password": password])
        guard generation == sessionGeneration else { throw ExchangeError.signedOut }
        try storage.save(value)
        sessionGeneration += 1
        pendingOAuth = nil
        refreshTask?.cancel(); refreshTask = nil
        session = value
        return value.user
    }
    func signInWithApple(idToken: String, nonce: String) async throws -> AuthUser {
        let generation = sessionGeneration
        let value = try await authenticate(grant: "id_token", body: ["provider": "apple", "id_token": idToken, "nonce": nonce])
        guard generation == sessionGeneration else { throw ExchangeError.signedOut }
        try storage.save(value)
        sessionGeneration += 1; pendingOAuth = nil
        refreshTask?.cancel(); refreshTask = nil
        session = value
        return value.user
    }
    func beginGoogleSignIn() async throws -> (id: UUID, url: URL) {
        let generation = sessionGeneration
        let configuration = try await configuration()
        guard generation == sessionGeneration else { throw ExchangeError.signedOut }
        let flow = try OAuthFlow()
        // Starting a newer flow also invalidates an earlier token exchange in flight.
        sessionGeneration += 1
        refreshTask?.cancel(); refreshTask = nil
        pendingOAuth = flow
        return (flow.id, try flow.authorizationURL(configuration: configuration))
    }
    func cancelGoogleSignIn(id: UUID) {
        if pendingOAuth?.id == id { pendingOAuth = nil }
    }
    func completeGoogleSignIn(id: UUID, callback: URL) async throws -> AuthUser {
        guard let flow = pendingOAuth, flow.id == id else { throw ExchangeError.signedOut }
        pendingOAuth = nil
        guard Date().timeIntervalSince(flow.createdAt) < 600 else { throw ExchangeError.signedOut }
        let code = try OAuthFlow.code(from: callback)
        let generation = sessionGeneration
        let value = try await authenticate(grant: "pkce", body: ["auth_code": code, "code_verifier": flow.verifier])
        guard generation == sessionGeneration else { throw ExchangeError.signedOut }
        try storage.save(value)
        sessionGeneration += 1
        pendingOAuth = nil
        refreshTask?.cancel(); refreshTask = nil
        session = value
        return value.user
    }
    private func accessToken() async throws -> String {
        guard let current = session else { throw ExchangeError.signedOut }
        if !current.needsRefresh { return current.access_token }
        let generation = sessionGeneration
        if let refreshTask {
            let value = try await refreshTask.value
            guard generation == sessionGeneration else { throw ExchangeError.signedOut }
            return value.access_token
        }
        let task = Task { try await self.authenticate(grant: "refresh_token", body: ["refresh_token": current.refresh_token]) }
        refreshTask = task
        defer { if generation == sessionGeneration { refreshTask = nil } }
        do {
            let value = try await task.value
            // A sign-out while the request is running must not restore the old session.
            guard generation == sessionGeneration, session?.refresh_token == current.refresh_token else { throw ExchangeError.signedOut }
            try storage.save(value)
            session = value
            return value.access_token
        } catch {
            if generation == sessionGeneration, case ExchangeError.response(let code, _) = error, code == 400 || code == 401 {
                session = nil; storage.clear()
            }
            throw error
        }
    }
    func signOut() async {
        let token = session?.access_token
        sessionGeneration += 1
        pendingOAuth = nil
        session = nil
        refreshTask?.cancel(); refreshTask = nil
        storage.clear()
        guard let token, let config = try? await configuration(), let base = try? config.validatedURL() else { return }
        var components = URLComponents(url: base.appendingPathComponent("auth/v1/logout"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "scope", value: "local")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        _ = try? await send(request)
    }
    private func rows<T: Decodable>(table: String, columns: String, privateData: Bool = false, filter: URLQueryItem? = nil, order: String = "id.asc") async throws -> [T] {
        let config = try await configuration()
        let token = privateData ? try await accessToken() : config.anonKey!
        var results: [T] = []
        for offset in stride(from: 0, to: 10000, by: 500) {
            var components = URLComponents(url: try config.validatedURL().appendingPathComponent("rest/v1/\(table)"), resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "select", value: columns), URLQueryItem(name: "order", value: order), URLQueryItem(name: "limit", value: "500"), URLQueryItem(name: "offset", value: String(offset))]
            if let filter { components.queryItems!.append(filter) }
            var request = URLRequest(url: components.url!)
            request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            let page = try JSONDecoder().decode([T].self, from: await send(request))
            results += page
            if page.count < 500 { return results }
        }
        throw ExchangeError.response(0, "There are too many records to load. Please contact support.")
    }
    func agents() async throws -> [ExchangeAgent] {
        try await rows(table: "agents", columns: "id,name,specialty,description,skills,availability,verification_status", privateData: session != nil)
    }
    func contracts() async throws -> [ExchangeContract] {
        try await rows(table: "contracts", columns: "id,title,agent_id,agent_name,organization_name,status,progress,due_date", privateData: true)
    }
    func messages(contractID: String) async throws -> [ContractMessage] {
        let values: [ContractMessage] = try await rows(table: "contract_messages", columns: "id,author,body,created_at", privateData: true, filter: URLQueryItem(name: "contract_id", value: "eq.\(contractID)"))
        return values.sorted { $0.created_at < $1.created_at }
    }
    func deliverables(contractID: String) async throws -> [Deliverable] {
        try await rows(table: "contract_deliverables", columns: "id,title,notes,status", privateData: true, filter: URLQueryItem(name: "contract_id", value: "eq.\(contractID)"))
    }
    func deleteAccount() async throws -> DeletionResult {
        let generation = sessionGeneration
        var request = URLRequest(url: Self.website.appendingPathComponent("api/delete-account"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(try await accessToken())", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["confirmation": "DELETE", "requestVersion": 2])
        let value = try JSONDecoder().decode(DeletionResult.self, from: await send(request))
        guard generation == sessionGeneration else { throw ExchangeError.signedOut }
        if value.status == "deleted" { sessionGeneration += 1; session = nil; storage.clear() }
        return value
    }
    private func safetyRPC(_ name: String, body: [String: String]) async throws {
        let config = try await configuration()
        var request = URLRequest(url: try config.validatedURL().appendingPathComponent("rest/v1/rpc/" + name))
        request.httpMethod = "POST"
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(try await accessToken())", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        _ = try await send(request)
    }
    func report(kind: String, id: String, reason: String, details: String) async throws {
        try await safetyRPC("report_content", body: ["kind": kind, "target": id, "report_reason": reason, "report_details": details])
    }
    func block(agentID: String) async throws {
        try await safetyRPC("block_agent_operator", body: ["target_agent": agentID])
    }
    func block(contractID: String) async throws {
        try await safetyRPC("block_contract_operator", body: ["target_contract": contractID])
    }
    func safetyRequests(table: String) async throws -> [SafetyRequest] {
        guard ["content_reports", "account_deletion_requests"].contains(table) else { throw ExchangeError.invalidResponse }
        return try await rows(table: table, columns: "id,status,response", privateData: true)
    }
    func blocks() async throws -> [OperatorBlock] {
        try await rows(table: "blocked_operators", columns: "target_user_id", privateData: true, order: "target_user_id.asc")
    }
    func unblock(userID: String) async throws {
        let config = try await configuration()
        var components = URLComponents(url: try config.validatedURL().appendingPathComponent("rest/v1/blocked_operators"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "target_user_id", value: "eq." + userID)]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "DELETE"
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(try await accessToken())", forHTTPHeaderField: "Authorization")
        _ = try await send(request)
    }

}
