# Non-payment public release

## Repeatable HTTP acceptance

Run against the exact deployment being released:

```sh
node scripts/check-public-release.mjs https://www.agentsexchange.ai
```

The read-only command checks 21 responses: public HTML headings, unique titles,
social titles, missing-route status codes, crawler documents, agent discovery JSON,
sharing image content type, and HEAD responses. It exits nonzero on failures,
timeouts or redirects. It does not follow authentication redirects or print bodies.
For a protected preview, obtain authorized temporary Vercel access and pass a
Netscape cookie jar using `RELEASE_CHECK_COOKIE_FILE`. Cookies are filtered by
host, path and expiration; remove the temporary jar after checking. Never commit it.

This is HTTP acceptance, not proof of legal review, accessibility, image rendering,
OAuth completion, authorization isolation or alert delivery. Existing browser and
database checks remain required.

### Recorded comparison, September 26, 2026

- Readiness preview `agentexchange-7nnq-klfx6ur3l-train-efficiency.vercel.app`:
  **21/21 pass**, using authorized temporary preview access.
- Same protected preview without access: **0/21**, correctly rejects login redirects.
- Public domain `www.agentsexchange.ai`: **3/21**. The older production build lacks
  the pending SSR/metadata, crawler, social-image and real-404 improvements.
  This is a release gap, not evidence that the preview fixes are broken.

## Deployment acceptance workflow

`.github/workflows/public-release.yml` runs the same checker after successful
GitHub deployment events named `Production`, or manually from Actions. It uses
the default branch and fixed public origin, read-only repository permissions,
no installed application dependencies and no secrets. Failed checks fail the
workflow; text evidence is retained for 14 days even when checks fail.

This workflow becomes available when merged into the default branch. It is
post-deployment detection, not a pre-promotion gate or automatic rollback.
The repository has historical deployment events named `Production`; confirm a
new event is emitted on the first release with this workflow. A manually deployed release must run the workflow explicitly if
no GitHub deployment event is emitted. GitHub notification delivery depends on
the recipient's Actions notification settings and remains unverified. This does
not replace continuous uptime monitoring or scheduled-job heartbeat detection.

## Legal and Google publication

1. Obtain the owner's legal entity, public business address and monitored
   support/privacy/abuse contacts. Do not reuse private onboarding information.
2. Complete the legal review items in `docs/upgrades/README.md`. Keep all Draft
   labels until the owner confirms review. Confirm unresolved Hermes/payout wording.
3. Review and integrate the dependent PR stack (#26–46 and this release tooling).
   Record the final commit and current production deployment for rollback.
4. Publish reviewed pages to the public domain and run the command above there.
5. In Google project `agentexchange-509821`, use these live branding links:
   homepage `https://www.agentsexchange.ai`, privacy
   `https://www.agentsexchange.ai/privacy`, terms
   `https://www.agentsexchange.ai/terms`. Verify domain ownership and finish the
   publication/brand requirements presented by Google. Do not claim verified
   branding just because OAuth login works.
6. Recheck sign-up and sign-in, cancel/retry, callback return destination and
   sign-out in a browser. Keep only identity scopes. See `GOOGLE-AUTH.md`.
7. Check the public sharing image in an external social-card debugger.

## Monitoring evidence and remaining acceptance

Read-only Vercel inspection found the team's existing `ar_default` rule scoped
across projects, all built-in triggers, high minimum severity, with team-owner
notifications enabled. No Slack or account-webhook destinations are linked.
No rule was changed and no synthetic alert was sent.

```sh
npx vercel alerts rules ls --project agentexchange-7nnq --scope train-efficiency --format json
npx vercel alerts rules notifications ar_default --scope train-efficiency
```

Owner notifications are existing coverage; duplicating the rule does not prove
better coverage. Confirm a monitored recipient and record a supported test's
receipt time, destination and response owner. Anomaly alerts do not establish
that every isolated failure or missed scheduled run will page someone. Explicit
uptime and missed-run coverage remains to be selected and verified separately.
Do not induce a production failure merely to trigger an alert.

## Rollback

Before promotion, record the currently active deployment from Vercel. Roll back
to that deployment if public acceptance or login fails, then repeat checks.
The existing constant-fee search-path migration is compatible with the old app;
application rollback does not require reverting it. This runbook does not change
Stripe mode or authorize live-money activation.

## Pre-release evidence refresh

PR #47 CI run `36288674717` passed application verification and database
authorization. The rollback candidate before public release is production
deployment `dpl_AKjYMQEHGMAneb1kMpVNTf1AD2Mc`, application commit `10833e6`;
Vercel inspection confirmed this is still the active public deployment during
this verification; reconfirm immediately before promotion.
