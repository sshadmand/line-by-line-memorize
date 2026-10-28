# Line by Line · Memorize

A tiny, self-contained presentation practice page. Paste your text with line breaks, then redact words from the end of each line one step at a time as you memorize. The first word stays visible until the final step. Choose a redaction style: **Full word** (the default), **Half word** (keep the first half visible, rounded up), or **Keep first letter**. The selected style applies whenever a word is redacted.

Your script, current redaction step, and redaction style are saved in this browser’s local storage and restored when you reopen the page.

## Use it

Open `index.html` in a browser. There is no build step or dependency.

- Use the range slider to redact or reveal trailing words on each line. Double-click the script in the normal view to edit it inline; edits save when you leave the text.
- Once all lines are down to their first word, the next step masks about half of that word; the final step leaves its first letter as a hint.
- Hold **Peak** beside **Practice mode** to peek at the redacted words.
- Use **Practice mode** to show only the script and redactions. Hold anywhere on the script to reveal the answers temporarily. Use **Auto-scroll** in Practice mode to move down the page hands-free; while it is running, **↑** and **↓** adjust its speed, which is saved for next time. Arrow keys change redaction and scroll through lines; **⌘+** / **⌘−** change redaction (use **Ctrl** on Windows/Linux); press **Esc** or tap **×** to exit.

GitHub Pages can host this page directly from the repository.

## Optional cloud library

Users can continue practicing without an account. When the cloud backend is configured, **Log in** (beside GitHub) offers Google and email-code login. Signed-in users can name and save multiple scripts, open them on another device, and manage them under **My scripts**. Practice settings travel with each saved script. Changes remain on the current device until **Save to cloud** is selected; conflicting edits offer **Save a copy**.

See [cloud setup](docs/CLOUD_SETUP.md) for the Supabase migration, authentication configuration, local testing, and release checks. Production hosting remains static GitHub Pages. Node dependencies are only needed to run development checks or regenerate the bundled SDK.


## Contributing

Upstream pull requests are welcome and help improve the original project. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidance. Contributions are encouraged, but not required to use or fork the project.

## License

This project is free and open source under the [GNU Affero General Public License v3.0 or later](LICENSE) (AGPL-3.0-or-later). You may use, share, and fork it under those terms. If you modify it and let people use it over a network, the AGPL requires you to offer those users the corresponding source code. The license does not require submitting changes as pull requests to this upstream repository.
