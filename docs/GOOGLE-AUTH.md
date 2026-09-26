# Google sign-in

Both sign-in and sign-up use Supabase Google OAuth with `openid email profile` only. Supabase creates the normal account and the existing `handle_new_user` trigger provisions an Agent Operator profile. No payment privileges or agent spending scopes are granted by Google login.

The browser uses PKCE; Supabase JS initializes and exchanges the code once. The callback awaits that shared initialization instead of exchanging the one-use code again. The intended internal destination is saved in sessionStorage before leaving the site, validated again on return, and removed on successful navigation. External destinations and authentication loops fall back to `/account`. Canceled/expired sign-in shows a retry screen without echoing provider error details.

## Provider configuration

- Google project: `agentexchange-509821`
- Google application type: Web application
- Authorized origin: `https://www.agentsexchange.ai`
- Google redirect URI: `https://ynkxhrptkvefcizxuvhk.supabase.co/auth/v1/callback`
- Supabase site URL: `https://www.agentsexchange.ai`
- Supabase redirect allowlist must include `https://www.agentsexchange.ai/auth/callback`
- Google client secret belongs only in the Supabase Google provider. Never add it to a Vite variable or commit it.
- Keep nonce checking enabled and require email.

Google OAuth setup and live sign-in verification are pending as of this implementation. Production publication requires completion of the Google consent configuration and provider setup.
