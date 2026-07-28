import type { ThemeName } from "../../stores/appearanceStore";
import type { ShellKind } from "../../types/shell";

export type TerminalCommand =
  | { kind: "help" }
  | { kind: "clear" }
  | { kind: "exit" }
  | { kind: "close" }
  | { kind: "terminal" }
  | { kind: "run" }
  | { kind: "build" }
  | { kind: "theme"; value: ThemeName }
  | { kind: "opacity"; value: number }
  | { kind: "opacityToggle"; on: boolean }
  | { kind: "font"; value?: string }
  | { kind: "fontAdd"; path: string }
  | { kind: "fontClear" }
  | { kind: "fontSize"; value: number }
  | { kind: "background"; value: string }
  | { kind: "foreground"; value: string }
  | { kind: "color"; foreground: string; background?: string }
  | { kind: "language"; value: "python" | "markdown" | "plaintext" }
  | { kind: "shellMode"; value: "python" | ShellKind }
  | { kind: "shellRun"; shell: ShellKind; command: string }
  | { kind: "notes" }
  | { kind: "newNote"; title?: string }
  | { kind: "touchNote"; title?: string }
  | { kind: "openNote"; query: string }
  | { kind: "openFile"; path: string }
  | { kind: "lookNote"; query: string }
  | { kind: "lookFile"; path: string }
  | { kind: "removeNote"; query: string }
  | { kind: "removePath"; path: string }
  | { kind: "mkdir"; path: string }
  | { kind: "touch"; path: string }
  | { kind: "split"; count?: 1 | 2 | 3 | 4 }
  | { kind: "tabList" }
  | { kind: "tabClose"; query?: string }
  | { kind: "tabNew" }
  | { kind: "tabClone" }
  | { kind: "grok" }
  | { kind: "assistant" }
  | { kind: "aiSettings" }
  | { kind: "agent"; name: "claude" | "codex" }
  | { kind: "resume" }
  | { kind: "snip"; id?: string }
  | { kind: "save" }
  | { kind: "pwd" }
  | { kind: "cd"; path: string }
  | { kind: "ls"; path?: string }
  | { kind: "error"; message: string };

const cmdColors: Record<string, string> = {
  "0": "#0c0c0c",
  "1": "#0037da",
  "2": "#13a10e",
  "3": "#3a96dd",
  "4": "#c50f1f",
  "5": "#881798",
  "6": "#c19c00",
  "7": "#cccccc",
  "8": "#767676",
  "9": "#3b78ff",
  a: "#16c60c",
  b: "#61d6d6",
  c: "#e74856",
  d: "#b4009e",
  e: "#f9f1a5",
  f: "#f2f2f2",
};

const hexColor = /^#[0-9a-f]{6}$/i;

/** First-token names the editor may treat as slash commands (exact match only). */
const EDITOR_SLASH_NAMES = new Set([
  "help",
  "?",
  "clear",
  "cls",
  "exit",
  "close",
  "terminal",
  "run",
  "runtime",
  "build",
  "check",
  "theme",
  "opacity",
  "font",
  "fonts",
  "list",
  "fontsize",
  "bg",
  "background",
  "fg",
  "foreground",
  "color",
  "language",
  "lang",
  "shell",
  "powershell",
  "pwsh",
  "ps",
  "cmd",
  "wsl",
  "notes",
  "new",
  "save",
  "write",
  "pwd",
  "cd",
  "ls",
  "dir",
  "open",
  "edit",
  "look",
  "cat",
  "remove",
  "rm",
  "mkdir",
  "md",
  "touch",
  "newfile",
  "split",
  "tab",
  "clone",
  "duplicate",
  "grok",
  "coach",
  "dsa",
  "assistant",
  "chat",
  "ai",
  "env",
  "aisettings",
  "apikeys",
  "claude",
  "codex",
  "resume",
  "editor",
  "snip",
  "snippet",
  "snippets",
]);

function splitArgs(value: string): string[] {
  return value.trim() ? value.trim().split(/\s+/) : [];
}

/** True only when the line is a known ScratchCLI slash command (not e.g. a path). */
export function isEditorSlashCommand(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("/")) return false;
  const name = trimmed.slice(1).split(/\s+/)[0]?.toLowerCase() ?? "";
  return EDITOR_SLASH_NAMES.has(name);
}

