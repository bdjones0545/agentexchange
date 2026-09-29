# Legal launch review

Status: working draft for owner decisions and qualified legal review. No final legal approval is implied. Existing public draft notices remain.

## Confirmed operator information

Efficiency Strength Training, LLC
255 Pleasant Point Drive, Beaufort, SC 29907
Support/privacy contact: bryan.jones@efficiencystrengthtraining.com

International operator participation approved by owner. Owner also approved a minimum age of 18 for human account holders and agent operators. These decisions do not establish universal payment coverage or international legal compliance.

## Supported product disclosures

- Agents act for human/business operators with scoped grants and spending limits.
- Funding is a card authorization, followed by approved capture and seller transfer; it is not bank escrow. Bank payout is a separate state.
- A marketplace dispute blocks release; only the opener can resolve it in the current product.
- Self-service account deletion requires recent sign-in and no retained marketplace/billing relationships. Other accounts require support review. Do not promise universal instant deletion or a fixed retention period that is not implemented.
- Google identity login is published to an External audience. This does not authorize Gmail, Drive or Calendar access.

## Owner decisions to resolve

| Decision | Proposed starting point for review | Work needed before final publication |
| --- | --- | --- |
| Eligibility and launch region | Owner approved international operators and a minimum age of 18 for human account holders and agent operators | Implement matching signup eligibility acknowledgement; disclose payment/payout country limitations; review applicable international obligations |
| Deliverable rights | Buyer receives transferable rights in paid custom work; seller retains pre-existing tools, with necessary usage licenses disclosed | Owner delegated selection; buyer-friendly draft added with payment-capture trigger, embedded-material license and advance restriction disclosure. Qualified review and versioned contract incorporation remain; no promise that AI output is copyrightable or exclusive |
| Refunds and service fees | Support review against agreed scope, with statutory rights preserved | Decide deadlines, eligibility, buyer/seller fee treatment and who bears processing losses; verify provider workflows |
| Dispute support | Published contact and documented escalation process | Decide response target, evidence requirements, appeals and authority; current UI cannot imply platform arbitration |
| Retention | Written schedule by data category | Decide periods with counsel/accountant; implement purge/anonymization and backup/provider handling before promising deadlines |
| Governing law, liability and termination | Counsel-drafted terms suited to operator and launch markets | Do not infer governing law, arbitration or liability limits solely from mailing address |
| Providers and data use | Inventory actual hosting, auth, payment, monitoring and model providers | Confirm processing locations, model data handling, analytics/cookies, subprocessors and international rights |

## Sources used to bound claims

- FTC, Protecting Personal Information: https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business — recommends a written retention policy defining what is retained, why, duration and disposal.
- FTC, Privacy and Security: https://www.ftc.gov/business-guidance/privacy-security — privacy promises must match actual practices.
- US Copyright Office, AI report Part 2 announcement: https://www.copyright.gov/newsnet/2025/1060.html — copyrightability of AI-assisted output depends on sufficient human-authored expression; do not guarantee copyright in every deliverable.

## Release criteria

Resolve owner decisions, obtain qualified review, implement any newly promised behaviors, confirm policy acceptance/versioning as needed, then publish final policies. Removing draft labels alone does not complete this work. This document does not authorize live payments.

## Deliverable-rights implementation boundary

These are prospective draft terms, not a retroactive change to existing contracts. Before enforcement, record the policy version and each party’s assent in the contracting flow, preserve any negotiated exceptions, and resolve treatment of partial payments, refunds and reversals during legal review. No existing contract or payment record was changed.

## Acceptance implementation checkpoint

Local implementation includes a shared post-authentication screen for Google/email sessions, an authenticated human-only acceptance endpoint, version plus SHA-256 digest matching, full server-supplied policy snapshot, database timestamp, explicit adult/authority/agreement acknowledgments, and duplicate-safe records. RLS permits only owner reads; clients cannot insert, alter or remove records. User deletion cascades acceptance records. No acceptance was fabricated for existing users.

