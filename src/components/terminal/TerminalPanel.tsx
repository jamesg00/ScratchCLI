import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  DEFAULT_FONT,
  findFontByLabel,
  workspaceFontOption,
  type FontOption,
} from "../../fonts/catalog";
import { fileService, type DirEntry } from "../../services/files";
import { executePython } from "../../services/python";
import { shellNeedsPty } from "../../services/pty";
import { executeLocalShell } from "../../services/shell";
import { useAppearanceStore } from "../../stores/appearanceStore";
import type {
  NanoPrompt,
  ShellMode,
  ViewMode,
} from "../../stores/sessionStore";
import { normalizeError } from "../../types/error";
import type { ShellKind } from "../../types/shell";
import { InteractivePty, type InteractivePtyHandle } from "./InteractivePty";
import { CliBrandBanner } from "./CliBrandBanner";
import { createBrandOutputLine } from "./cliBrand";
import {
  helpText,
  parseTerminalCommand,
  shellPrompt,
  type TerminalCommand,
} from "./commands";

type DirListing = {
  basePath: string;
  entries: DirEntry[];
};

type FontListing = {
  fonts: FontOption[];
  activeValue: string;
};

type OutputLine = {
  id: number;
  kind: "command" | "output" | "error" | "system" | "brand";
  text: string;
  listing?: DirListing;
  fontListing?: FontListing;
};

export type CliHandlers = {
  listNotes: () => Promise<string>;
  openNote: (query: string) => Promise<string>;
  openFile: (path: string) => Promise<string>;
  lookNote: (query: string) => Promise<string>;
  lookFile: (path: string) => Promise<string>;
  removeNote: (query: string) => Promise<string>;
  removePath: (path: string) => Promise<string>;
  mkdir: (path: string) => Promise<string>;
  touch: (path: string) => Promise<string>;
  touchNote: (title?: string) => Promise<string>;
  splitView: (count?: 1 | 2 | 3 | 4) => Promise<string>;
  listTabs: () => Promise<string>;
  newTab: () => Promise<string>;
  cloneTab: () => Promise<string>;
  closeTab: (query?: string) => Promise<string>;
  createNote: (title?: string) => Promise<string>;
  requestNoteTitle: () => void;
  saveDocument: () => Promise<string>;
  closeEditor: (opts?: { discard?: boolean }) => Promise<string | void>;
  requestSaveExit: () => void;
  setLanguage: (language: "python" | "markdown" | "plaintext") => void;
  changeCwd: (path: string) => Promise<string>;
  listDirectory: (path?: string) => Promise<DirListing>;
  getBuffer: () => { code: string; language: string };
  isDirty: () => boolean;
  onShellModeChange: (mode: ShellMode) => void;
  onFontsChanged: (fonts: FontOption[]) => void;
  getFontCatalog: () => FontOption[];
  openGrok?: () => void;
  openStudy?: () => void;
  openAssistant?: () => void;
  openAiSettings?: () => void;
  launchAgent?: (name: "claude" | "codex") => Promise<string>;
  resumeEditor?: () => boolean;
  insertSnippet?: (id?: string) => Promise<string>;
};

type Props = {
  variant: ViewMode;
  code: string;
  language: string;
  cwd: string;
  shellMode: ShellMode;
  nanoPrompt: NanoPrompt;
  focusToken: number;
  cliSeed?: string | null;
  handlers: CliHandlers;
  request?: { id: number; command: string; code?: string } | null;
  notice?: { id: number; text: string } | null;
  onNanoChoice: (choice: "y" | "n" | "c") => void;
  onCliSeedConsumed?: () => void;
};

let outputId = 0;

function initialCliLines(variant: ViewMode): OutputLine[] {
  if (variant !== "cli") return [];
  return [createBrandOutputLine(outputId++)];
}

function historyKey(cwd: string): string {
  return `scratchcli-command-history:${cwd.trim().toLowerCase() || "default"}`;
}

function readHistory(cwd: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(historyKey(cwd)) ?? "[]");
    return Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === "string")
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

