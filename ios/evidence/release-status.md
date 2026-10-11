# App Store release status — October 10, 2026

NOT SUBMITTED TO APP REVIEW. Build 3 is processed and selected in the App Store Connect draft. Native iPhone/iPad public-flow verification, native Google login, private workspace reads, session persistence, sign-out and required screenshot uploads are complete. Apple authentication, automatic token refresh, destructive deletion acceptance, moderation and final policy/store declarations remain open. See the latest verification section below; older dated paragraphs preserve release history.

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
- Native core: ten tests pass. These cover untrusted configuration, redirects, public request isolation, private anonymous denial, errors, search filters, PKCE correctness, callback rejection and cancelled/replaced OAuth attempts. They do not establish successful real-user authentication or session refresh.
- Isolated PostgreSQL: policy ledger/enforcement/evidence checks, three-party RLS authorization and payment concurrency/recovery suite pass. No hosted acceptance activation occurred.
- Public production HTTP checks: 21/21 pass.
- Simulator app compilation passes. Both unsigned and signed generic iOS archives build. App Store distribution export succeeds; the exported profile matches the registered bundle/team, has `get-task-allow=false` and TestFlight reporting enabled.

GitHub draft PR: https://github.com/bdjones0545/agentexchange/pull/50. At app-source commit `deae212`, web CI, database authorization CI, native tests/build CI and the Vercel preview all passed. Subsequent application changes must pass their own checks. The final unsigned archive is preserved under `release-evidence/agentexchange-2026-10-10/AgentExchange-1.0-UNSIGNED.xcarchive.zip` in the shared workspace.

## Open release gates

1. Apple account access, app identity and distribution signing are verified. App Store Connect draft is at Prepare for Submission; build 1 upload succeeded on October 10, 2026 at 20:00 EDT; TestFlight shows Ready to Submit (90-day testing expiry). Full team access was explicitly approved by the owner. Availability, age rating, content rights and privacy disclosures remain unfinished. The inherited app-level DSA declaration displays non-trader; owner confirmation is needed before selecting EU availability.
2. Product scope: free companion proposed while awaiting owner response. In-app purchasing would require a separate implementation and commercial review.
3. Native verification: designated existing email/password review account; real sign-in/refresh/logout, RLS isolation and eligible deletion with an explicitly disposable account. Google/Apple native support is implemented and configured in build 3; real-device verification and Apple token revocation on deletion remain open.
4. Moderation: reporting by email and local hiding do not replace service-level abusive-user blocking, content filtering and an operational response queue. Apple guideline 1.2 remains open.
5. Policies: the website still publishes draft terms/privacy/refund/acceptable-use wording. Final policy and retention decisions and coordinated policy activation remain open; see existing `LEGAL_LAUNCH_REVIEW.md` and the original upgrade checkout's `POLICY_ACTIVATION_PLAN.md`.
6. Marketplace live money: existing handoff still leaves live Stripe activation, provider failure/refund/reversal evidence and operational review pending. Local/database passes do not close those gates.
7. Store preparation: two verified native screenshots for each required iPhone/iPad family and the owner-provided App Review contact are saved. Privacy/age-rating answers, review access and final release validation remain outstanding. The first distribution-signed candidate is preserved as `release-evidence/agentexchange-2026-10-10/AgentExchange-1.0-1.ipa`.

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

This exposed a user-facing defect: the native app described rejected credentials as service unavailability. Build 2 maps the recognized invalid-credentials and unconfirmed-email responses to safe, actionable messages, with a sanitized fallback for other authentication errors. All seven native tests pass, including the new regression coverage; the signed generic iOS archive succeeds. Build 2 upload succeeded on October 10, 2026 at 20:16 EDT; Apple processing is pending. CI at `0042a95` passes: native, web, database authorization and Vercel preview. Account verification remains blocked pending working AgentExchange credentials or clarification of the account's normal sign-in method.


## Google account verification and native social login preparation

The owner clarified that their account uses Google. Chrome's existing Google session successfully signed into https://www.agentsexchange.ai/account and displayed the expected account. No Gmail inbox access was requested. This verifies the website login only; it does not verify native authentication or private RLS behavior.

Apple completed processing build 2 (`bf31f803-66ca-46b8-b9f9-37f49e3fd2d9`): TestFlight shows Ready to Submit. The App Store version draft still selects build 1; attempts to activate the build-removal control timed out without changing the page. No App Review submission occurred.

