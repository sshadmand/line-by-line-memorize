# Optional accounts and cloud scripts

The static app remains usable without login. Guests keep their script and practice settings on the current device. Signed-in users can save named scripts in a private cloud library and open them on other devices. Edits save on the device immediately and sync automatically to the cloud after an 800 ms pause when signed in. **New script** lives in **My scripts**, and no manual save button is needed. Failed connections retry automatically, while revision conflicts pause syncing and offer **Save a copy**. The initial release uses Google login only; email-code login stays disabled until public mail delivery is configured.

## Connected project

The dedicated Free project is `eoulcmagatntdubqbbpi` (LineByLine). Its public URL and publishable key are in `cloud-config.js`. The script schema and `202610280002_redaction_lines.sql` migration are applied, and Google sign-in is enabled with its secret stored only in Supabase. The dedicated Google project is `atlantean-axon-513021-c4` (LineByLine); the web client is named **LineByLine Web**. It uses only `openid`, `email`, and `profile`.

Authentication's Site URL is `https://linebyline.online/`. Exact return URLs are allowlisted for production, `http://127.0.0.1:8089/`, and `http://localhost:8089/`. Google's OAuth callback is `https://eoulcmagatntdubqbbpi.supabase.co/auth/v1/callback`.

Live verification on October 28, 2026 passed Google login, two separate named saves, opening a saved script with exact blank lines and restored redaction settings, and loading the library from an independent browser-storage origin. Live SQL checks confirmed RLS, four owner policies, no anonymous table access, and no client write access to owner/revision fields. `scripts/verify-live-rls.sql` also passed ownership and stale-revision checks on the hosted database; its fixtures were rolled back. Two small verification scripts remain in the setup account's library.

Google's audience remains External/Testing; the website's Google-only account feature is released. Basic identity-only sign-in is exempt from Google's test-user allowlist and seven-day consent expiration, as explained in [Google's audience documentation](https://support.google.com/cloud/answer/15549945?hl=en). Adding other scopes would require revisiting that configuration. A physical second device and iPad interaction have not been used for this cloud verification.

## Production feature gate

The Google-only release uses `enabledInProduction: true`. Set it to `false` to hide login and suspend cloud startup without taking down guest practice. The release uses `cloud-alternate-lines-1` asset URLs so browsers load the current configuration and modules.

`enabledInProduction: false` in `cloud-config.js` keeps the login button hidden on all public hosts and skips all cloud initialization, session handling, SDK loading, and remote cloud requests. A separate `cloud-bootstrap.js` checks the flag before importing any account code; versioned imports avoid pre-gate browser caches. The header button is hidden in the HTML itself, so an incomplete or failed JavaScript module cannot briefly show it. Guest practice and existing browser saves continue independently.

Localhost, `127.0.0.1`, and IPv6 loopback enable the account feature for development. Keep the production flag off while backend work continues; this allows normal production pushes. Set it to `true` only when deliberately releasing the verified account feature.

## One-time Supabase setup

1. Create a dedicated Supabase project on the Free plan. The application does not require a paid Supabase plan.
2. Run `supabase/migrations/202610280001_scripts.sql`, then `supabase/migrations/202610280002_redaction_lines.sql` in the project's SQL editor. This creates the script table, owner-only row policies, restricted column permissions, and revision tracking. Do not disable row-level security.
3. Under Authentication → URL Configuration, set the Site URL to `https://linebyline.online/`. Allow `https://linebyline.online/` as a redirect URL. Add explicit localhost URLs only when testing Google login locally.
4. Enable Google under Authentication → Sign In / Providers. Create a Google OAuth web client with the exact Supabase callback URL shown there (normally `https://<project-ref>.supabase.co/auth/v1/callback`). Put the Google client secret in Supabase, never in this repository. Use a Google consent configuration that permits the intended audience.
5. To add email-code login later, configure custom SMTP and enable the email provider flag in the app. Supabase's default email service is restricted to project-team addresses and is unsuitable for public login. The app uses numeric email codes; the Magic Link email template must visibly include `{{ .Token }}`. No password is required. A suitable template is:

   ```html
   <h2>Your Line by Line login code</h2>
   <p>Enter this code in Line by Line:</p>
   <p style="font-size:28px;letter-spacing:4px">{{ .Token }}</p>
   <p>If you did not request this email, you can ignore it.</p>
   ```

6. Put the project URL and **publishable** key in `cloud-config.js`. These are public browser credentials, not secrets. Do not use a service-role key, database password, Google secret, SMTP password, or Supabase management token. Set the provider flags to match what is actually enabled and ready:

   ```js
   export const cloudConfig = {
     enabledInProduction: false,
     url: 'https://<project-ref>.supabase.co',
     publishableKey: 'sb_publishable_...',
     providers: { google: true, email: false },
   };
   ```

Without real configuration, the development login modal explains that cloud saving is unavailable and guest practice continues normally. Normal updates can continue deploying while the production feature gate is off.

## Validation before release

- Use Node 24.15+ and run `npm ci`, `npm run check`, and `npm test`. The tests cover guest operation, Google-only login controls, account transitions, multiple devices, offline drafts, simultaneous editing, deletion, malicious titles, and Postgres row/column access controls.
- Run `python3 -m http.server 8089 --bind 127.0.0.1` and check the guest view, login modal, practice mode, and script library in a browser.
- `node tests/preview-server.mjs` starts a disposable local backend on port 8090 for testing the real bundled Supabase client without sending email or accessing external accounts. Use `demo@example.test` and any numeric code of 6–10 digits. This server is a local QA fixture, not a production backend or evidence of successful production authentication.
- Against the real Supabase project, verify Google sign-in and email-code sign-in, create at least two scripts, open them in a separate browser/device, and confirm that a different account cannot read or modify them.
- Check sign-out restores the guest draft; edit a script on two devices and confirm a stale save offers **Save a copy** instead of replacing newer cloud text.
- Work directly on `main`. The account feature may be pushed while `enabledInProduction` is false. Deliberately enabling it is a separate release step after real authentication and persistence checks. GitHub Pages continues to serve the repository root; no frontend build or hosting migration is needed.

## Implementation details

- `cloud-scripts.js` owns the login/library UI, account transitions, debounced automatic saves, and browser draft recovery.
- `cloud-client.js` scopes requests to the signed-in user. Database policies enforce ownership independently of these client filters.
- Updates include the version read with the script. A database trigger increments the version, so stale edits and stale delete requests fail without overwriting another device's work.
- Scripts store title, exact text, redaction amount/style, line selection, and auto-scroll speed. `redaction_lines` defaults to `all`; `alternate` targets even-numbered nonblank text lines, preserving the first as a cue. Raw user text is rendered with DOM text nodes.
- Auth uses the bundled Supabase SDK with PKCE, persistent sessions, and token refresh. Google returns to the current page. Email verification uses a code, which avoids depending on a link opened in the originating browser.
- Local drafts are separated by account; a guest draft is retained separately. Signing out removes the active session and restores the guest workspace. Account-specific draft caches remain on that browser for recovery on the next login; shared-device users should clear browser data when finished.
- Database and OAuth admin secrets stay in their respective services. None belong in GitHub Pages assets.

## Pricing and operational limits

At implementation time Supabase Free lists 50,000 monthly active users, a 500 MB database, two active projects, and pausing after a week of inactivity. SMTP delivery is a separate provider service and may have its own free limits or costs. Check current limits before launch.

References: [pricing](https://supabase.com/pricing), [Google login](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [email codes](https://supabase.com/docs/guides/auth/auth-email-passwordless), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
