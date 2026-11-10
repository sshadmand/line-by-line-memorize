# Line by Line project context

Recovered on October 28, 2026 from the original implementation chat and the existing local Git repository.

## Locations and hosting

- Canonical local repository: `/Users/sshadmand/repos/line-by-line-memorize`
- Codex project: **LineByLine**. Its configured project folder is currently `/Users/sshadmand/repos`; run application commands from the repository subfolder above.
- Production: https://linebyline.online/
- GitHub: https://github.com/sshadmand/line-by-line-memorize
- Git remote `origin`: https://github.com/sshadmand/line-by-line-memorize.git
- GitHub Pages deploys the root of branch `main`; `CNAME` contains `linebyline.online`.
- The site uses GitHub Pages, not the Sites plugin. HTTPS is enforced.
- Original implementation chat: **Move work here for proper opening**, ID `01a17fdb-188e-7063-b460-611b4cc77f86`.
- Earlier requirements chat: **Memorization App Writeup**, ID `6ae13b43-1364-83e8-9e03-4b35df9a0cf4`.
- The original implementation directory, `/Users/sshadmand/Documents/Codex/2026-10-27/move-this-work-here-so-we`, now redirects to the canonical repository through a symlink. Existing file links and the older chat's working directory continue to resolve.

The repository, its full `.git` history, and all seven existing non-Git files were moved intact. The latest commit at migration was `dfc2e69d1e9cc6d8f58fc469c6707ad25800b485` (Tighten inline editor line spacing), matching `origin/main` after fetch. Production returned HTTP 200 and its HTML matched local `index.html` byte for byte.

This chat was moved into LineByLine. The native move tool rejected moving the original implementation chat with “The task's source project could not be safely determined.” Its history remains accessible through the original chat; the relevant decisions are captured here.

## Application

A standalone presentation memorization tool built in `index.html`, with inline CSS and JavaScript. No framework, backend, database, build, or package installation is required. Open `index.html` in a browser, or serve the repository with `python3 -m http.server 8080`.

- Redact trailing words independently on each intentional script line, preserving the redaction bars' widths and the original whitespace.
- Keep every first word visible until all lines have reached their first word, then redact first words at the final step. The Redaction style setting applies to every redacted word: Full word (default), Half word (keep the first half, rounded up), or Keep first letter.
- The slider controls redaction. Command/Ctrl plus and minus change it one step at a time. The separate +1/-1 buttons were intentionally removed.
- The normal view labels the text card **Script**. Double-clicking replaces it with a textarea for inline editing and reveals all words. Blur or Escape saves the script and restores the redacted view.
- Preserve exact newline counts through editing. The earlier contenteditable implementation introduced unwanted blank lines and was replaced with a textarea.
- The editor fills roughly 80% of the viewport, with line-height 1.4 to reduce the oversized iPad caret.
- **Peak** is the user-requested button label. It sits beside **Practice mode**, is hidden when no text is redacted, and reveals answers while held.
- Practice mode shows the script with a fixed top-right exit button for iPad users. Pressing and holding anywhere inside the script box reveals redactions temporarily in either normal or Practice mode. Release, cancellation, loss of pointer capture, or window blur hides them again. Peek toggles classes in place to preserve double-click targets; the editable textarea retains normal text editing.
- Auto-scroll is available in Practice mode; its button is transparent so upcoming text remains visible. If no scrolling is needed, it displays **Script fits on screen**.
- While auto-scroll runs, Up increases speed and Down decreases it by 10 px/s, bounded to 10–120 px/s. The default is 30 px/s. Fractional per-frame movement is accumulated so slow speeds work.
- Script, redaction step, redaction style, and scroll speed are saved in browser localStorage. The keys are `line-by-line-memorize:script`, `line-by-line-memorize:omit`, `line-by-line-memorize:redaction-style`, and `line-by-line-memorize:auto-scroll-speed`. This state does not sync between devices or origins.

## Files and project decisions

- `index.html`: canonical deployed page.
- `assets/og-line-by-line.png`: social preview; Open Graph, Twitter card, and canonical URL metadata already point to production.
- `CNAME`: GitHub Pages custom domain.
- `LICENSE`, `CONTRIBUTING.md`, `README.md`: existing license, contribution guidance, and usage instructions. The user chose AGPL-3.0-or-later and encouragement of upstream pull requests.
- `memorization_fader.html`: preserved untracked local version, identical to `index.html` except that it lacks the SPDX/copyright comment. Do not mistake it for the production entry point.

## Outstanding observation