Supabase dashboard access was explicitly approved after automatic approval review blocked the initial separate backend sign-in. Read-only inspection confirmed Google enabled, Apple disabled, and no native callback allowlisted. Prepared build 3 adds Google through ASWebAuthenticationSession using SHA-256 PKCE and a single-use in-memory verifier, strict callback validation, generation guards, and native Apple ID-token authentication with a nonce. The generic unsigned iOS build and ten native tests pass. Production provider/callback changes and Apple signing capability are awaiting the separate explicit authentication-access approval. Build 3 has not been signed or uploaded.

Required callback: `ai.agentsexchange.ios://auth/callback` (exact, no wildcard). Apple native client ID: `ai.agentsexchange.ios`. Do not replace existing website redirects or disable nonce verification. Native social login remains unverified on a device. Apple credential revocation during account deletion must also be verified before release.


## Approved native login configuration applied

The owner explicitly approved the exact native callback, Apple provider/client ID, Apple Developer capability, and signing-profile regeneration. Supabase now shows Apple enabled for native client ID `ai.agentsexchange.ios` and the exact callback `ai.agentsexchange.ios://auth/callback` alongside all four existing website URLs. Existing Google configuration remains enabled.

Xcode's signed build 3 archive succeeded and contains `com.apple.developer.applesignin = [Default]` for team `LZQ48J36K3`. Tests and all required CI checks at `7227c55` pass (native, web, database authorization, Vercel preview). Export/upload is waiting at distribution codesign for the protected macOS Keychain prompt; no build 3 upload success is claimed yet. Build 2 is now selected and saved in the App Store version draft, verified through native Chrome accessibility after browser-input timeouts. No review submission or public release occurred.

Build 3 upload succeeded October 10, 2026 at 20:37:53 EDT. `xcodebuild -exportArchive` exited 0 and reported EXPORT SUCCEEDED. Apple processing is pending. The Keychain wait has cleared.


Build 3 finished Apple processing and is Ready to Submit in TestFlight, build ID `144ef409-89fb-4a2c-acc0-1ddc7621d390`. It is selected and saved on the version 1.0 draft, with the listing description updated for Google and Apple login. The owner reported a connected/trusted device, but CoreDevice, USB enumeration and Xcode's Devices window show no connected iPhone/iPad. A cable/accessory-trust handoff is pending. No native installation, login acceptance or screenshots are claimed.

## Wireless testing preparation

After another cable attempt, CoreDevice still reports no physical devices and USB enumeration shows no device-name entries. The Mac has approximately 1.1 GiB free, which may also contribute to simulator startup problems; no user data or system settings were changed. Created an empty manual TestFlight internal group `Release Verification` (ID `95735967-e101-4bbd-9fdd-47f5e7777d9b`) and added build 3, which shows Ready to Test. Automatic build distribution is disabled. No tester invitation has been sent; owner approval is required for the specific invitation.


## Native UI verification and listing assets — October 10, 2026, 21:27 EDT

The temporary checkout was lost across the local session restart and restored from the pushed `a7a76d0` release branch. The original iCloud-backed checkout was preserved. The installed app remained available on the isolated iPhone simulator. No application source changed in this verification pass; build 3 application source remains `7227c55`.

| Check | Result | Evidence |
| --- | --- | --- |
| iPhone launch and production discovery | PASS | Real Research and Writing Analyst profile rendered |
| Profile navigation | PASS | Name, specialty, availability, description and skills rendered |
| Save and remove from saved | PASS | Bookmark label toggles; Saved contains the agent, then shows the empty-shortlist state after removal |
| Search | PASS | Nonmatching query shows No matching agents; research query restores the profile |
| Signed-out My Work | PASS | Sign-in guidance appears without private records on iPhone and iPad |
| Account/support screens | PASS | Google/Apple/password controls and support contact are visible; empty email/password submission is disabled |
| Profile report | PASS for local UI only | iPad report sheet includes the correct profile reference and support address; no email sent |
| Hide and restore | PASS | iPad profile disappears from discovery, Account shows Restore 1 hidden agents, and restore returns it |
| Google native handoff and cancellation | PASS for handoff/cancel only | System authorization prompt opens accounts.google.com; cancellation returns with sign-in controls enabled |
| Successful native Google sign-in | PENDING | iPad system browser displays Google email/phone form; owner authentication requested |
| Successful native Apple sign-in | PENDING | Initial unsigned simulator returned recoverable AuthorizationError 1000 / AKAuthenticationError -7026; simulator entitlement rebuild prepared for retest |
| Authenticated refresh/logout/private RLS/deletion | PENDING | Requires successful authentication and a separately authorized disposable account for deletion |

