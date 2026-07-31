# Store & GitHub listing copy (ScratchCLI v0.1.2)

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

## What’s new (v0.1.2)

- `easy` / `medium` / `next` / `oa` pull real LeetCode problems again; `invent` / `hard` invent+seal locally
- Submit accepts when every case in the file passes (no fixed 3/4 minimum)
- Linked-list / tree LeetCode problems get `ListNode` / `TreeNode` helpers in the harness
- File mode still attaches the open buffer after Clear; invent no longer spoils the solution in coach chat
- Clear conversation wipes DSA coach + Assistant chat history

---

## GitHub About blurb (repo sidebar)

CLI-first local coding scratchpad for Windows — notes, editor, shell, and optional AI. No account required.

---

## GitHub Release title / body (example)

**Title:** ScratchCLI v0.1.2

**Body:**

```markdown
## ScratchCLI 0.1.2

Coach/practice reliability — LeetCode easy/medium restored, flexible submit, ListNode/TreeNode harness, File-mode context after Clear.

### Download

- **Installer (x64):** `ScratchCLI_0.1.2_x64-setup.exe`
- Silent install: `ScratchCLI_0.1.2_x64-setup.exe /S`

### Highlights

- Easy/medium/next/oa fetch LeetCode; invent/hard invent+seal
- Submit when all cases in the file pass
- ListNode/TreeNode helpers for LC list/tree problems
- File mode keeps open-file context after Clear; invent stream hidden from coach
- Clear conversation for DSA + Assistant

### Notes

- Requires WebView2 (usually already on Windows 10/11).
- Unsigned builds may show a SmartScreen warning.
- Your notes and API keys stay in your user AppData — each Windows account starts fresh.
```
