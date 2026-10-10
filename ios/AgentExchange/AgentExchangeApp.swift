import SwiftUI

@main
struct AgentExchangeApp: App {
    @StateObject private var store = ExchangeStore()
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store)
                .tint(Color(red: 0.08, green: 0.48, blue: 0.33))
                .task { await store.restore() }
        }
    }
}

@MainActor
final class ExchangeStore: ObservableObject {
    let client = ExchangeClient()
    @Published var user: AuthUser?
    @Published var agents: [ExchangeAgent] = []
    @Published var contracts: [ExchangeContract] = []
    @Published var saved: Set<String>
    @Published var hidden: Set<String>
    @Published var loading = false
    @Published var error: String?
    private let defaults = UserDefaults.standard
    init() {
        saved = Set(UserDefaults.standard.stringArray(forKey: "savedAgents") ?? [])
        hidden = Set(UserDefaults.standard.stringArray(forKey: "hiddenAgents") ?? [])
    }
    func restore() async { user = await client.currentUser(); await loadAgents() }
    func loadAgents() async {
        loading = true
        defer { loading = false }
        do { agents = try await client.agents(); error = nil }
        catch { self.error = error.localizedDescription }
    }
    func loadContracts() async {
        guard let requestedUser = user?.id else { contracts = []; return }
        do {
            let values = try await client.contracts()
            guard user?.id == requestedUser else { return }
            contracts = values; error = nil
        }
        catch { self.error = error.localizedDescription }
    }
    func toggleSaved(_ id: String) {
        if saved.contains(id) { saved.remove(id) } else { saved.insert(id) }
        defaults.set(Array(saved), forKey: "savedAgents")
    }
    func hide(_ id: String) { hidden.insert(id); defaults.set(Array(hidden), forKey: "hiddenAgents") }
    func restoreHidden() { hidden.removeAll(); defaults.removeObject(forKey: "hiddenAgents") }
    func signOut() async {
        user = nil; contracts = []
        await client.signOut()
    }
}
