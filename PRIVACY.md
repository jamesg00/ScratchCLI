# Privacy Policy for ScratchCLI

**Effective date:** July 27, 2026  
**Product:** ScratchCLI (desktop application)  
**Publisher:** ScratchCLI

This Privacy Policy describes how ScratchCLI handles information when you install and use the desktop app on your computer.

## Summary

ScratchCLI is a **local-first** desktop application. Your notes, settings, and API keys are stored on **your device**. The app does not require a ScratchCLI account and does not operate a ScratchCLI cloud backend that collects your content by default.

## Information stored on your device

Depending on how you use the app, ScratchCLI may store the following **locally** under your Windows user profile (for example under `%APPDATA%\com.scratchcli.desktop\` and WebView local storage):

- **Notes and revisions** in a local SQLite database
- **Appearance preferences** (theme, font, colors, opacity)
- **AI preferences** (provider choice, model name, local Ollama/LM Studio base URLs)
- **API keys** you voluntarily enter (for example OpenAI, Anthropic, or xAI) in a local `secrets.json` file
- **Workspace-related state** such as recent working directory and open-tab recovery data

These files remain on your computer. Uninstalling the app may leave AppData files unless you delete them manually.

## Information sent over the network

ScratchCLI may contact the internet only when a feature you use requires it. Examples include:

- **Cloud AI providers** you configure (for example OpenAI, Anthropic, or xAI): prompts, buffer/context you choose to send, and your API key are transmitted to that provider under **their** terms and privacy policy
- **Local AI servers** you point the app at (Ollama, LM Studio): traffic stays on your machine or LAN according to how you configured those URLs
- **Optional practice / LeetCode-related features** if you use them: requests may be sent to third-party sites as needed for that feature
- **Web fonts** (for example Google Fonts) when a font catalog entry needs to load from the network
- **CLI agent tools** you launch inside the app (`claude`, `codex`, and similar): those tools use **their own** authentication and network behavior; ScratchCLI hosts their terminal session locally but does not replace their privacy policies

ScratchCLI does **not** sell your personal information.

## API keys and “environment” settings

API keys and related AI settings are saved **per Windows user** on the local machine. They are not embedded in the installer or EXE. Keys are stored in app data (currently as a local secrets file). Protect access to your user account; anyone with access to your profile can potentially read those files.

## Children

ScratchCLI is not directed at children under 13, and we do not knowingly collect personal information from children.

## Data retention and deletion

Because data is stored locally, retention is controlled by you. You can delete notes in the app, clear API keys in **AI keys** settings, or remove the app data folder from your user profile. ScratchCLI does not maintain a separate cloud copy of your notes for recovery after you delete local files.

## Third-party services

If you connect third-party AI or developer services, their privacy policies apply to data you send them. Review those policies before pasting secrets or personal content into prompts.

## Changes

We may update this Privacy Policy as the product changes. The effective date at the top will be revised when material changes are made. Continued use of the app after an update constitutes acceptance of the revised policy where permitted by law.

## Contact

For privacy questions about ScratchCLI, contact the publisher through the project’s public repository or distribution page where you obtained the app.

---

*This policy describes the desktop ScratchCLI application’s intended data practices. It is not legal advice. If you distribute ScratchCLI commercially or through an app store, have counsel review this text for your jurisdiction and listing requirements.*
