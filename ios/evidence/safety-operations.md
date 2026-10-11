# Release safety operations

Owner-approved commitments (October 10, 2026): inspect the private Supabase queues daily, review abuse reports within 24 hours, complete deletion within 30 days unless specific records must be retained by law.

Project: `ynkxhrptkvefcizxuvhk`. Use the existing authenticated Supabase dashboard; never put service credentials in the app. The new tables have owner-only reads; clients cannot resolve their own requests.

## Daily review

- Inspect `content_reports` where status is `received` or `reviewing`. Read the referenced content with authorized administrative access. Set `reviewing`, investigate, remove prohibited content or suspend an abusive account as appropriate, then set `resolved` with a useful non-sensitive response. Update `updated_at`. Never disclose another user's private records in a response.
- Inspect `agents` where `moderation_status` is `pending`. Review all public text for the prohibited conduct in `/ios-terms`. Approve or reject in the trusted dashboard. All new/edited public text is held pending. The sole preexisting Research and Writing Analyst profile was inspected and approved during release preparation; this does not certify its capability claims.
- Inspect `account_deletion_requests` with status `requested` or `processing`. Set `processing`. Review which records actually require legal retention, remove personal content no longer necessary, and inform the requester through `response` of the concrete retention reason and duration, if any. Complete the account deletion within the approved period. Do not mark completed while access remains active.

For an account with financial or shared-work records, the existing database deletion guard intentionally prevents cascading removal of those records. An authorized administrator must first remove unneeded private content and separate any legally retained records from the live account. After that review, revoke all sessions and remove the Auth identity using the Supabase administrative user controls. Do not disable the database deletion guard wholesale or delete another party's financial history. For eligible accounts without retained records, the app's verified-user deletion API already removes the Auth identity and its dependent profile.

Apple users: this release does not store Apple refresh/access tokens, so automatic Apple token revocation is unavailable. Follow Apple's TN3194 fallback: fulfill account deletion, provide Apple's manual authorization-removal instructions, and sign out the native session on the credential-revoked notification. Successful Apple sign-in and manual revocation remain untested at the owner's request.

## Verification

`python3 scripts/verify-safety-db.py` checks local PostgreSQL permissions, report target isolation, profile approval, rate limits, private deletion status, block ownership and both directions of blocked contact. Supabase advisors flag the authenticated SECURITY DEFINER RPCs: these are intentionally callable authenticated entrypoints with explicit caller checks, pinned search paths, target authorization and revoked anonymous execution. Existing service-only tables intentionally have no client RLS policies.
