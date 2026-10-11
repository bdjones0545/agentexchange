import Foundation
import Security

enum SessionVault {
    private static let service = "ai.agentsexchange.ios.session"
    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "operator"]
    }
    static func read() -> AuthSession? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        guard SecItemCopyMatching(request as CFDictionary, &value) == errSecSuccess,
              let data = value as? Data else { return nil }
        return try? JSONDecoder().decode(AuthSession.self, from: data)
    }
    static func save(_ session: AuthSession) throws {
        let data = try JSONEncoder().encode(session)
        let update = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if update == errSecSuccess { return }
        guard update == errSecItemNotFound else { throw ExchangeError.response(0, "Your session could not be saved securely.") }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else {
            throw ExchangeError.response(0, "Your session could not be saved securely.")
        }
    }
    static func clear() { SecItemDelete(query as CFDictionary) }
}

// Injectable persistence keeps session lifecycle tests isolated from the real Keychain.
struct SessionStorage {
    var read: () -> AuthSession?
    var save: (AuthSession) throws -> Void
    var clear: () -> Void
    static let keychain = SessionStorage(read: SessionVault.read, save: SessionVault.save, clear: SessionVault.clear)
}