The last user report in the original chat was that double-click caret placement still did not feel improved on the live iPad site. The preceding agent verified that production contained the caret-position mapping and tighter line-height, but attributed the result to possible caching without device confirmation. Treat this as unresolved behavior if asked to continue editing work. The local fix now measures rendered grapheme rectangles within the clicked script line and maps them to source UTF-16 offsets, including redacted spans. It uses a textarea mirror to scroll the chosen position into view and reapplies initial placement after the double-click/viewport changes without overriding later input. Regression tests and browser checks at desktop, phone, and tablet sizes passed, including exact typed insertion. The affected physical iPad still needs device verification; these checks do not establish that device behavior.

## Migration scope

This migration changes the repository location and adds local project context. Application code, production hosting configuration, DNS, and deployment are unchanged. `AGENTS.md` and this context document are new local files; they have not been committed or published to the public repository.

## Optional cloud scripts work — October 28, 2026

- Implemented optional login, Google/email-code modal, named script library, explicit cloud saves, per-account local recovery, guest restoration on sign-out, and revision conflict copies. The redaction-style setting introduced concurrently is preserved and included in cloud script state.
- Code is committed and pushed on `feat/optional-cloud-scripts` (`9f2dd94`) with draft PR https://github.com/sshadmand/line-by-line-memorize/pull/1. `AGENTS.md` is now committed. This context document remains local.
- Eight tests pass, including Postgres RLS/column permissions; browser tests used the real bundled Supabase client against a disposable local backend. Mobile layout was measured at 390px with no horizontal overflow. Device emulation was reset afterward.
- Real backend setup is pending: `cloud-config.js` has empty URL/key, no Supabase migration has run remotely, and live Google OAuth/email delivery have not been verified. The user was asked to sign into the opened Supabase dashboard tab. Read `docs/CLOUD_SETUP.md` for the exact configuration and release checks. Do not merge/deploy an unfinished cloud setup.
- Login/library screenshots are in the chat's visualization directory. Production remains GitHub Pages on `main`; the feature branch has not been deployed.
- Another chat is editing redaction controls in the same checkout. Preserve concurrent `index.html` changes and inspect Git status/diffs before future edits or commits.

## Current status — supersedes earlier feature-branch notes

- Work directly on `main`, as explicitly requested by the user. Other chats are also changing this checkout; inspect status before editing and preserve their changes. The production gate was committed in `c556340` and hardened for stale browser caches in `acd9407`. Setup results were committed in `0d027c1`.
- `cloud-bootstrap.js?v=cloud-gate-1` is the only account entry point in the HTML. `cloud-config.js` has `enabledInProduction: false`. Public hosts do not import account code or initialize SDK/session behavior. The login button starts hidden in the HTML. Localhost and loopback enable development account features. Keep the public gate off unless the user explicitly releases login.
- The user chose Google login first; email code login is implemented but disabled in the app (`email: false`). No SMTP account was created or configured.
- Supabase Free project `eoulcmagatntdubqbbpi` is healthy. The schema is applied, Google is enabled, and only the public URL/key are in source. The Google OAuth client secret is stored in Supabase, never in local files or Git.
- Google Cloud project `atlantean-axon-513021-c4` (LineByLine), web client LineByLine Web, basic identity scopes only. The user explicitly approved the Google API Services User Data Policy, client creation, storing its secret in Supabase, and the current Google account support email.
- Real Google login succeeded. Two small verification scripts were saved; a saved script reopened with exact text/blank lines and practice settings. A separately authenticated `localhost` origin loaded the library created on `127.0.0.1`, establishing that listing did not depend on shared local storage. Hosted SQL ownership and stale-revision checks passed with fixtures rolled back. No physical second device was used.
- Before latest doc-only changes, all 25 tests passed, including production initialization guards and the concurrent caret/peek tests from the other chat. Browser production verification after `acd9407` confirmed hidden login, an empty cloud status, only the bootstrap account entry point, and working guest practice.
- Local review server runs in exec session 39025 at http://127.0.0.1:8089/; the verified preview Chrome tab 1488455835 is marked as a deliverable. Other temporary QA tabs were closed externally during testing. The two cloud verification scripts remain in the setup account library.
- Screenshots: production-login-hidden.png and real-cloud-library.png in `/Users/sshadmand/.codex/visualizations/2026/10/28/01a18422-c6f3-74f2-adad-7d0472c51391/`.

## Google-only production release — October 28, 2026

