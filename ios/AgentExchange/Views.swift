import SwiftUI
import AuthenticationServices
import CryptoKit

struct RootView: View {
    @EnvironmentObject private var store: ExchangeStore
    var body: some View {
        TabView {
            NavigationStack { AgentsView() }.tabItem { Label("Discover", systemImage: "sparkle.magnifyingglass") }
            NavigationStack { WorkView() }.id(store.user?.id ?? "signed-out").tabItem { Label("My work", systemImage: "briefcase") }
            NavigationStack { AccountView() }.id(store.user?.id ?? "signed-out").tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}
struct AgentsView: View {
    @EnvironmentObject private var store: ExchangeStore
    @State private var search = ""
    @State private var savedOnly = false
    private var results: [ExchangeAgent] { ExchangeSearch.filter(store.agents, query: search, saved: savedOnly ? store.saved : nil, hidden: store.hidden) }
    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Find your next\nAI collaborator.").font(.largeTitle.bold())
                    Text("Explore operators, compare capabilities and keep your shortlist close.").foregroundStyle(.secondary)
                }.padding(.vertical, 12)
                Picker("Agents", selection: $savedOnly) {
                    Text("Discover").tag(false); Text("Saved").tag(true)
                }.pickerStyle(.segmented)
            }
            if let error = store.error { ErrorRow(message: error) { await store.loadAgents() } }
            if store.loading && store.agents.isEmpty { ProgressView("Loading agents…") }
            if !store.loading && results.isEmpty {
                ContentUnavailableView(savedOnly ? "Your shortlist starts here" : "No matching agents", systemImage: savedOnly ? "bookmark" : "magnifyingglass", description: Text(savedOnly ? "Save agents to compare them later." : "Try another specialty or clear your search."))
            }
            ForEach(results) { agent in
                NavigationLink(value: agent) {
                    HStack(alignment: .top, spacing: 14) {
                        Text(String(agent.name.prefix(2)).uppercased()).font(.headline).frame(width: 48, height: 48).background(.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                        VStack(alignment: .leading, spacing: 6) {
                            Text(agent.name).font(.headline)
                            Text(agent.specialty).foregroundStyle(.secondary)
                            Text(agent.availability).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                        if store.saved.contains(agent.id) { Image(systemName: "bookmark.fill").accessibilityLabel("Saved") }
                    }.padding(.vertical, 7)
                }.swipeActions(edge: .leading) {
                    Button { store.toggleSaved(agent.id) } label: { Label("Save", systemImage: "bookmark") }.tint(.green)
                }
            }
        }
        .navigationTitle("AgentExchange")
        .searchable(text: $search, prompt: "Name, specialty or skill")
        .refreshable { await store.loadAgents() }
        .navigationDestination(for: ExchangeAgent.self) { AgentDetailView(agent: $0) }
    }
}
struct AgentDetailView: View {
    let agent: ExchangeAgent
    @EnvironmentObject private var store: ExchangeStore
    @Environment(\.dismiss) private var dismiss
    @State private var report = false
    @State private var blockError: String?
    @State private var blocking = false
    var body: some View {
        List {
            Section {
                Text(agent.name).font(.largeTitle.bold())
                Text(agent.specialty).font(.title3).foregroundStyle(.secondary)
                Label(agent.availability, systemImage: "circle.fill").font(.caption)
                Button { store.toggleSaved(agent.id) } label: {
                    Label(store.saved.contains(agent.id) ? "Remove from saved" : "Save agent", systemImage: store.saved.contains(agent.id) ? "bookmark.fill" : "bookmark")
                }
            }
            if let description = agent.description, !description.isEmpty { Section("About") { Text(description).textSelection(.enabled) } }
            Section("Skills listed by the operator") {
                ForEach(agent.skills, id: \.self) { Text($0) }
                if agent.skills.isEmpty { Text("No skills listed").foregroundStyle(.secondary) }
            }
            Section("Profile status") {
                Text(agent.verification_status)
                Text("Profile information describes the operator’s claims. Evaluate capabilities against your own requirements.").font(.caption).foregroundStyle(.secondary)
            }
            Section {
                ShareLink(item: ExchangeClient.website.appendingPathComponent("agents/\(agent.id)")) { Label("Share profile", systemImage: "square.and.arrow.up") }
                Button("Report this profile", systemImage: "flag") { report = true }
                if store.user != nil {
                    Button("Block this operator", systemImage: "person.slash", role: .destructive) {
                        Task {
                            blocking = true
                            defer { blocking = false }
                            do { try await store.client.block(agentID: agent.id); await store.loadAgents(); dismiss() }
                            catch { blockError = error.localizedDescription }
                        }
                    }.disabled(blocking)
                    Text("Blocking hides this operator’s profiles and prevents new contact in either direction. Existing contract records remain available.").font(.caption).foregroundStyle(.secondary)
                }
                if let blockError { Text(blockError).foregroundStyle(.red) }
                Button("Hide this agent on this device", systemImage: "eye.slash", role: .destructive) { store.hide(agent.id); dismiss() }
            }
        }.navigationTitle("Agent profile").navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $report) { ReportView(kind: "agent", targetID: agent.id) }
    }
}
struct WorkView: View {
    @EnvironmentObject private var store: ExchangeStore
    @State private var loading = false
    var body: some View {
        Group {
            if store.user == nil {
                ContentUnavailableView("Your work, in one place", systemImage: "briefcase", description: Text("Sign in from Account to follow your existing contracts, messages and deliverables."))
            } else {
                List {
                    if let error = store.error { ErrorRow(message: error) { await store.loadContracts() } }
                    if loading { ProgressView("Loading your work…") }
                    if !loading && store.contracts.isEmpty { ContentUnavailableView("No contracts yet", systemImage: "tray", description: Text("Your existing AgentExchange contracts will appear here.")) }
                    ForEach(store.contracts) { contract in
                        NavigationLink(value: contract) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(contract.title).font(.headline)
                                Text(contract.agent_name).foregroundStyle(.secondary)
                                ProgressView(value: min(100, max(0, contract.progress ?? 0)), total: 100)
                                Text(contract.status).font(.caption).foregroundStyle(.secondary)
                            }.padding(.vertical, 8)
                        }
                    }
                }.refreshable { await store.loadContracts() }
            }
        }.navigationTitle("My work")
            .task(id: store.user?.id) { loading = true; await store.loadContracts(); loading = false }
            .navigationDestination(for: ExchangeContract.self) { ContractView(contract: $0) }
    }
}
struct ContractView: View {
    let contract: ExchangeContract
    @EnvironmentObject private var store: ExchangeStore
    @State private var messages: [ContractMessage] = []
    @State private var deliverables: [Deliverable] = []
    @State private var error: String?
    @State private var loading = true
    @State private var report = false
    @State private var reportedContent: ReportTarget?
    var body: some View {
        List {
            Section {
                Text(contract.title).font(.title2.bold())
                LabeledContent("Agent", value: contract.agent_name)
                LabeledContent("Organization", value: contract.organization_name)
                LabeledContent("Status", value: contract.status)
                if let due = contract.due_date, !due.isEmpty { LabeledContent("Due", value: due) }
                ProgressView(value: min(100, max(0, contract.progress ?? 0)), total: 100)
            }
            if let error { ErrorRow(message: error) { await load() } }
            if loading { ProgressView("Loading workspace…") }
            Section("Deliverables") {
                if !loading && deliverables.isEmpty { Text("No deliverables submitted yet").foregroundStyle(.secondary) }
                ForEach(deliverables) { item in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(item.title).font(.headline)
                        Text(item.status).font(.caption).foregroundStyle(.secondary)
                        if let notes = item.notes { Text(notes).textSelection(.enabled) }
                        Button("Report deliverable", systemImage: "flag") { reportedContent = ReportTarget(kind: "deliverable", id: item.id) }.font(.caption)
                    }.padding(.vertical, 6)
                }
            }
            Section("Messages") {
                if !loading && messages.isEmpty { Text("No messages yet").foregroundStyle(.secondary) }
                ForEach(messages) { message in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(message.author).font(.headline)
                        Text(message.body).textSelection(.enabled)
                        Text(message.created_at.prefix(10)).font(.caption).foregroundStyle(.secondary)
                        Button("Report message", systemImage: "flag") { reportedContent = ReportTarget(kind: "message", id: message.id) }.font(.caption)
                    }.padding(.vertical, 6)
                }
            }
            Section {
                Button("Report this contract", systemImage: "flag") { reportedContent = ReportTarget(kind: "contract", id: contract.id) }
                if contract.agent_id != nil { BlockOperatorButton(contractID: contract.id) }
                Button("Contact support about this contract", systemImage: "questionmark.circle") { report = true }
            }
        }.navigationTitle("Contract").navigationBarTitleDisplayMode(.inline)
            .task { await load() }.refreshable { await load() }
            .sheet(isPresented: $report) { SupportView(subject: "Contract support: \(contract.id)") }
            .sheet(item: $reportedContent) { ReportView(kind: $0.kind, targetID: $0.id) }
    }
    private func load() async {
        loading = true
        defer { loading = false }
        do {
            async let fetchedMessages = store.client.messages(contractID: contract.id)
            async let fetchedDeliverables = store.client.deliverables(contractID: contract.id)
            (messages, deliverables) = try await (fetchedMessages, fetchedDeliverables)
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}
struct AccountView: View {
    @EnvironmentObject private var store: ExchangeStore
    @StateObject private var googleSignIn = GoogleSignIn()
    @State private var appleNonce: String?
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @State private var support = false
    @State private var deletion = false
    @State private var confirmation = ""
    var body: some View {
        Form {
            if let user = store.user {
                Section("Signed in") { Text(user.email ?? "AgentExchange operator"); Button("Sign out") { Task { await store.signOut() } } }
            } else {
                Section {
                    Text("Welcome back").font(.title2.bold())
                    Text("Sign in to your AgentExchange account to view your existing work.").foregroundStyle(.secondary)
                    Button("Continue with Google") { Task { await signInWithGoogle() } }
                        .disabled(busy)
                    SignInWithAppleButton(.continue) { request in
                        do {
                            let nonce = try OAuthFlow().verifier
                            appleNonce = nonce
                            request.requestedScopes = [.email]
                            request.nonce = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
                            busy = true; error = nil
                        } catch { self.error = error.localizedDescription }
                    } onCompletion: { result in
                        Task { await completeAppleSignIn(result) }
                    }
                    .frame(height: 44).disabled(busy)
                    Text("Or use your email and password").font(.caption).foregroundStyle(.secondary)
                    TextField("Email", text: $email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Password", text: $password).textContentType(.password)
                    Button { Task { await signIn() } } label: { HStack { Text("Sign in"); if busy { Spacer(); ProgressView() } } }
                        .disabled(busy || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.isEmpty)
                }
            }
            if let error { Section { Text(error).foregroundStyle(.red).accessibilityLabel("Error: \(error)") } }
            if let deletionNotice = store.deletionNotice { Section("Account deletion") { Text(deletionNotice) } }
            if store.disconnectApple {
                Section("Disconnect Sign in with Apple") {
                    Text("Your AgentExchange account has been deleted. To remove its Apple authorization, open Settings → your name → Sign in with Apple → AgentExchange → Stop Using Apple ID.")
                    Link("Apple’s instructions", destination: URL(string: "https://support.apple.com/en-us/102571")!)
                }
            }
            if store.user != nil {
                Section("Safety and requests") {
                    NavigationLink("Reports and deletion requests") { SafetyRequestsView() }
                    NavigationLink("Blocked operators") { BlockedOperatorsView() }
                }
            }
            Section("Help and privacy") {
                Button("Contact support", systemImage: "envelope") { support = true }
                Link("Privacy policy", destination: ExchangeClient.website.appendingPathComponent("ios-privacy"))
                Link("Terms of service", destination: ExchangeClient.website.appendingPathComponent("ios-terms"))
                Link("Acceptable use", destination: ExchangeClient.website.appendingPathComponent("ios-terms"))
            }
            Section("On this device") {
                if !store.hidden.isEmpty { Button("Restore \(store.hidden.count) hidden agents") { store.restoreHidden() } }
                Text("Saved agents and hidden profiles stay on this device. Sign-in credentials are stored securely in Keychain.").font(.caption).foregroundStyle(.secondary)
            }
            if store.user != nil {
                Section {
                    Button("Delete account", role: .destructive) { deletion = true }
                } footer: { Text("Sign in again before deleting. Accounts with retained marketplace or billing records submit a deletion request here. Check its status in Reports and deletion requests.") }
            }
            Section { Text("AgentExchange · 1.0\nEfficiency Strength Training, LLC").font(.caption).foregroundStyle(.secondary) }
        }.navigationTitle("Account")
            .sheet(isPresented: $support) { SupportView(subject: "AgentExchange support") }
            .alert("Permanently delete your account?", isPresented: $deletion) {
                TextField("Type DELETE", text: $confirmation)
                Button("Cancel", role: .cancel) { confirmation = "" }
                Button("Delete account", role: .destructive) { Task { await deleteAccount() } }.disabled(confirmation != "DELETE" || busy)
            } message: { Text("Eligible accounts will be permanently deleted. Accounts with retained records submit a deletion request for review within 30 days. Records required by law may be retained. Type DELETE to confirm.") }
    }
    private func signInWithGoogle() async {
        busy = true; error = nil
        defer { busy = false }
        do { store.user = try await googleSignIn.signIn(client: store.client); await store.loadAgents() }
        catch let failure as ASWebAuthenticationSessionError where failure.code == .canceledLogin { }
        catch { self.error = "Google sign-in could not be completed. Please try again or contact support." }
    }
    private func completeAppleSignIn(_ result: Result<ASAuthorization, Error>) async {
        defer { busy = false; appleNonce = nil }
        do {
            let authorization = try result.get()
            guard let nonce = appleNonce,
                  let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let token = credential.identityToken,
                  let idToken = String(data: token, encoding: .utf8) else { throw ExchangeError.invalidResponse }
            store.user = try await store.client.signInWithApple(idToken: idToken, nonce: nonce)
            await store.loadAgents()
        } catch let failure as ASAuthorizationError where failure.code == .canceled { }
        catch { self.error = "Apple sign-in could not be completed. Please try again or contact support." }
    }
    private func signIn() async {
        busy = true; error = nil
        defer { busy = false; password = "" }
        do { store.user = try await store.client.signIn(email: email, password: password); await store.loadAgents() }
        catch { self.error = error.localizedDescription }
    }
    private func deleteAccount() async {
        guard confirmation == "DELETE" else { return }
        busy = true
        defer { busy = false; confirmation = "" }
        do {
            let result = try await store.client.deleteAccount()
            store.deletionNotice = result.message ?? "Your account has been deleted."
            store.disconnectApple = result.appleDisconnectRequired ?? false
            if result.status == "deleted" { store.user = nil; store.contracts = []; await store.loadAgents() }
            error = nil
        }
        catch { self.error = error.localizedDescription }
    }
}
struct ErrorRow: View {
    let message: String
    let retry: () async -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(message, systemImage: "exclamationmark.triangle").foregroundStyle(.secondary)
            Button("Try again") { Task { await retry() } }
        }.padding(.vertical, 8)
    }
}
struct SupportView: View {
    let subject: String
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                Section("Contact AgentExchange") {
                    Text("For support, privacy requests or reports of abusive content, contact:")
                    Text("bryan.jones@efficiencystrengthtraining.com").textSelection(.enabled)
                    Text("Reference: \(subject)").font(.caption).textSelection(.enabled)
                    Link("Compose email", destination: emailURL)
                    Text("Include the reference above and describe the concern. Do not include passwords or payment card details.").font(.caption).foregroundStyle(.secondary)
                }
            }.navigationTitle("Support").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
    private var emailURL: URL {
        var parts = URLComponents()
        parts.scheme = "mailto"; parts.path = "bryan.jones@efficiencystrengthtraining.com"
        parts.queryItems = [URLQueryItem(name: "subject", value: subject)]
        return parts.url!
    }
}
