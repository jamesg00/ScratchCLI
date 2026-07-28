# Store & GitHub listing copy (ScratchCLI v0.1.0)

Paste these into Partner Center / GitHub Release as needed.

---

## Short description (Store — keep under ~300 characters)

ScratchCLI is a local-first coding scratchpad for Windows. CLI-first console for notes and files, a nano-style editor with a transparent command strip, Python run/build, and optional AI — no account required. Your notes and keys stay on your PC.

---

## Full description (Store)

**ScratchCLI** is a lightweight, local-first developer cockpit for Windows.

It starts as a full **CLI home** (Command Prompt, PowerShell, WSL, or Python-style shell). Create or open notes and files to enter **Editor mode**, with a transparent command strip at the bottom — like nano, not a buried terminal panel. Leave with Esc or `close`; use `resume` to bring your tabs back.

### What you can do

- Scratch and organize notes with pin, color, archive, trash, and revision history
- Edit with tabs and up to four split panes (Python, Markdown, or plain text)
- Run and syntax-check Python buffers with your system Python
- Browse folders and open disk files from the in-app working directory
- Optionally chat with local models (Ollama / LM Studio) or cloud providers you configure
- Optionally use DSA practice tools and host agent CLIs (`claude`, `codex`) if you already have them installed

### Privacy & accounts

ScratchCLI does **not** require a ScratchCLI account. Notes and optional API keys are stored per Windows user under AppData. Cloud AI is optional and only used when you add keys or point the app at a local model server.

Requires the Microsoft Edge **WebView2** Runtime (included on most Windows 10/11 devices).

---

## What’s new (v0.1.0)

- First public Windows release (x64 NSIS installer)
- CLI-first home + nano-style Editor mode with resume
- Local notes library (pin, color, archive, trash)
- Optional AI keys / Assistant / DSA coach
- Per-user local data (notes + secrets in AppData)

---

## GitHub About blurb (repo sidebar)

CLI-first local coding scratchpad for Windows — notes, editor, shell, and optional AI. No account required.

---

## GitHub Release title / body (example)

**Title:** ScratchCLI v0.1.0

**Body:**

```markdown
## ScratchCLI 0.1.0

First Windows release of ScratchCLI — a CLI-first, local-first coding scratchpad.

### Download

- **Installer (x64):** `ScratchCLI_0.1.0_x64-setup.exe`
- Silent install: `ScratchCLI_0.1.0_x64-setup.exe /S`

### Notes

- Requires WebView2 (usually already on Windows 10/11).
- Unsigned builds may show a SmartScreen warning.
- Your notes and API keys stay in your user AppData — each Windows account starts fresh.

See the README and PRIVACY.md for details.
```