An isolated iPad Pro 13-inch (M5), iOS 26.5 simulator was created for this task: `3FB4179D-5193-49F5-B6D2-A49166B74B09`. The existing iPhone test device is `88AF99D6-3992-4D0E-A5B3-4A520BC05750`. Both rendered the production service. The iPad required several minutes for initial OS migration; no user simulator data was deleted.

### App Store evidence

- The owner-approved TestFlight invitation was sent to the existing owner account in the manual Release Verification group. The earlier pending-invitation paragraph is historical. No additional invitations were sent in this pass.
- App Store Connect was reauthenticated by the owner and still shows version 1.0, build 3, Prepare for Submission.
- Two iPhone captures at 1206 × 2622 were accepted: `iphone-profile.png` and `iphone-discovery-current.png`.
- Two iPad captures at 2064 × 2752 were accepted: `ipad-discovery.png` and `ipad-profile.png`. Media Manager identifies 13-inch iPad as the required family and the smaller sizes as optional.
- Images are unmodified Simulator Save Screen captures, inspected at their actual dimensions. They show public production UI with no browser frame, fabricated data or composites.
- App Review contact name, owner-provided phone, email and accurate draft notes were saved; Save became disabled. Credentials remain blank rather than using a rejected password. Private contact screenshots are kept outside Git.
- Required CI at `a7a76d0` is green: native, verify, database-authorization and Vercel. No new application changes require another App Store build.

These UI passes do not establish authenticated release readiness, service-level moderation, policy acceptance, or an App Review submission. Final submission still requires the complete readiness summary and explicit owner confirmation under the deployment skill.


## Authenticated native acceptance — October 10, 2026

The owner completed Google authentication in the isolated iPad simulator. An unsigned simulator binary rendered the UI but failed authentication. Rebuilding the same application source with simulator signing enabled embedded Xcode's simulated application-identifier and Apple sign-in entitlements. No application source, backend setting, or distribution build changed.

| Check | Result | Evidence |
| --- | --- | --- |
| Native Google authentication | PASS | System OAuth returned to AgentExchange and Account showed the expected owner identity |
| Private workspace read | PASS | My work loaded the owner's existing completed test contract, messages and approved deliverable |
| Session persistence | PASS | Terminating and relaunching the app retained the signed-in account through Keychain |
| Deletion confirmation guard/cancel | PASS for UI only | Final delete control was disabled with blank confirmation; Cancel preserved the account; no deletion request was sent |
| Sign-out isolation | PASS | Account returned to sign-in controls and My work to sign-in guidance, with no private contract navigation remaining |
| Native Apple initiation | PASS for system handoff only | Correctly entitled simulator displayed the system request to sign in to an Apple Account in Settings |
| Successful Apple authentication | PENDING | User authentication in the isolated simulator is required |
| Expired-session automatic refresh | PENDING | Persistence alone does not verify refresh |
| Hosted cross-account RLS and eligible deletion | PENDING | Dedicated review/disposable accounts requested; owner account was not deleted |

Private screenshots are retained outside Git in the workspace release-evidence directory. No private workspace image was uploaded to App Store Connect. CI at documentation commit `a122c85` passed native, web, database authorization and Vercel checks. Build 3 remains selected in Prepare for Submission; no App Review submission occurred.


## Dedicated review access and isolated accounts — October 10, 2026

The owner explicitly requested dedicated App Review and disposable test accounts, and asked to skip Apple login testing for now. Apple authentication remains unverified. Both new email/password identities have ordinary user roles and unique generated passwords; credentials are stored privately outside Git. No invitations or confirmation emails were sent.

The review account owns a clearly labeled synthetic workspace with one zero-value project brief, two sample messages and one submitted deliverable. Native iPad login passed and rendered this exact sample at In Review / 50%. The disposable account's native My work screen showed No contracts yet after switching accounts, with no prior contract navigation.

Authenticated production API checks verified exact isolation: the review identity sees only its new sample contract with two messages and one deliverable, while the disposable identity sees zero contracts and cannot retrieve any of those sample rows by contract ID. Refresh-token exchange succeeded for both accounts. This tests provider refresh behavior, not the native client's automatic expired-session path. No service-role credential or token was exposed to the native client.

The dedicated review credentials and clear email/password navigation instructions were saved in App Store Connect. Build 3 remains selected. The disposable account passes the backend deletion-eligibility preflight; the native final DELETE confirmation is staged awaiting the computer-use policy's required action-time approval. No deletion success is claimed.

CI at `5a77611` passed native, web, database authorization and Vercel. Application source and uploaded build remain unchanged.
