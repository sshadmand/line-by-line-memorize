# Optional accounts and cloud scripts

The static app remains usable without login. Guests keep their script and practice settings on the current device. Signed-in users can save named scripts in a private cloud library and open them on other devices. Saving is explicit: local changes are retained until the user chooses **Save to cloud**.

## One-time Supabase setup

1. Create a dedicated Supabase project on the Free plan. The application does not require a paid Supabase plan.
2. Run `supabase/migrations/202610280001_scripts.sql` in the project's SQL editor. This creates the script table, owner-only row policies, restricted column permissions, and revision tracking. Do not disable row-level security.
3. Under Authentication → URL Configuration, set the Site URL to `https://linebyline.online/`. Allow `https://linebyline.online/` as a redirect URL. Add explicit localhost URLs only when testing Google login locally.
4. Enable Google under Authentication → Sign In / Providers. Create a Google OAuth web client with the exact Supabase callback URL shown there (normally `https://<project-ref>.supabase.co/auth/v1/callback`). Put the Google client secret in Supabase, never in this repository. Use a Google consent configuration that permits the intended audience.
5. Enable email login and configure custom SMTP for public users. Supabase's default email service is restricted to project-team addresses and is unsuitable for public login. The app uses numeric email codes; the Magic Link email template must visibly include `{{ .Token }}`. No password is required. A suitable template is:

   ```html
   <h2>Your Line by Line login code</h2>
   <p>Enter this code in Line by Line:</p>
   <p style="font-size:28px;letter-spacing:4px">{{ .Token }}</p>
   <p>If you did not request this email, you can ignore it.</p>
   ```

6. Put the project URL and **publishable** key in `cloud-config.js`. These are public browser credentials, not secrets. Do not use a service-role key, database password, Google secret, SMTP password, or Supabase management token. Set the provider flags to match what is actually enabled and ready:

   ```js
   export const cloudConfig = {
     url: 'https://<project-ref>.supabase.co',
     publishableKey: 'sb_publishable_...',
     providers: { google: true, email: true },
   };
   ```

Until real configuration is present, the login modal explains that cloud saving is unavailable and the guest app continues normally. Keep the feature branch undeployed until the real configuration and provider verification are complete.

## Validation before release

- Use Node 24.15+ and run `npm ci`, `npm run check`, and `npm test`. The tests cover guest operation, account transitions, multiple devices, offline drafts, simultaneous editing, deletion, malicious titles, and Postgres row/column access controls.
- Run `python3 -m http.server 8089 --bind 127.0.0.1` and check the guest view, login modal, practice mode, and script library in a browser.
- `node tests/preview-server.mjs` starts a disposable local backend on port 8090 for testing the real bundled Supabase client without sending email or accessing external accounts. Use `demo@example.test` and any numeric code of 6–10 digits. This server is a local QA fixture, not a production backend or evidence of successful production authentication.
- Against the real Supabase project, verify Google sign-in and email-code sign-in, create at least two scripts, open them in a separate browser/device, and confirm that a different account cannot read or modify them.
- Check sign-out restores the guest draft; edit a script on two devices and confirm a stale save offers **Save a copy** instead of replacing newer cloud text.
- Push the completed change to `main` only once real authentication and persistence are verified. GitHub Pages continues to serve the repository root; no frontend build or hosting migration is needed.

## Implementation details

- `cloud-scripts.js` owns the login/library UI, account transitions, explicit saves, and browser draft recovery.
- `cloud-client.js` scopes requests to the signed-in user. Database policies enforce ownership independently of these client filters.
- Updates include the version read with the script. A database trigger increments the version, so stale edits and stale delete requests fail without overwriting another device's work.
- Scripts store title, exact text, redaction amount/style, and auto-scroll speed. Raw user text is rendered with DOM text nodes.
- Auth uses the bundled Supabase SDK with PKCE, persistent sessions, and token refresh. Google returns to the current page. Email verification uses a code, which avoids depending on a link opened in the originating browser.
- Local drafts are separated by account; a guest draft is retained separately. Signing out removes the active session and restores the guest workspace. Account-specific draft caches remain on that browser for recovery on the next login; shared-device users should clear browser data when finished.
- Database and OAuth admin secrets stay in their respective services. None belong in GitHub Pages assets.

## Pricing and operational limits

At implementation time Supabase Free lists 50,000 monthly active users, a 500 MB database, two active projects, and pausing after a week of inactivity. SMTP delivery is a separate provider service and may have its own free limits or costs. Check current limits before launch.

References: [pricing](https://supabase.com/pricing), [Google login](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [email codes](https://supabase.com/docs/guides/auth/auth-email-passwordless), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
