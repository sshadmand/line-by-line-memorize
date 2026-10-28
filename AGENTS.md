# Line by Line

This is the LineByLine project's application repository. Read `PROJECT_CONTEXT.md` before continuing work from another chat.

- Work directly on `main`. Create another branch only when the user explicitly asks for one.

- Live site: https://linebyline.online/
- GitHub: https://github.com/sshadmand/line-by-line-memorize
- `index.html` is the canonical page. Optional account and cloud library logic is in `cloud-scripts.js`, `cloud-client.js`, and `cloud.css`. Read `docs/CLOUD_SETUP.md` before changing authentication or deployment.
- GitHub Pages serves `main` from the repository root. Production is static; Node 24.15+ is used for development checks (`npm run check`, `npm test`) and regenerating the bundled SDK (`npm run build:vendor`).
- `memorization_fader.html` is a preserved, untracked local copy from the original chat. It is not the deployed entry point.
- Preserve intentional script whitespace, browser-local saved state, progressive redaction, iPad usability, and the existing license and source links.
- For application changes, check JavaScript syntax and exercise the affected behavior in a browser. iPad editing behavior needs device verification; a successful deployment alone does not establish that the interaction is fixed.

## Plan execution

When executing/implementing plans (`*._PLAN.md`), continue until the plan is complete unless explicit human feedback or direction is required to proceed.