export function parseTerminalCommand(raw: string): TerminalCommand {
  const trimmed = raw.trim();
  const normalized = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const [name = "", ...parts] = normalized.split(/\s+/);
  const command = name.toLowerCase();
  const value = parts.join(" ");

  switch (command) {
    case "help":
    case "?":
      return { kind: "help" };
    case "clear":
    case "cls":
      return { kind: "clear" };
    case "exit":
      return { kind: "exit" };
    case "close":
      return { kind: "close" };
    case "terminal":
      return { kind: "terminal" };
    case "run":
    case "runtime":
      return { kind: "run" };
    case "build":
    case "check":
      return { kind: "build" };
    case "theme":
      if (value === "light" || value === "dark" || value === "pro") {
        return { kind: "theme", value };
      }
      return {
        kind: "error",
        message: "Usage: theme light|dark|pro",
      };
    case "opacity": {
      const raw = value.trim().toLowerCase();
      if (!raw) {
        return {
          kind: "error",
          message: "Usage: opacity on|off | opacity 0-100 | opacity 0-1",
        };
      }
      if (raw === "on" || raw === "true" || raw === "enable") {
        return { kind: "opacityToggle", on: true };
      }
      if (
        raw === "off" ||
        raw === "false" ||
        raw === "disable" ||
        raw === "solid"
      ) {
        return { kind: "opacityToggle", on: false };
      }
      const percent = raw.match(/^(\d+(?:\.\d+)?)\s*%$/);
      if (percent) {
        const pct = Number(percent[1]);
        if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
          return { kind: "opacity", value: pct / 100 };
        }
      }
      const n = Number(raw);
      if (Number.isFinite(n)) {
        // 0–1 fraction, or 0–100 percent shorthand (e.g. opacity 80)
        if (n >= 0 && n <= 1) return { kind: "opacity", value: n };
        if (n > 1 && n <= 100) return { kind: "opacity", value: n / 100 };
      }
      return {
        kind: "error",
        message: "Usage: opacity on|off | opacity 0-100 | opacity 0-1",
      };
    }
    case "font":
    case "fonts": {
      const args = splitArgs(value);
      const head = args[0]?.toLowerCase();
      if (head === "add") {
        const path = args.slice(1).join(" ");
        return path
          ? { kind: "fontAdd", path }
          : { kind: "error", message: "Usage: font add <path>" };
      }
      if (head === "clear" || head === "reset" || head === "default") {
        return { kind: "fontClear" };
      }
      return { kind: "font", value: value || undefined };
    }
    case "list": {
      const args = splitArgs(value);
      const head = args[0]?.toLowerCase();
      if (head === "fonts" || head === "font") {
        const rest = args[1]?.toLowerCase();
        if (rest === "clear" || rest === "reset" || rest === "default") {
          return { kind: "fontClear" };
        }
        if (args.length > 1) {
          return {
            kind: "font",
            value: args.slice(1).join(" "),
          };
        }
        return { kind: "font" };
      }
      return {
        kind: "error",
        message: "Usage: list fonts  (or list fonts clear)",
      };
    }
    case "fontsize": {
      const size = Number(value);
      if (Number.isFinite(size) && size >= 10 && size <= 30) {
        return { kind: "fontSize", value: size };
      }
      return {
        kind: "error",
        message: "Usage: fontsize 10-30",
      };
    }
    case "bg":
    case "background":
      return hexColor.test(value)
        ? { kind: "background", value }
        : { kind: "error", message: "Usage: bg #RRGGBB" };
    case "fg":
    case "foreground":
      return hexColor.test(value)
        ? { kind: "foreground", value }
        : { kind: "error", message: "Usage: fg #RRGGBB" };
    case "color": {
      const code = value.toLowerCase().replace(/\s+/g, "");
      if (code.length === 1 && cmdColors[code]) {
        return { kind: "color", foreground: cmdColors[code]! };
      }
      if (code.length === 2 && cmdColors[code[0]!] && cmdColors[code[1]!]) {
        return {
          kind: "color",
          background: cmdColors[code[0]!]!,
          foreground: cmdColors[code[1]!]!,
        };
      }
      return {
        kind: "error",
        message:
          "Usage: color FG | color BF (CMD: background then foreground, 0-F)",
      };
    }
    case "language":
    case "lang":
      if (value === "python" || value === "markdown" || value === "plaintext") {
        return { kind: "language", value };
      }
      return {
        kind: "error",
        message: "Usage: language python|markdown|plaintext",
      };
    case "shell":
      if (
        value === "python" ||
        value === "powershell" ||
        value === "cmd" ||
        value === "wsl"
      ) {
        return { kind: "shellMode", value };
      }
      return {
        kind: "error",
        message: "Usage: shell python|powershell|cmd|wsl",
      };
    case "powershell":
    case "pwsh":
    case "ps":
      return value
        ? { kind: "shellRun", shell: "powershell", command: value }
        : {
            kind: "shellMode",
            value: "powershell",
          };
    case "cmd":
      return value
        ? { kind: "shellRun", shell: "cmd", command: value }
        : { kind: "shellMode", value: "cmd" };
    case "wsl":
      return value
        ? { kind: "shellRun", shell: "wsl", command: value }
        : { kind: "shellMode", value: "wsl" };
    case "notes":
      return { kind: "notes" };
    case "new":
      return { kind: "newNote", title: value || undefined };
    case "save":
    case "write":
      return { kind: "save" };
    case "pwd":
      return { kind: "pwd" };
    case "cd":
      return value
        ? { kind: "cd", path: value }
        : { kind: "error", message: "Usage: cd <path>" };
    case "ls":
    case "dir": {
      if (value.toLowerCase() === "notes") {
        return { kind: "notes" };
      }
      return { kind: "ls", path: value || undefined };
    }
    case "open":
    case "edit": {
      if (!value) {
        return {
          kind: "error",
          message: `Usage: ${command} <path> | ${command} note <id|title>`,
        };
      }
      const [first = "", ...rest] = splitArgs(value);
      if (first.toLowerCase() === "note") {
        const query = rest.join(" ");
        return query
          ? { kind: "openNote", query }
          : { kind: "error", message: "Usage: open note <id|title>" };
      }
      return { kind: "openFile", path: value };
    }
    case "look":
    case "cat": {
      if (!value) {
        return {
          kind: "error",
          message: "Usage: look <path> | look note <id|title>",
        };
      }
      const [first = "", ...rest] = splitArgs(value);
      if (first.toLowerCase() === "note") {
        const query = rest.join(" ");
        return query
          ? { kind: "lookNote", query }
          : { kind: "error", message: "Usage: look note <id|title>" };
      }
      return { kind: "lookFile", path: value };
    }
    case "remove":
    case "rm": {
      if (!value) {
        return {
          kind: "error",
          message: "Usage: remove <path> | remove note <id|title>",
        };
      }
      const [first = "", ...rest] = splitArgs(value);
      if (first.toLowerCase() === "note") {
        const query = rest.join(" ");
        return query
          ? { kind: "removeNote", query }
          : { kind: "error", message: "Usage: remove note <id|title>" };
      }
      return { kind: "removePath", path: value };
    }
    case "mkdir":
    case "md":
      return value
        ? { kind: "mkdir", path: value }
        : { kind: "error", message: "Usage: mkdir <path>" };
    case "touch":
    case "newfile": {
      if (!value) {
        return {
          kind: "error",
          message: "Usage: touch <path> | touch note [title]",
        };
      }
      const [first = "", ...rest] = splitArgs(value);
      if (first.toLowerCase() === "note") {
        return { kind: "touchNote", title: rest.join(" ") || undefined };
      }
      return { kind: "touch", path: value };
    }
    case "split": {
      if (!value) return { kind: "split" };
      const count = Number(value);
      if (count === 1 || count === 2 || count === 3 || count === 4) {
        return { kind: "split", count };
      }
      return {
        kind: "error",
        message: "Usage: split | split 1|2|3|4",
      };
    }
    case "tab": {
      const [action = "list", ...rest] = splitArgs(value);
      const lower = action.toLowerCase();
      if (!value || lower === "list" || lower === "ls") {
        return { kind: "tabList" };
      }
      if (lower === "new" || lower === "add") {
        return { kind: "tabNew" };
      }
      if (lower === "clone" || lower === "duplicate" || lower === "copy") {
        return { kind: "tabClone" };
      }
      if (lower === "close" || lower === "x") {
        return { kind: "tabClose", query: rest.join(" ") || undefined };
      }
      return {
        kind: "error",
        message: "Usage: tab list|new|clone|close [name]",
      };
    }
    case "clone":
    case "duplicate":
      return { kind: "tabClone" };
    case "grok":
    case "coach":
    case "dsa":
      return { kind: "grok" };
    case "assistant":
    case "chat":
    case "ai":
      return { kind: "assistant" };
    case "env":
    case "aisettings":
    case "apikeys":
      return { kind: "aiSettings" };
    case "claude":
      return { kind: "agent", name: "claude" };
    case "codex":
      return { kind: "agent", name: "codex" };
    case "resume":
    case "editor":
      return { kind: "resume" };
    case "snip":
    case "snippet":
    case "snippets":
      return { kind: "snip", id: value.trim() || undefined };
    case "":
      return { kind: "error", message: "" };
    default:
      return {
        kind: "error",
        message: `Unknown command: ${name}. Type help for commands.`,
      };
  }
}

