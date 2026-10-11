# App Store release status — October 10, 2026

NOT SUBMITTED TO APP REVIEW. App Store Connect draft created; build 1 uploaded and processed successfully. Native companion candidate still has open release gates.

Source: `release/ios-app-store`, based on `harden/bounded-marketplace` at `7e00f4ca28df11516acce125543b99f96fc513d0`. The original offloaded working copy was preserved. The committed source was recovered into this separate checkout; its later uncommitted handoff documents were consulted, not overwritten.

## Completed

- Native SwiftUI iPhone/iPad project with live public search, device-local saved/hidden profiles, authenticated contract/messages/deliverables reading, Keychain sessions, refresh, sign-out, support/report composition and the existing account deletion endpoint.
- No payment initiation, credential minting, fabricated policy acceptance or production database mutation.
- Public configuration host validation and cross-origin/downgrade redirect protection. Private requests require an authenticated session. Session changes discard stale workspace results; sign-out recreates the private navigation stack.
- Existing vector brand mark rendered as a 1024 × 1024 opaque App Store icon.
- Draft listing text and provisional privacy manifest. Bundle ID `ai.agentsexchange.ios` is registered under Efficiency Strength Training, LLC, team `LZQ48J36K3`. App Store Connect app ID `6821482481`, SKU `agentexchange-ios`, English (U.S.), Productivity category. Listing description, keywords, URLs, copyright and subtitle are saved.
- Compatible `source-map-js` update 1.2.1 → 1.2.2; npm reports zero vulnerabilities.

## Verified locally

- Web: 276 tests pass; six safe-diagnostics tests pass; production client and server-render builds pass.
- Native core: six tests pass. These cover untrusted configuration, redirects, public request isolation, private anonymous denial, errors and search filters. They do not establish successful real-user authentication or session refresh.
- Isolated PostgreSQL: policy ledger/enforcement/evidence checks, three-party RLS authorization and payment concurrency/recovery suite pass. No hosted acceptance activation occurred.
- Public production HTTP checks: 21/21 pass.
- Simulator app compilation passes. Both unsigned and signed generic iOS archives build. App Store distribution export succeeds; the exported profile matches the registered bundle/team, has `get-task-allow=false` and TestFlight reporting enabled.

GitHub draft PR: https://github.com/bdjones0545/agentexchange/pull/50. At app-source commit `deae212`, web CI, database authorization CI, native tests/build CI and the Vercel preview all passed. Subsequent application changes must pass their own checks. The final unsigned archive is preserved under `release-evidence/agentexchange-2026-10-10/AgentExchange-1.0-UNSIGNED.xcarchive.zip` in the shared workspace.

## Open release gates

1. Apple account access, app identity and distribution signing are verified. App Store Connect draft is at Prepare for Submission; build 1 upload succeeded on October 10, 2026 at 20:00 EDT; TestFlight shows Ready to Submit (90-day testing expiry). Full team access was explicitly approved by the owner. Availability, age rating, content rights and privacy disclosures remain unfinished. The inherited app-level DSA declaration displays non-trader; owner confirmation is needed before selecting EU availability.
2. Product scope: free companion proposed while awaiting owner response. In-app purchasing would require a separate implementation and commercial review.
3. Native verification: designated existing email/password review account; real sign-in/refresh/logout, RLS isolation and eligible deletion with an explicitly disposable account. Google-only account support is not yet implemented.
4. Moderation: reporting by email and local hiding do not replace service-level abusive-user blocking, content filtering and an operational response queue. Apple guideline 1.2 remains open.
5. Policies: the website still publishes draft terms/privacy/refund/acceptable-use wording. Final policy and retention decisions and coordinated policy activation remain open; see existing `LEGAL_LAUNCH_REVIEW.md` and the original upgrade checkout's `POLICY_ACTIVATION_PLAN.md`.
6. Marketplace live money: existing handoff still leaves live Stripe activation, provider failure/refund/reversal evidence and operational review pending. Local/database passes do not close those gates.
7. Store preparation: verified screenshots, listing/privacy/age-rating answers, review access and final release validation remain outstanding. The first distribution-signed candidate is preserved as `release-evidence/agentexchange-2026-10-10/AgentExchange-1.0-1.ipa`.

The initial iPhone simulator stalled at “Waiting on System App”; a new isolated iPhone 17 simulator also failed to finish startup. Both were shut down without deleting data. Neither attempt verified app rendering. Do not treat compiler success as visual or authenticated acceptance.

References: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords).

## Apple upload evidence

`xcodebuild -exportArchive` returned exit 0 and “Upload succeeded” for version 1.0 (1). App Store profile: `iOS Team Store Provisioning Profile: ai.agentsexchange.ios`, team `LZQ48J36K3`, debug entitlement false. Uploading does not submit the app to review or make it public.

App record: https://appstoreconnect.apple.com/apps/6821482481/distribution/ios/version/inflight

TestFlight build ID: `11b83899-1809-4037-aa47-b0fe77204949`. Chrome confirmed version 1.0 build 1 as Ready to Submit after the in-app browser session expired. No testers were invited and no App Review submission occurred.

A third isolated simulator attempt allowed 240 seconds for boot; it remained Waiting on System App. Installation completed, but launch timed out after 45 seconds. The simulator was shut down without deleting data. Real-device testing and screenshots remain open.

The Desktop checkout began offloading source files and its branch ref to iCloud during release work, stalling Git reads. Only our stalled commands were stopped. The documentation update was prepared in `/tmp/agentexchange-apple-release-record`, a fresh checkout of the same release branch, to avoid overwriting offloaded files. The original checkout retains the same documentation edits.

## Supplied-account verification and build 2

The owner-supplied email/password was tested using the shipped Swift networking and model code on macOS, with a separate verification-only Keychain namespace. Sign-in returned HTTP 400. One diagnostic attempt with the same credentials confirmed the safe provider code `invalid_credentials`. No private records were retrieved, no account deletion was attempted, and no marketplace records or payments were changed. The password was provided through hidden terminal input and was not written to files or printed in test output. Apple review credentials remain blank.

This exposed a user-facing defect: the native app described rejected credentials as service unavailability. Build 2 maps the recognized invalid-credentials and unconfirmed-email responses to safe, actionable messages, with a sanitized fallback for other authentication errors. All seven native tests pass, including the new regression coverage; the signed generic iOS archive succeeds. Build 2 upload is in progress. Account verification remains blocked pending working AgentExchange credentials or clarification of the account's normal sign-in method.
