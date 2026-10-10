# App Store release status — October 10, 2026

NOT SUBMITTED. Native companion candidate, pending product scope confirmation and release gates.

Source: `release/ios-app-store`, based on `harden/bounded-marketplace` at `7e00f4ca28df11516acce125543b99f96fc513d0`. The original offloaded working copy was preserved. The committed source was recovered into this separate checkout; its later uncommitted handoff documents were consulted, not overwritten.

## Completed

- Native SwiftUI iPhone/iPad project with live public search, device-local saved/hidden profiles, authenticated contract/messages/deliverables reading, Keychain sessions, refresh, sign-out, support/report composition and the existing account deletion endpoint.
- No payment initiation, credential minting, fabricated policy acceptance or production database mutation.
- Public configuration host validation and cross-origin/downgrade redirect protection. Private requests require an authenticated session. Session changes discard stale workspace results; sign-out recreates the private navigation stack.
- Existing vector brand mark rendered as a 1024 × 1024 opaque App Store icon.
- Draft listing text and provisional privacy manifest. Bundle ID `ai.agentsexchange.ios` is unregistered/unverified pending Apple account access.
- Compatible `source-map-js` update 1.2.1 → 1.2.2; npm reports zero vulnerabilities.

## Verified locally

- Web: 276 tests pass; six safe-diagnostics tests pass; production client and server-render builds pass.
- Native core: six tests pass. These cover untrusted configuration, redirects, public request isolation, private anonymous denial, errors and search filters. They do not establish successful real-user authentication or session refresh.
- Isolated PostgreSQL: policy ledger/enforcement/evidence checks, three-party RLS authorization and payment concurrency/recovery suite pass. No hosted acceptance activation occurred.
- Public production HTTP checks: 21/21 pass.
- Simulator app compilation passes. Unsigned generic iOS archive builds. These are not distribution-signed artifacts and cannot be uploaded as-is.

## Open release gates

1. Apple account: Chrome and Safari both show App Store Connect sign-in. App identity, signing team, existing listing, agreements, availability, review state and upload access are unverified.
2. Product scope: free companion proposed while awaiting owner response. In-app purchasing would require a separate implementation and commercial review.
3. Native verification: designated existing email/password review account; real sign-in/refresh/logout, RLS isolation and eligible deletion with an explicitly disposable account. Google-only account support is not yet implemented.
4. Moderation: reporting by email and local hiding do not replace service-level abusive-user blocking, content filtering and an operational response queue. Apple guideline 1.2 remains open.
5. Policies: the website still publishes draft terms/privacy/refund/acceptable-use wording. Final policy and retention decisions and coordinated policy activation remain open; see existing `LEGAL_LAUNCH_REVIEW.md` and the original upgrade checkout's `POLICY_ACTIVATION_PLAN.md`.
6. Marketplace live money: existing handoff still leaves live Stripe activation, provider failure/refund/reversal evidence and operational review pending. Local/database passes do not close those gates.
7. Store preparation: verified screenshots, listing/privacy/age-rating answers, review access and final signed build remain outstanding.

The initial iPhone simulator stalled at “Waiting on System App”; it was shut down without deleting its data. That attempt did not verify app rendering. Do not treat compiler success as visual or authenticated acceptance.

References: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords).