export const helpText = `ScratchCLI commands
  Modes (CLI-first, nano-style)
  CLI is home. open / edit / new enter Editor mode.
  close / Esc returns to CLI. resume reopens hidden editor tabs.

  open <path>               Open a disk file in Editor mode
  open note <id|title>      Open a ScratchCLI note
  edit <path|note ...>      Same as open
  resume / editor           Resume Editor mode (tabs kept after close)
  look <path>               Print a file in the CLI (like cat)
  look note <id|title>      Print a note in the CLI
  cat <path|note ...>       Alias for look
  remove <path>             Delete a file or folder
  remove note <id|title>    Delete a ScratchCLI note
  rm <path|note ...>        Alias for remove
  mkdir <path> / md <path>  Create a folder (uses in-app cwd)
  touch <path>              Create an empty file
  touch note [title]        Create a note (prompts for title if omitted)
  new [title]               Create a note (prompts for title if omitted)
  split / split 1|2|3|4     Split the editor into up to 4 panes
  tab list|new|clone|close  Manage editor tabs
  clone / duplicate         Clone the current note/file into a new tab
  grok / coach / dsa        Open the DSA coach (Practice)
  assistant / chat / ai     Open the general AI Assistant
  claude / codex            Launch agent CLIs in the in-app TTY (PATH required)
  snip [id] / snippet list Insert a DSA snippet (or list ids)
  notes / ls notes          List notes
  save / write               Save the current note or file
  close                     Leave Editor mode (back to full CLI)
  resume / editor           Return to Editor with open tabs
  pwd / cd <path>           Show or change the in-app working directory
  ls [path]                 List directory entries (double-click a file to open)
  /run or run               Run the current Python buffer (system Python + packages)
  /build or build           Check current Python syntax
  /language python          Optional — Python is already the default
  shell python|powershell|cmd|wsl
  python / py / pip …       Use system Python on PATH (works from py> too)
  python                    Open an interactive system Python REPL
  pip install <pkg>         Install packages into your system/user Python
  /powershell <command>     Run local PowerShell
  /cmd <command>            Run local Command Prompt
  /wsl <command>            Run (or host interactively) via WSL
  Interactive tools (vim, …) also open inside ScratchCLI’s TTY.
  Prefer claude / codex commands above for PATH preflight + friendly errors.
  theme light|dark|pro      Change the application theme
  env / aisettings          AI environment (API keys, Ollama URLs)
  opacity on|off            Transparency on (restore) or off (solid 100%)
  opacity 0-100 | 0-1       Set opacity (e.g. opacity 70 or opacity 0.7)
  list fonts / font / fonts Clickable font list (same idea as ls)
  font <name>               Apply a system or workspace font
  font clear                Reset to the default font (Consolas)
  font add <path>           Copy a .ttf/.otf/.woff2 into ScratchCLI fonts
  fontsize 10-30            Change editor font size
  bg #RRGGBB / fg #RRGGBB   Custom colors
  color FG | color BF       CMD colors (one digit = fg; two = bg then fg)
  clear / cls               Clear CLI output
  exit                      Leave editor, or quit prompt flow
  help                      Show this command list

Editor: type /commands on their own line and press Enter.
Focus CLI: / (start of line in editor), Ctrl+\` or Ctrl+\\ (backslash).
Text size: scales with window size; Ctrl+= / Ctrl+- nudges it (10–30px base).
Nano-style: Escape or Ctrl+X asks to save if the file is new or modified (Y/N/C).
Shortcuts: Ctrl+S save · Ctrl+B build · Ctrl+R run · Ctrl+F find · Ctrl+M language
  Ctrl+Shift+C clone tab · Ctrl+Shift+A Assistant · Ctrl+G DSA coach · Ctrl+Shift+V visualize · Ctrl+K palette · Ctrl+H help · Ctrl+, appearance
Python: uses your PATH interpreter (py/python). cd into a repo, then pip install / python main.py.
  Buffer run also sees pip-installed packages. Use print(...) to show values.`;

export function shellPrompt(
  shellMode: "python" | ShellKind,
  cwd: string,
): string {
  const short =
    cwd.length > 42 ? `…${cwd.slice(-40).replaceAll("\\", "/")}` : cwd;
  switch (shellMode) {
    case "powershell":
      return `PS ${short}>`;
    case "wsl":
      return `${short.replaceAll("\\", "/")}$`;
    case "python":
      return "py>";
    case "cmd":
    default:
      return `${short}>`;
  }
}
