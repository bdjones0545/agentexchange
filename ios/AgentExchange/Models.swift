import Foundation

struct ExchangeAgent: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let specialty: String
    let description: String?
    let skills: [String]
    let availability: String
    let verification_status: String
}
struct ExchangeContract: Codable, Identifiable, Hashable {
    let agent_id: String?
    let id: String
    let title: String
    let agent_name: String
    let organization_name: String
    let status: String
    let progress: Double?
    let due_date: String?
}
struct ContractMessage: Codable, Identifiable {
    let id: String
    let author: String
    let body: String
    let created_at: String
}
struct Deliverable: Codable, Identifiable {
    let id: String
    let title: String
    let notes: String?
    let status: String
}
struct AuthConfiguration: Decodable {
    let enabled: Bool
    let supabaseUrl: String?
    let anonKey: String?
    func validatedURL() throws -> URL {
        guard enabled, let url = URL(string: supabaseUrl ?? ""),
              url.scheme == "https", url.host == "ynkxhrptkvefcizxuvhk.supabase.co",
              url.user == nil, url.password == nil, url.port == nil,
              url.path.isEmpty || url.path == "/", url.query == nil, url.fragment == nil,
              let anonKey, !anonKey.isEmpty else { throw ExchangeError.configuration }
        return url
    }
}
struct AuthUser: Codable { let id: String; let email: String? }
struct AuthSession: Codable {
    let access_token: String
    let refresh_token: String
    let expires_at: TimeInterval?
    let user: AuthUser
    var needsRefresh: Bool { (expires_at ?? 0) < Date().timeIntervalSince1970 + 90 }
}
enum ExchangeError: LocalizedError {
    case configuration, signedOut, response(Int, String), invalidResponse
    var errorDescription: String? {
        switch self {
        case .configuration: return "AgentExchange is temporarily unavailable. Please try again."
        case .signedOut: return "Please sign in to view your workspace."
        case .invalidResponse: return "The service returned an unexpected response. Please try again."
        case .response(_, let message): return message
        }
    }
}
enum ExchangeSearch {
    static func filter(_ agents: [ExchangeAgent], query: String, saved: Set<String>?, hidden: Set<String>) -> [ExchangeAgent] {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return agents.filter { agent in
            !hidden.contains(agent.id) && (saved == nil || saved!.contains(agent.id)) &&
            (text.isEmpty || ([agent.name, agent.specialty] + agent.skills).joined(separator: " ").localizedCaseInsensitiveContains(text))
        }
    }
}

struct DeletionResult: Decodable {
    let status: String
    let message: String?
    let appleDisconnectRequired: Bool?
}
struct SafetyRequest: Decodable, Identifiable {
    let id: String
    let status: String
    let response: String
}
struct OperatorBlock: Decodable, Identifiable {
    let target_user_id: String
    var id: String { target_user_id }
}
