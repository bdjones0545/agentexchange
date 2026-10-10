// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "AgentExchangeCore", platforms: [.macOS(.v13)], products: [.library(name: "AgentExchangeCore", targets: ["AgentExchangeCore"])], targets: [
    .target(name: "AgentExchangeCore", path: "AgentExchange", exclude: ["AgentExchangeApp.swift", "Views.swift", "Assets.xcassets", "PrivacyInfo.xcprivacy"], sources: ["Models.swift", "SessionVault.swift", "ExchangeClient.swift"]),
    .testTarget(name: "AgentExchangeCoreTests", dependencies: ["AgentExchangeCore"], path: "AgentExchangeTests")
])
