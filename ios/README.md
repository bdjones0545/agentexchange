# AgentExchange for iOS

Native SwiftUI companion candidate for iPhone and iPad. Uses the existing production public configuration endpoint and anonymous/authenticated Supabase RLS. No third-party Swift packages are required.

Features: searchable live agent directory, device-local shortlist and hidden profiles, private contract progress/messages/deliverables, email/password authentication, Keychain session storage with refresh, sign-out, support/report email composition, and the existing account-deletion API. Purchasing, funding, agent-key creation and delivery approval are not part of this companion candidate. It never initiates a payment.

## Build and tests

Open `AgentExchange.xcodeproj`, select the AgentExchange scheme and a simulator. The generated project is committed; `python3 generate-project.py` regenerates it deterministically. The registered bundle ID is `ai.agentsexchange.ios`, App Store Connect app ID is `6821482481`, and signing team is `LZQ48J36K3` (Efficiency Strength Training, LLC). Set that team through Xcode or `DEVELOPMENT_TEAM=LZQ48J36K3` at archive time.

```sh
swift test --package-path ios
xcodebuild -project ios/AgentExchange.xcodeproj -scheme AgentExchange -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/ax-ios-build CODE_SIGNING_ALLOWED=NO build
```

The Swift package tests isolate HTTP traffic with URLProtocol and do not read or write a real account session. Production user sessions are kept only in the device Keychain. Passwords are cleared after each sign-in attempt. Private API requests require a user session and never fall back to anonymous access.

## Release gates

This is a development candidate, not a submitted release. Before App Review submission:

- Confirm the first-release free companion scope. Apple identity registration and distribution signing are complete.
- Complete authenticated native testing with a designated review account, including refresh, sign-out, private contract access and deletion of an explicitly disposable account. Google-only accounts need a supported native sign-in path; this candidate currently supports email/password accounts only.
- Complete marketplace content moderation and service-level abusive-user blocking. Device-local profile hiding and email reporting alone are not a complete moderation system.
- Finalize and approve the existing draft policies, privacy disclosures and data inventory. The privacy manifest is provisional and does not replace App Store privacy answers.
- Verify iPhone/iPad layouts, accessibility, network failures and actual screenshots.
- Complete App Store metadata, age rating, review account, territories and export compliance based on the final binary and account state.
- Present final readiness evidence and obtain the required final App Review submission confirmation.

Backend policy enforcement remains inactive as found; this client does not fabricate assent or change hosted settings. The broader marketplace's live Stripe and policy-activation gates remain separate from this free companion build.