export function TerminalPanel({
  variant,
  code,
  language,
  cwd,
  shellMode,
  nanoPrompt,
  focusToken,
  cliSeed = null,
  handlers,
  request,
  notice,
  onNanoChoice,
  onCliSeedConsumed,
}: Props) {
  const appearance = useAppearanceStore();
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>(() => readHistory(cwd));
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [ptyJob, setPtyJob] = useState<{
    shell: ShellKind;
    command: string;
    key: number;
  } | null>(null);
  const [lines, setLines] = useState<OutputLine[]>(() =>
    initialCliLines(variant),
  );
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ptyRef = useRef<InteractivePtyHandle>(null);
  const nanoAnnounced = useRef<NanoPrompt>(null);
  const wasPtyRef = useRef(false);

  useEffect(() => {
    if (ptyJob) {
      wasPtyRef.current = true;
      return;
    }
    if (!wasPtyRef.current) return;
    wasPtyRef.current = false;
    // Input remounts after PTY teardown — focus on the next frames.
    const id = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [ptyJob]);

  useEffect(() => {
    setHistory(readHistory(cwd));
    setHistoryIndex(-1);
  }, [cwd]);

  useEffect(() => {
    localStorage.setItem(
      historyKey(cwd),
      JSON.stringify(history.slice(0, 100)),
    );
  }, [cwd, history]);

  const append = (
    kind: OutputLine["kind"],
    text: string,
    listing?: DirListing,
    fontListing?: FontListing,
  ) => {
    if (!text && !listing && !fontListing) return;
    setLines((current) => [
      ...current.slice(-199),
      {
        id: outputId++,
        kind,
        text: text || listing?.basePath || fontListing?.fonts[0]?.label || "",
        listing,
        fontListing,
      },
    ]);
    requestAnimationFrame(() => {
      outputRef.current?.scrollTo({
        top: outputRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  const openListingEntry = async (entry: DirEntry) => {
    try {
      if (entry.isDir) {
        append("system", await handlers.changeCwd(entry.path));
        const listing = await handlers.listDirectory();
        const text = listing.entries.length
          ? listing.entries
              .map((item) => `${item.isDir ? "dir " : "    "} ${item.name}`)
              .join("\n")
          : `(empty) ${listing.basePath}`;
        append("output", text, listing);
        append(
          "system",
          "Double-click a file to open · double-click a folder to enter",
        );
        return;
      }
      append("system", await handlers.openFile(entry.path));
    } catch (error) {
      append("error", normalizeError(error).message);
    }
  };

  const looksLikePython = (source: string) =>
    /^\s*(async\s+def|def|class|import|from\s+\S+\s+import)\s+/m.test(source) ||
    /^\s*(print|if|for|while|try|with|return)\b/m.test(source);

  const hintForPythonStderr = (stderr: string) => {
    if (/UnboundLocalError/i.test(stderr)) {
      return "Hint: assigning with += inside a function makes that name local. Use a local total (total = 0) or declare global.";
    }
    if (/NameError/i.test(stderr)) {
      return "Hint: a name was used before it was defined in this scope.";
    }
    if (/SyntaxError/i.test(stderr)) {
      return "Hint: check indentation and missing colons/parentheses. Try /build to syntax-check.";
    }
    if (/IndentationError/i.test(stderr)) {
      return "Hint: Python needs consistent indentation (4 spaces). Mixed tabs/spaces often break runs.";
    }
    return null;
  };

  const runPython = async (mode: "run" | "build", source?: string) => {
    const buffer = handlers.getBuffer();
    const effectiveSource = source ?? buffer.code ?? code;
    const currentLanguage = buffer.language || language;

    // Python is the default — enable it for run/build without `/language python`.
    if (currentLanguage !== "python") {
      handlers.setLanguage("python");
      if (looksLikePython(effectiveSource)) {
        append("system", "Detected Python — language set automatically.");
      }
    }

    if (!effectiveSource.trim()) {
      append("error", "The current buffer has no Python code.");
      return;
    }

    setRunning(true);
    append(
      "system",
      mode === "run" ? "Running Python..." : "Checking Python syntax...",
    );
    try {
      const result = await executePython(effectiveSource, mode, cwd || null);
      if (result.stdout) append("output", result.stdout.trimEnd());
      if (result.stderr) {
        append("error", result.stderr.trimEnd());
        const hint = hintForPythonStderr(result.stderr);
        if (hint) append("system", hint);
      }
      const status =
        result.exitCode === 0
          ? mode === "build"
            ? `Build check passed in ${result.durationMs}ms.`
            : `Process finished in ${result.durationMs}ms.`
          : `Process exited with code ${result.exitCode ?? "unknown"} after ${result.durationMs}ms.`;
      append(result.exitCode === 0 ? "system" : "error", status);
      if (result.truncated) {
        append("error", "Output was truncated at the 64 KB safety limit.");
      }
    } catch (error) {
      append("error", normalizeError(error).message);
    } finally {
      setRunning(false);
    }
  };

  const hostShell = (): ShellKind => {
    if (
      shellMode === "powershell" ||
      shellMode === "cmd" ||
      shellMode === "wsl"
    ) {
      return shellMode;
    }
    return "powershell";
  };

  const isSystemPythonCommand = (value: string) => {
    const first = value.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    return ["python", "python3", "py", "pip", "pip3"].includes(first);
  };

  const runLocalCommand = async (
    shell: ShellKind,
    command: string,
    opts?: { retainShellMode?: boolean },
  ) => {
    if (!command.trim()) return;
    if (ptyJob) {
      append(
        "error",
        "An interactive session is already running. Exit it first.",
      );
      return;
    }
    if (!opts?.retainShellMode) {
      // Keep ScratchCLI's shell skin; only the PTY host changes below.
    }
    setRunning(true);
    append("system", `${shell}> ${command}`);
    try {
      const needsPty = await shellNeedsPty(command);
      if (needsPty) {
        const first = command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
        const agentish = first === "claude" || first === "codex";
        append(
          "system",
          agentish
            ? `Opening ${first} agent session in ScratchCLI’s TTY…`
            : "Opening interactive TTY inside ScratchCLI…",
        );
        // Host TUIs via cmd on Windows (or wsl when requested). Do not flip the
        // ScratchCLI prompt skin — user returns to the same CLI mode on exit.
        const ptyShell: ShellKind = shell === "wsl" ? "wsl" : "cmd";
        setPtyJob({ shell: ptyShell, command, key: Date.now() });
        return;
      }
      const result = await executeLocalShell(shell, command, cwd || null);
      if (result.stdout) append("output", result.stdout.trimEnd());
      if (result.stderr) append("error", result.stderr.trimEnd());
      append(
        result.exitCode === 0 ? "system" : "error",
        `${result.executable} exited with ${result.exitCode ?? "unknown"} in ${result.durationMs}ms.`,
      );
      if (result.truncated) {
        append("error", "Output was truncated at the 64 KB safety limit.");
      }
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.code === "NEEDS_PTY") {
        append("system", "Opening interactive TTY inside ScratchCLI…");
        const ptyShell: ShellKind = shell === "wsl" ? "wsl" : "cmd";
        setPtyJob({ shell: ptyShell, command, key: Date.now() });
        return;
      }
      append("error", normalized.message);
    } finally {
      setRunning(false);
    }
  };

  const applyFont = (query: string) => {
    const catalog = handlers.getFontCatalog();
    const match = findFontByLabel(catalog, query);
    if (match) {
      appearance.setFontFamily(match.value);
      append("system", `Font changed to ${match.label}.`);
      return;
    }
    appearance.setFontFamily(query);
    append("system", `Font stack set to ${query}.`);
  };

  const clearFont = () => {
    appearance.setFontFamily(DEFAULT_FONT.value);
    append("system", `Font reset to ${DEFAULT_FONT.label}.`);
  };

  const listFonts = () => {
    const catalog = handlers.getFontCatalog();
    const activeValue = useAppearanceStore.getState().fontFamily;
    const text = catalog
      .map((font) => `  ${font.label}  (${font.source})`)
      .join("\n");
    append("output", `Available fonts\n${text}`, undefined, {
      fonts: catalog,
      activeValue,
    });
    append(
      "system",
      "Click a font to apply · click clear to reset · font clear also works",
    );
  };

  const leaveOrPrompt = async () => {
    if (variant !== "editing") {
      append(
        "system",
        "Already in full CLI. Use the window close button to quit ScratchCLI.",
      );
      return;
    }
    if (handlers.isDirty()) {
      handlers.requestSaveExit();
      return;
    }
    await handlers.closeEditor();
    append("system", "Back to CLI.");
  };

  const executeCommand = async (command: TerminalCommand) => {
    switch (command.kind) {
      case "help":
        append("output", helpText);
        break;
      case "clear":
        setLines([]);
        break;
      case "exit":
      case "close":
        await leaveOrPrompt();
        break;
      case "terminal":
        append(
          "system",
          "CLI is always available at the bottom while editing.",
        );
        break;
      case "run":
        await runPython("run");
        break;
      case "build":
        await runPython("build");
        break;
      case "theme":
        appearance.setTheme(command.value);
        append("system", `Theme changed to ${command.value}.`);
        break;
      case "opacity":
        appearance.setOpacity(command.value);
        append(
          "system",
          `Background opacity set to ${Math.round(command.value * 100)}%.`,
        );
        break;
      case "opacityToggle":
        if (command.on) {
          appearance.setOpacityOn();
          append(
            "system",
            `Opacity on — ${Math.round(useAppearanceStore.getState().opacity * 100)}%.`,
          );
        } else {
          appearance.setOpacityOff();
          append("system", "Opacity off — solid 100%.");
        }
        break;
      case "font":
        if (!command.value) listFonts();
        else applyFont(command.value);
        break;
      case "fontClear":
        clearFont();
        break;
      case "fontAdd": {
        setRunning(true);
        try {
          const resolved = await fileService.resolvePath(cwd, command.path);
          const font = await fileService.addUserFont(resolved);
          const option = workspaceFontOption(font.family);
          const next = [
            ...handlers
              .getFontCatalog()
              .filter((item) => item.label !== option.label),
            option,
          ];
          handlers.onFontsChanged(next);
          appearance.setFontFamily(option.value);
          append("system", `Added workspace font "${font.family}".`);
        } catch (error) {
          append("error", normalizeError(error).message);
        } finally {
          setRunning(false);
        }
        break;
      }
      case "fontSize":
        appearance.setFontSize(command.value);
        append("system", `Font size changed to ${command.value}px.`);
        break;
      case "background":
        appearance.setBackgroundColor(command.value);
        append("system", `Background changed to ${command.value}.`);
        break;
      case "foreground":
        appearance.setForegroundColor(command.value);
        append("system", `Foreground changed to ${command.value}.`);
        break;
      case "color":
        if (command.background) {
          appearance.setBackgroundColor(command.background);
        }
        appearance.setForegroundColor(command.foreground);
        append(
          "system",
          command.background
            ? `CMD color set (bg ${command.background}, fg ${command.foreground}).`
            : `CMD foreground set to ${command.foreground}.`,
        );
        break;
      case "language":
        handlers.setLanguage(command.value);
        append("system", `Language changed to ${command.value}.`);
        break;
      case "shellMode":
        handlers.onShellModeChange(command.value);
        append("system", `Shell mode changed to ${command.value}.`);
        break;
      case "shellRun":
        await runLocalCommand(command.shell, command.command);
        break;
      case "notes":
        try {
          append("output", await handlers.listNotes());
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "newNote":
        try {
          if (!command.title) {
            handlers.requestNoteTitle();
            append("system", "Note title:");
            break;
          }
          append("system", await handlers.createNote(command.title));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "touchNote":
        try {
          if (!command.title) {
            handlers.requestNoteTitle();
            append("system", "Note title:");
            break;
          }
          append("system", await handlers.touchNote(command.title));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "openNote":
        try {
          append("system", await handlers.openNote(command.query));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "openFile":
        try {
          append("system", await handlers.openFile(command.path));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "lookNote":
        try {
          append("output", await handlers.lookNote(command.query));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "lookFile":
        try {
          append("output", await handlers.lookFile(command.path));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "removeNote":
        try {
          append("system", await handlers.removeNote(command.query));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "removePath":
        try {
          append("system", await handlers.removePath(command.path));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "mkdir":
        try {
          append("system", await handlers.mkdir(command.path));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "touch":
        try {
          append("system", await handlers.touch(command.path));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "split":
        try {
          append("system", await handlers.splitView(command.count));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "tabList":
        try {
          append("output", await handlers.listTabs());
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "tabNew":
        try {
          append("system", await handlers.newTab());
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "tabClone":
        try {
          append("system", await handlers.cloneTab());
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "tabClose":
        try {
          append("system", await handlers.closeTab(command.query));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "grok":
        if (handlers.openGrok) {
          handlers.openGrok();
          append("system", "Opened DSA coach.");
        } else {
          append("error", "DSA coach is unavailable.");
        }
        break;
      case "study":
        if (handlers.openStudy) {
          handlers.openStudy();
          append("system", "Opened Study board.");
        } else {
          append("error", "Study board is unavailable.");
        }
        break;
      case "assistant":
        if (handlers.openAssistant) {
          handlers.openAssistant();
          append("system", "Opened Assistant.");
        } else {
          append("error", "Assistant is unavailable.");
        }
        break;
      case "aiSettings":
        if (handlers.openAiSettings) {
          handlers.openAiSettings();
          append("system", "Opened AI environment settings.");
        } else {
          append("error", "AI settings are unavailable.");
        }
        break;
      case "agent": {
        const agentName = command.name;
        try {
          if (handlers.launchAgent) {
            await handlers.launchAgent(agentName);
          }
          append("system", `Starting ${agentName} in the workspace cwd…`);
          await runLocalCommand("cmd", agentName, {
            retainShellMode: true,
          });
        } catch (error) {
          const message = normalizeError(error).message;
          if (/not found on PATH/i.test(message)) {
            const hint =
              agentName === "claude"
                ? "Install: https://claude.ai/code  (then reopen ScratchCLI)."
                : "Install: npm install -g @openai/codex  (then reopen ScratchCLI).";
            append("error", `${agentName} was not found on PATH. ${hint}`);
          } else {
            append("error", message);
          }
        }
        break;
      }
      case "resume":
        if (handlers.resumeEditor?.()) {
          append("system", "Resumed Editor mode.");
        } else {
          append(
            "error",
            "No open tabs to resume. Use open <path> or new to enter Editor mode.",
          );
        }
        break;
      case "snip":
        try {
          if (!handlers.insertSnippet) {
            append("error", "Snippets need an open editor.");
            break;
          }
          append("system", await handlers.insertSnippet(command.id));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "save":
        try {
          append("system", await handlers.saveDocument());
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "pwd":
        append("output", cwd || "(no working directory)");
        break;
      case "cd":
        try {
          append("system", await handlers.changeCwd(command.path));
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "ls":
        try {
          const listing = await handlers.listDirectory(command.path);
          const text = listing.entries.length
            ? listing.entries
                .map(
                  (entry) => `${entry.isDir ? "dir " : "    "} ${entry.name}`,
                )
                .join("\n")
            : `(empty) ${listing.basePath}`;
          append("output", text, listing);
          if (listing.entries.length) {
            append(
              "system",
              "Double-click a file to open · double-click a folder to enter",
            );
          }
        } catch (error) {
          append("error", normalizeError(error).message);
        }
        break;
      case "error":
        append("error", command.message);
        break;
    }
  };

  const handleRequest = useEffectEvent(
    (nextRequest: { command: string; code?: string }) => {
      const normalized =
        nextRequest.command
          .trim()
          .replace(/^\//, "")
          .split(/\s+/)[0]
          ?.toLowerCase() ?? "";
      if (
        normalized === "build" ||
        normalized === "check" ||
        normalized === "run" ||
        normalized === "runtime"
      ) {
        void runPython(
          normalized === "build" || normalized === "check" ? "build" : "run",
          nextRequest.code,
        );
        return;
      }
      const parsed = parseTerminalCommand(nextRequest.command);
      if (
        (parsed.kind === "run" || parsed.kind === "build") &&
        nextRequest.code != null
      ) {
        void runPython(parsed.kind, nextRequest.code);
        return;
      }
      void executeCommand(parsed);
    },
  );

  useEffect(() => {
    if (!request) return;
    const timer = window.setTimeout(() => handleRequest(request), 0);
    return () => window.clearTimeout(timer);
  }, [request]);

  useEffect(() => {
    if (!notice?.text) return;
    append("system", notice.text);
    // notice.id is the trigger; append is stable enough for this panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice?.id]);

  useEffect(() => {
    if (nanoPrompt === "save-exit" && nanoAnnounced.current !== "save-exit") {
      nanoAnnounced.current = "save-exit";
      append("system", "Save modified buffer? (Y)es (N)o (C)ancel");
      inputRef.current?.focus();
    }
    if (nanoPrompt === "note-title" && nanoAnnounced.current !== "note-title") {
      nanoAnnounced.current = "note-title";
      inputRef.current?.focus();
    }
    if (nanoPrompt == null) {
      nanoAnnounced.current = null;
    }
  }, [nanoPrompt]);

  const cliSeedRef = useRef(cliSeed);
  const onCliSeedConsumedRef = useRef(onCliSeedConsumed);
  cliSeedRef.current = cliSeed;
  onCliSeedConsumedRef.current = onCliSeedConsumed;

  useEffect(() => {
    if (focusToken <= 0) return;
    inputRef.current?.focus();
    const seed = cliSeedRef.current;
    // Only run on focusToken bumps. Depending on cliSeed/callbacks re-focused
    // the CLI on every editor keystroke after the first character.
    if (seed != null && seed !== "") {
      setInput(seed);
      onCliSeedConsumedRef.current?.();
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        const pos = el.value.length;
        el.setSelectionRange(pos, pos);
      });
    }
  }, [focusToken]);

  const submitNano = (raw: string) => {
    const choice = raw.trim().toLowerCase();
    if (choice === "y" || choice === "yes") {
      onNanoChoice("y");
      return;
    }
    if (choice === "n" || choice === "no") {
      onNanoChoice("n");
      return;
    }
    if (choice === "c" || choice === "cancel" || choice === "") {
      onNanoChoice("c");
      return;
    }
    append("error", "Please answer Y, N, or C.");
  };

  const submitNoteTitle = async (raw: string) => {
    const title = raw.trim() || "Untitled";
    try {
      append("system", await handlers.createNote(title));
    } catch (error) {
      append("error", normalizeError(error).message);
    }
  };

  const submit = () => {
    const value = input.trim();
    if (running) return;
    if (nanoPrompt === "save-exit") {
      append("command", value || "(empty)");
      setInput("");
      submitNano(value);
      return;
    }
    if (nanoPrompt === "note-title") {
      append("command", value || "Untitled");
      setInput("");
      void submitNoteTitle(value);
      return;
    }
    if (!value) return;
    append("command", `${shellPrompt(shellMode, cwd)} ${value}`);
    setHistory((current) => [
      value,
      ...current.filter((item) => item !== value),
    ]);
    setHistoryIndex(-1);
    setInput("");
    const parsed = parseTerminalCommand(value);
    if (isSystemPythonCommand(value)) {
      void runLocalCommand(hostShell(), value, { retainShellMode: true });
      return;
    }
    if (
      parsed.kind === "error" &&
      parsed.message.startsWith("Unknown command:") &&
      shellMode !== "python"
    ) {
      void runLocalCommand(shellMode, value);
    } else {
      void executeCommand(parsed);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (nanoPrompt === "save-exit" || nanoPrompt === "note-title") {
        onNanoChoice("c");
        return;
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "ArrowUp" && history.length && !nanoPrompt) {
      event.preventDefault();
      const nextIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
    } else if (event.key === "ArrowDown" && !nanoPrompt) {
      event.preventDefault();
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setInput(nextIndex >= 0 ? (history[nextIndex] ?? "") : "");
    }
  };

  const visibleLines =
    variant === "editing" ? lines.slice(-24) : lines.slice(-120);
  const appearanceTheme = appearance.theme;
  const ptyDark = appearanceTheme !== "light";

  return (
    <section
      className={
        variant === "editing"
          ? `cli-strip${ptyJob ? " has-pty" : ""}`
          : `cli-full${ptyJob ? " has-pty" : ""}`
      }
      aria-label="ScratchCLI"
      data-shell={shellMode}
      onMouseDown={(event) => {
        if (ptyJob || running) return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        // Keep native behavior for the field, buttons, and links.
        if (target.closest("input, textarea, button, a, .xterm")) return;
        // Focus the prompt so a click anywhere starts typing.
        inputRef.current?.focus({ preventScroll: true });
      }}
      onClick={(event) => {
        if (ptyJob || running) return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest("input, textarea, button, a, .xterm")) return;
        const selection = window.getSelection();
        if (
          selection &&
          !selection.isCollapsed &&
          event.currentTarget.contains(selection.anchorNode)
        ) {
          return;
        }
        inputRef.current?.focus({ preventScroll: true });
      }}
    >
      {ptyJob ? (
        <div className="pty-session">
          <div className="agent-session-chip" role="status">
            <span>
              {/^\s*(claude|codex)\b/i.test(ptyJob.command)
                ? `Agent · ${ptyJob.command.trim().split(/\s+/)[0]}`
                : "Interactive session"}
            </span>
            <button
              type="button"
              className="agent-exit-btn"
              title="Return to ScratchCLI (Ctrl+Shift+Q)"
              onClick={() => ptyRef.current?.exitToCli()}
            >
              Exit to CLI
            </button>
          </div>
          <InteractivePty
            ref={ptyRef}
            key={ptyJob.key}
            shell={ptyJob.shell}
            command={ptyJob.command}
            cwd={cwd || undefined}
            dark={ptyDark}
            onExit={(code) => {
              setPtyJob(null);
              setRunning(false);
              append(
                "system",
                code == null
                  ? "Back to ScratchCLI."
                  : `Interactive session exited with ${code}. Back to ScratchCLI.`,
              );
            }}
            onError={(message) => {
              setPtyJob(null);
              setRunning(false);
              append("error", message);
              append("system", "Back to ScratchCLI.");
            }}
          />
        </div>
      ) : (
        <>
          <div className="cli-output" ref={outputRef} aria-live="polite">
            {visibleLines.map((line) =>
              line.kind === "brand" ? (
                <CliBrandBanner key={line.id} />
              ) : line.fontListing ? (
                <div
                  key={line.id}
                  className="cli-listing cli-font-listing"
                  data-kind={line.kind}
                >
                  <button
                    type="button"
                    className="cli-listing-row"
                    data-clear="true"
                    title="Reset to default font"
                    onClick={() => clearFont()}
                  >
                    <span className="cli-listing-kind">clr </span>
                    <span className="cli-listing-name">clear (default)</span>
                  </button>
                  {line.fontListing.fonts.map((font) => {
                    const active = font.value === line.fontListing!.activeValue;
                    return (
                      <button
                        key={`${font.source}-${font.family}-${font.value}`}
                        type="button"
                        className="cli-listing-row"
                        data-active={active ? "true" : "false"}
                        title={`Apply ${font.label}`}
                        style={{ fontFamily: font.value }}
                        onClick={() => applyFont(font.label)}
                      >
                        <span className="cli-listing-kind">
                          {active ? " *  " : "    "}
                        </span>
                        <span className="cli-listing-name">
                          {font.label}
                          <span className="cli-font-source">
                            {" "}
                            ({font.source})
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : line.listing ? (
                <div
                  key={line.id}
                  className="cli-listing"
                  data-kind={line.kind}
                  title={line.listing.basePath}
                >
                  {line.listing.entries.length === 0 ? (
                    <pre data-kind={line.kind}>{line.text}</pre>
                  ) : (
                    line.listing.entries.map((entry) => (
                      <button
                        key={entry.path}
                        type="button"
                        className="cli-listing-row"
                        data-dir={entry.isDir ? "true" : "false"}
                        title={
                          entry.isDir
                            ? `Double-click to open folder ${entry.name}`
                            : `Double-click to open ${entry.name}`
                        }
                        onDoubleClick={() => void openListingEntry(entry)}
                      >
                        <span className="cli-listing-kind">
                          {entry.isDir ? "dir " : "    "}
                        </span>
                        <span className="cli-listing-name">{entry.name}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <pre key={line.id} data-kind={line.kind}>
                  {line.text}
                </pre>
              ),
            )}
          </div>
          <div className="cli-input">
            <span className="cli-prompt" aria-hidden="true">
              {nanoPrompt === "save-exit"
                ? "?"
                : nanoPrompt === "note-title"
                  ? "title>"
                  : shellPrompt(shellMode, cwd)}
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={running}
              spellCheck={false}
              autoComplete="off"
              aria-label="CLI command"
              placeholder={
                nanoPrompt === "save-exit"
                  ? "Y / N / C"
                  : nanoPrompt === "note-title"
                    ? "Type a note title, then Enter"
                    : running
                      ? "Running..."
                      : 'Type a command or "help"'
              }
            />
          </div>
        </>
      )}
    </section>
  );
}