The user explicitly requested releasing login live. Commit `c50fc72` on `main` enables `enabledInProduction: true`, refreshes the browser asset version to `cloud-release-1`, and keeps authentication startup failures from forcing a modal on guests. All 40 tests and GitHub CI passed; Pages deployment succeeded. The live production config was fetched and confirmed enabled. Google OAuth returned successfully to `https://linebyline.online/`, and the live library retrieved the account's saved OpenStage script. No existing script was changed during that verification. Email login remains disabled. Earlier notes requiring the production gate to remain off are superseded by this explicit release request. Screenshot: `live-cloud-library.png` in this chat's visualization directory.

## Automatic saving — October 28, 2026

The user requested automatic guest/device and signed-in/cloud saves, removal of Save to cloud, and New only inside My scripts. Guest editor input now updates local storage immediately even if cloud code is unavailable. Signed-in changes cache locally immediately and debounce cloud writes by 800 ms, serialize pending edits, retry transient failures with backoff and on reconnection, and preserve conflicts with Save a copy. Navigation/sign-out flush pending writes and retain the workspace on failure. Untouched blank scripts and example workspaces are not uploaded; edited guest drafts migrate on sign-in. The cloud asset version is cloud-autosave-1. Browser checks against the disposable QA backend verified guest reload recovery, focused background cloud saving, two scripts, and opening the first again.

Autosave released in `ca05408` on main. All 47 tests and GitHub application checks passed; Pages run 40793351585 deployed successfully. Production UI uses cloud-autosave-1, has no Save to cloud or toolbar New, and the live My scripts modal shows New script and automatic-saving copy. Existing OpenStage stayed at its original cloud revision/update time during verification; no production script was edited. Screenshots: autosave-editor.png (local fixture) and autosave-library-live.png (production).

## Inline script heading — October 28, 2026

Released 50c589f on main. Signed-in script names are now borderless editable inputs in the card heading where Script was; guest users retain the static Script heading. The separate title row is removed. Enter/Escape blur the title; autosaving and keyboard isolation are preserved. Conflict Save a copy sits beside the practice buttons. All 47 tests, CI, and Pages deployment passed. Disposable browser QA renamed a script in the heading and confirmed the updated library name; production HTML was verified. Asset version cloud-inline-title-1. Screenshot inline-title-editor.png.

## Stable edit/view transitions — October 28, 2026

The user supplied desktop screenshots showing the Here’s a scenario line moving on double-click and jumping to the top on blur. Root causes: 80vh editor replacing a full document, larger editor font, half-height blank preview rows, and forced caret-line scrollIntoView on exit. Normal editing now grows to the content height measured offscreen; preview/editor font, spacing, padding and blank-line heights match. Both scroll areas retain their current offsets on transition. Practice mode copies the current editor scroll back, including user scrolling during editing. Blur no longer scrolls a selected/edited line into view; highlighting remains. Keyboard viewport changes only move a caret if obscured. Deferred focus restoration yields to input, wheel and touch. All 50 tests pass. Actual Chrome QA: normal desktop scenario top 425px before/during/after and unchanged page scroll1458.5; Practice desktop425px at all stages with innerScroll1211; phone normal404px before/after with equal7100px editor/preview heights; tablet361.9375px before/after with no page-scroll change; tablet last practice line delta<0.5px. No physical iPad/virtual keyboard device verification. QA backend only; no production script was edited. Screenshots stable-before.png, stable-editing.png, stable-after.png.

Released as 7df4a97 on main. GitHub application checks and Pages run 40794964579 passed; live HTML confirmed fitEditor and current scroll restoration. Browser viewport override reset; disposable QA server stopped.

## Every other line redaction — October 28, 2026

Added Redact lines setting with all/alternate options. Alternate mode keeps the first nonblank text line visible and applies the amount/style to text lines2,4,6… Blank/whitespace lines do not advance alternation; source lines wrap naturally without changing parity. Slider max comes only from eligible lines; one-text-line scripts disable the slider with an add-another-line hint. Guest local storage and cloud snapshots retain redaction_lines. Existing drafts/baselines normalize to all without uploading untouched scripts; comparison ignores object key order. Applied additive Supabase migration202610280002_redaction_lines.sql via authenticated dashboardSQL; verified redaction_lines not null defaultall and grants scoped to authenticated inserts/updates, existing RLS unchanged. All56 tests pass, including actualPostgres permissions/defaults/constraints and cross-device setting restoration. BrowserQA fixture: alternating lines [0,2,0,0,2] hidden counts with2words; reload restores choice;390px layoutwidth390 no overflow. Screenshot every-other-line.png. No production script content was edited.

Released alternate-line mode in76d8561 on main. All56 tests and applicationCI passed; Pages40795577620 deployed successfully. Production HTML and cloudclient assets verified. QA server stopped; viewportoverride reset.
