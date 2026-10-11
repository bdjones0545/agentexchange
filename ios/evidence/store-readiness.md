# App Store readiness audit — 2026-10-10

App: AgentExchange, Apple ID 6821482481, bundle ai.agentsexchange.ios, version 1.0 build 3. Current state: Prepare for Submission. This audit records observed state; it is not a compliance attestation or submission authorization.

## Saved in App Store Connect

- Build 3 is processed and selected.
- Name, subtitle, description, keywords, support/marketing URLs, copyright and Productivity category.
- Two unmodified production UI screenshots for each required iPhone and iPad family.
- Owner-provided App Review contact and accurate draft navigation notes.
- Privacy policy URL: https://www.agentsexchange.ai/privacy. The policy itself remains a draft; saving its URL does not finalize it.

## Still missing in the live listing

- Dedicated App Review email/password account and sample work are now verified and saved; this earlier missing item is resolved.
- Privacy collection questionnaire and published labels.
- Content rights declaration.
- Age rating questionnaire.
- Initial price schedule and territories: both still show setup controls.
- Mac and Apple Vision Pro availability default to enabled. Neither platform has received acceptance testing; confirm intended platform scope before release.
- DSA app-level status currently says non-trader. Confirm the appropriate declaration before EU availability.

## Data inventory supported by the native source

| Data or behavior | Evidence | Disclosure implication |
| --- | --- | --- |
| Email and account ID | ExchangeClient authentication and AuthSession; Supabase stores account identity | Linked to user, app functionality; already declared in provisional manifest |
| Google account metadata | Google OAuth handled by Supabase | Audit actual provider scopes/retained name and identity metadata before final labels |
| Contract messages/deliverables | Native client reads existing private records and has no content-authoring endpoint | Distinguish pre-existing server content from data collected from this native app; verify provider logs |
| Support reports | User elects to open email with support address and profile/contract reference | Confirm support retention and whether optional-disclosure criteria apply |
| Search, saved and hidden profiles | Search is local; saved/hidden IDs are device-local UserDefaults | No native upload of these preferences found |
| Advertising/tracking | No ad SDK, tracking permission, device ad identifier, or analytics SDK found in native code | No tracking observed in native source; provider practices still need inventory |
| Server access/auth logs | Requests go to Supabase and the production website | Confirm retention and identifiers recorded before final disclosure |
| Payment data | No native purchasing, card entry or funding requests | Do not copy the website's payment collection answers without evaluating this binary |

Apple defines collection as off-device data accessible beyond real-time request processing. Final labels must include relevant third-party practices. Source: https://developer.apple.com/app-store/app-privacy-details/

## Verified functional behavior

Native public discovery/search/save/hide/report UI, Google sign-in, private workspace reads, Keychain persistence after restart, deletion guard/cancel and sign-out isolation passed. Full Apple login and automatic native expired-session refresh remain pending; hosted isolation and provider refresh-token exchange passed with the new review/disposable accounts. Eligible email/password deletion passed through the native UI, including database removal, rejected re-login and signed-out persistence after restart. The Apple path reaches its system account prompt.

## Implementation blockers

- api/delete-account.ts currently rejects accounts with marketplace/billing records and directs the user to support. Apple's guidance ordinarily disallows requiring an email/support flow for non-regulated apps. A retained-record deletion request/anonymization design needs the owner's actual retention policy and a defined completion process; existing financial records must not be casually cascaded away.
- Apple login currently exchanges the ID token with Supabase. No server-side Apple token-revocation integration is present. It needs a supported authorization-code/token lifecycle and Apple server credentials before deletion acceptance can be verified.
- Local hide and email report UI do not establish service-level blocking, filtering or moderation response handling.
- Existing draft policies and inactive policy enforcement require the separate decisions already recorded in docs/LEGAL_LAUNCH_REVIEW.md.

Apple account-deletion source: https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion

No account deletion, content-rights attestation, trader declaration, paid agreement, or App Review submission was performed by this audit. The deployment skill requires a complete readiness summary and explicit final submission confirmation before submitting.


Dedicated review access was completed with owner approval: both account logins passed natively; only the review account sees the synthetic sample workspace. Credentials were saved in App Store Connect and remain outside Git. Apple login testing was explicitly skipped by the owner; it is not marked passed.


The approved disposable account was deleted through the native app. Auth user/profile/identity/session/refresh-token rows are absent; old credentials fail. Reviewer login and its exact sample contract remain available. This does not resolve Apple revocation or retained-record deletion requirements.
