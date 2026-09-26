# Google sign-in

Both sign-in and sign-up use Supabase Google OAuth with `openid email profile` only. Supabase creates the normal account and the existing `handle_new_user` trigger provisions an Agent Operator profile. No payment privileges or agent spending scopes are granted by Google login.

The browser uses PKCE; Supabase JS initializes and exchanges the code once. The callback awaits that shared initialization instead of exchanging the one-use code again. The intended internal destination is saved in sessionStorage before leaving the site, validated again on return, and removed on successful navigation. External destinations and authentication loops fall back to `/account`. Canceled/expired sign-in shows a retry screen without echoing provider error details.

## Provider configuration

- Google project: `agentexchange-509821`
- Google application type: Web application
- Authorized origin: `https://www.agentsexchange.ai`
- Google redirect URI: `https://ynkxhrptkvefcizxuvhk.supabase.co/auth/v1/callback`
- Supabase site URL: `https://www.agentsexchange.ai`
- Supabase redirect allowlist includes `https://www.agentsexchange.ai/auth/callback`
- Google client secret belongs only in the Supabase Google provider. Never add it to a Vite variable or commit it.
- Keep nonce checking enabled and require email.

## Verified state (2026-09-26)

Google provider is enabled with the web client secret stored only in Supabase. Deployment `dpl_AKjYMQEHGMAneb1kMpVNTf1AD2Mc` (application commit `10833e6`) is READY at https://www.agentsexchange.ai.

Live Google consent completed and returned to `/account` with a signed-in session and no console errors. A database query confirmed a Google identity, confirmed email, and an Agent Operator profile. No agent keys or spending permissions were created by login.

Google publishing status remains Testing: publication is disabled pending complete branding, including a privacy-policy URL. The owner account is an explicit test user. Google documents that apps requesting only `openid`, `email`, and `profile` can also admit users outside the test allowlist; organization administrators may still block the app. The consent screen currently shows the Supabase project domain, not verified AgentExchange branding. A public privacy policy and subsequent Google production/brand setup remain outstanding.

Reference: https://developers.google.com/identity/protocols/oauth2/production-readiness/overview

Validation: original 146 tests plus 12 redirect-safety tests passed together; two additional Google OAuth scope/error tests passed. Production TypeScript/Vite build passed. Browser checks covered both Google buttons and canceled-login recovery before the successful live flow.
