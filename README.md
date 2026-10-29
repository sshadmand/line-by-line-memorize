# Line by Line · Memorize

A tiny, self-contained presentation practice page. Paste your text with line breaks, then redact words from the end of each line one step at a time as you memorize. The first word stays visible until the final step. Choose a redaction style: **Full word** (the default), **Half word** (keep the first half visible, rounded up), or **Keep first letter**. The selected style applies whenever a word is redacted. Punctuation always stays visible, including quotes, apostrophes, hyphens, and sentence endings. Half-word and first-letter hints count only non-punctuation characters; standalone punctuation does not count as a word.

Your script, current redaction step, and redaction style are saved in this browser’s local storage and restored when you reopen the page.

## Use it

Open `index.html` in a browser. There is no build step or dependency.

- Use the range slider to redact or reveal trailing words on each line. Double-click the script in either view to edit it inline at the clicked word; edits save automatically as you type. Leave the text or press **Esc** to return to practice. The editor keeps the same text size, line spacing, and reading position when opening and closing; normal editing grows with the script instead of introducing another scroll box. In Practice mode, editing pauses auto-scroll and **Esc** returns to practice; press **Esc** again to exit.
- First words stay visible until the final step, when the selected redaction style applies to them too.
- Press and hold **Peak** or anywhere inside the script box to peek at redacted words in either view. Release to hide them again. Double-click still opens the editor at the clicked text.
- Use **Practice mode** to show only the script and redactions. Hold anywhere on the script to reveal the answers temporarily. Use **Auto-scroll** in Practice mode to move down the page hands-free; while it is running, **↑** and **↓** adjust its speed, which is saved for next time. Arrow keys change redaction and scroll through lines; **⌘+** / **⌘−** change redaction (use **Ctrl** on Windows/Linux); press **Esc** or tap **×** to exit.

GitHub Pages can host this page directly from the repository.

## Optional cloud library

Users can continue practicing without an account. **Log in** (beside GitHub) offers Google login when its backend is configured. Signed-in users can click the script heading to rename it, save multiple scripts, open them on another device, and manage them under **My scripts**. Practice settings travel with each saved script. Changes save automatically: immediately on the current device, and after a short pause to the cloud when signed in. **New script** is in **My scripts**. Offline changes sync when the connection returns; conflicting edits offer **Save a copy**. Email-code login is also implemented and can be enabled once mail delivery is configured.

See [cloud setup](docs/CLOUD_SETUP.md) for the Supabase migration, authentication configuration, local testing, and release checks. Production hosting remains static GitHub Pages. Node dependencies are only needed to run development checks or regenerate the bundled SDK.

Google login and the cloud script library are enabled in production. Signing in is optional; guest scripts continue to save on the current device. The production feature gate can disable account code and session handling independently of the rest of the site.


## Contributing

Upstream pull requests are welcome and help improve the original project. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidance. Contributions are encouraged, but not required to use or fork the project.

## License

This project is free and open source under the [GNU Affero General Public License v3.0 or later](LICENSE) (AGPL-3.0-or-later). You may use, share, and fork it under those terms. If you modify it and let people use it over a network, the AGPL requires you to offer those users the corresponding source code. The license does not require submitting changes as pull requests to this upstream repository.
