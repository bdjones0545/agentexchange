import SwiftUI

struct ReportTarget: Identifiable { let kind: String; let id: String }

struct ReportView: View {
    let kind: String
    let targetID: String
    @EnvironmentObject private var store: ExchangeStore
    @Environment(\.dismiss) private var dismiss
    @State private var reason = "abuse"
    @State private var details = ""
    @State private var busy = false
    @State private var error: String?
    @State private var submitted = false
    var body: some View {
        NavigationStack {
            Form {
                if submitted {
                    Section { Label("Report received", systemImage: "checkmark.circle"); Text("We review abuse reports within 24 hours. Track the response in Account → Reports and deletion requests.") }
                } else if store.user == nil {
                    Section { Text("Sign in from Account to submit a report and track its response. You can also contact support from Account.") }
                } else {
                    Section("What happened?") {
                        Picker("Reason", selection: $reason) {
                            Text("Abuse or harassment").tag("abuse")
                            Text("Sexual content").tag("sexual")
                            Text("Violence or threats").tag("violence")
                            Text("Fraud or impersonation").tag("fraud")
                            Text("Other concern").tag("other")
                        }
                        TextField("Additional details (optional)", text: $details, axis: .vertical).lineLimit(4...8)
                        Text("Do not include passwords or payment card details. Reports are sent privately to AgentExchange for review.").font(.caption).foregroundStyle(.secondary)
                    }
                    if let error { Section { Text(error).foregroundStyle(.red) } }
                    Button("Submit report") {
                        Task {
                            busy = true
                            defer { busy = false }
                            do { try await store.client.report(kind: kind, id: targetID, reason: reason, details: details); submitted = true }
                            catch { self.error = error.localizedDescription }
                        }
                    }.disabled(busy || details.count > 2000)
                }
            }.navigationTitle("Report content")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}

struct BlockOperatorButton: View {
    let contractID: String
    @EnvironmentObject private var store: ExchangeStore
    @State private var result: String?
    @State private var busy = false
    var body: some View {
        Button("Block the other operator", systemImage: "person.slash", role: .destructive) {
            Task {
                busy = true
                defer { busy = false }
                do { try await store.client.block(contractID: contractID); await store.loadAgents(); result = "Operator blocked. New contact is prevented in both directions. Existing records remain available." }
                catch { result = error.localizedDescription }
            }
        }.disabled(busy)
        if let result { Text(result).font(.caption) }
    }
}

struct SafetyRequestsView: View {
    @EnvironmentObject private var store: ExchangeStore
    @State private var reports: [SafetyRequest] = []
    @State private var deletions: [SafetyRequest] = []
    @State private var loading = true
    @State private var error: String?
    var body: some View {
        List {
            if loading { ProgressView("Loading requests…") }
            if let error { ErrorRow(message: error) { await load() } }
            Section("Account deletion") {
                if !loading && deletions.isEmpty { Text("No deletion requests") }
                ForEach(deletions) { request in requestRow(request) }
            }
            Section("Content reports") {
                if !loading && reports.isEmpty { Text("No reports submitted") }
                ForEach(reports) { request in requestRow(request) }
            }
        }.navigationTitle("Your requests").task { await load() }.refreshable { await load() }
    }
    private func requestRow(_ request: SafetyRequest) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(request.status.capitalized).font(.headline)
            Text(request.response)
            Text("Reference: \(request.id)").font(.caption).foregroundStyle(.secondary).textSelection(.enabled)
        }
    }
    private func load() async {
        loading = true
        defer { loading = false }
        do {
            async let fetchedReports = store.client.safetyRequests(table: "content_reports")
            async let fetchedDeletions = store.client.safetyRequests(table: "account_deletion_requests")
            (reports, deletions) = try await (fetchedReports, fetchedDeletions)
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}

struct BlockedOperatorsView: View {
    @EnvironmentObject private var store: ExchangeStore
    @State private var blocks: [OperatorBlock] = []
    @State private var error: String?
    @State private var loading = true
    var body: some View {
        List {
            if loading { ProgressView("Loading blocked operators…") }
            if let error { ErrorRow(message: error) { await load() } }
            if !loading && blocks.isEmpty { Text("No blocked operators") }
            ForEach(blocks) { block in
                VStack(alignment: .leading, spacing: 8) {
                    Text("Blocked operator").font(.headline)
                    Text("Reference: \(block.target_user_id)").font(.caption).foregroundStyle(.secondary)
                    Button("Unblock") {
                        Task {
                            do { try await store.client.unblock(userID: block.target_user_id); await load(); await store.loadAgents() }
                            catch { self.error = error.localizedDescription }
                        }
                    }
                }
            }
        }.navigationTitle("Blocked operators").task { await load() }.refreshable { await load() }
    }
    private func load() async {
        loading = true
        defer { loading = false }
        do { blocks = try await store.client.blocks(); error = nil }
        catch { self.error = error.localizedDescription }
    }
}
