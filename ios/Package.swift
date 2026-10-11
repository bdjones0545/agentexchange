// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "AgentExchangeCore", platforms: [.macOS(.v13)], products: [.library(name: "AgentExchangeCore", targets: ["AgentExchangeCore"])], targets: [
    .target(name: "AgentExchangeCore", path: "AgentExchange", exclude: ["AgentExchangeApp.swift", "Views.swift", "GoogleSignIn.swift", "Info.plist", "AgentExchange.entitlements", "Assets.xcassets", "PrivacyInfo.xcprivacy"], sources: ["Models.swift", "SessionVault.swift", "ExchangeClient.swift", "OAuthFlow.swift"]),
    .testTarget(name: "AgentExchangeCoreTests", dependencies: ["AgentExchangeCore"], path: "AgentExchangeTests")
])