The release is explicitly inactive (`server/policyRelease.ts`). Draft submissions return 409. The browser gate is an onboarding interface, not an authorization boundary. **Do not activate** until final policies are reviewed, the new database/server/MCP enforcement is verified hosted, account deletion/support access is verified in the browser without acceptance, and per-contract assent/negotiated exceptions are implemented. No retroactive contract amendments are implied. Migration is local only; no production schema or policy activation occurred.

Validation: 267 tests passed; production build passed; isolated real PostgreSQL checks passed for anonymous denial, owner isolation, client-write denial, duplicate insertion, update/delete denial, cascade cleanup, and migration replay. Hosted/browser acceptance journey remains unverified while inactive.

## Enforcement implementation checkpoint

Local server admission checks now cover checkout, capture, billing/card setup, seller onboarding, key creation, worker dispatch and MCP mutations. Direct writes on 16 marketplace/key/billing tables are protected by a database trigger tied to the authenticated operator's user ID. A protected singleton holds the active version/digest. Authenticated callers cannot change this configuration or acceptance records. The RPC only checks the caller's own acceptance. Server checks require exact agreement between application and database release configuration and fail closed on verification errors.

Profile creation, reads, disputes, privileged provider reconciliation and account-deletion cascades retain existing authorization. Key-only revocation/pause updates remain possible; unpausing/regranting requires acceptance. The browser leaves account and contract pages available for deletion, key controls and disputes; sensitive writes still meet server/database checks. This does not replace existing RLS or ownership checks.

Both application and database activation remain OFF. Before activation: freeze/version the final policy text; apply both migrations; configure the matching digest; verify with disposable accepted/unaccepted human and agent accounts; check cancellation, deletion, dispute and key-management UX; then activate the reviewed release. In-flight provider work remains subject to existing payment recovery, not retroactive cancellation. Existing contracts are not retroactively amended.

Validation: 271 tests and production build passed. Isolated PostgreSQL tested every guarded table with accepted and unaccepted actors, stale-version rejection, protected configuration, revocation/pause exceptions, immutable acceptance history and migration replay. Existing full money/authority database regression also passed with inactive triggers. Production migrations and hosted enforcement remain unperformed.

## Prospective contract policy evidence

Local migration `20260929041632_contract_policy_evidence.sql` adds immutable contract evidence. With enforcement active, contract insertion requires both the organization owner and agent owner to have accepted the active version/digest. The database captures both acceptance timestamps and the policy snapshot itself; caller-supplied evidence is discarded. Later policy changes do not rewrite existing snapshots, and guarded contracts cannot silently replace organization/agent identities. Inactive and legacy contracts retain null evidence. This records operator acceptance of platform policies at creation, not a separate signature on negotiated contract exceptions.

Expanded isolated PostgreSQL tests passed for missing counterparty acceptance, forged data, immutable evidence, party replacement, later version changes and no backfill. Existing full money/authority database suite also passed. No production migration, policy activation, or contract modification was performed. Remaining work: review final policy text, implement or explicitly exclude negotiated exceptions with appropriate assent, verify saved evidence in the hosted contract UI, apply migrations and verify hosted human/agent journeys before activation.

## Contract evidence display

Contract details now render the database snapshot, version, buyer/seller acceptance timestamps, and expandable saved policy text. Missing evidence is explicitly described as absent; malformed evidence produces a review error rather than implying acceptance. Current live policy text is never substituted for the historical snapshot. Content is rendered as escaped text. Contract list/create/hire and shared-state mappings preserve the evidence field.

Validation: 276 tests and production build passed, including historical text rendering, HTML escaping, missing/malformed records, date validation, and repository mapping. Browser/hosted display remains unverified; changes are local and enforcement stays inactive.

## Local browser verification

Rendered the actual ContractPolicyRecord component with production CSS and synthetic saved/missing/malformed records. Browser verified all three states, keyboard expansion of saved text, and 390px viewport with content width exactly 390px. Screenshot: /tmp/ax-policy-mobile.png. No real records, acceptance submissions or production data were used. This verifies the record display only; authenticated acceptance behavior and hosted rollout still need verification.
