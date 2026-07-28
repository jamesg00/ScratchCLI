import {
  useCallback,
  useEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  Suspense,
  type CSSProperties,
} from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ErrorBanner } from "../components/common/ErrorBanner";
import {
  type EditorActions,
  type EditorCommand,
} from "../components/editor/NoteEditor";
import { SplitWorkspace } from "../components/editor/SplitWorkspace";
import { TabBar } from "../components/editor/TabBar";
import { TabDragController } from "../components/editor/TabDragController";
import { StickyHeader } from "../components/menu/StickyHeader";
import { AppearanceDialog } from "../components/settings/AppearanceDialog";
import { AiSettingsDialog } from "../components/settings/AiSettingsDialog";
import { GrokSplitSash } from "../components/assistant/GrokSplitSash";
import type { VizKind } from "../components/assistant/vizPlan";
import { MatrixRain } from "../components/theme/MatrixRain";
import {
  TerminalPanel,
  type CliHandlers,
} from "../components/terminal/TerminalPanel";
import { CliFrame } from "../components/terminal/CliFrame";
import { helpText } from "../components/terminal/commands";
import {
  CommandPalette,
  type PaletteItem,
} from "../components/palette/CommandPalette";
import { DeveloperCockpitWelcome } from "../components/onboarding/DeveloperCockpitWelcome";
import { NotesLibraryDialog } from "../components/notes/NotesLibraryDialog";
import { TestStrip } from "../components/practice/TestStrip";
import {
  parseTestOutput,
  type TestRunSummary,
} from "../components/practice/parseTestOutput";
import { getSnippet, listSnippets } from "../snippets/catalog";
import {
  SYSTEM_FONTS,
  workspaceFontOption,
  type FontOption,
} from "../fonts/catalog";
import { ensureWebFontsLoaded } from "../fonts/availability";
import { useAutosave } from "../hooks/useAutosave";
import { quitApp } from "../services/appLifecycle";
import { fileService, languageFromPath } from "../services/files";
import { noteService } from "../services/notes";
import { executePython } from "../services/python";
import { exportTodayPractice } from "../services/exportPractice";
import {
  useAppearanceStore,
  hydrateGrokApiKeyFromSecrets,
} from "../stores/appearanceStore";
import { useNoteStore } from "../stores/noteStore";
import { useSessionStore } from "../stores/sessionStore";
import { useStudyStore } from "../stores/studyStore";
import {
  useInterviewStore,
  type InterviewDifficulty,
} from "../stores/interviewStore";
import { scaledFontSize } from "../utils/scaledFontSize";
import { normalizeError } from "../types/error";
import { VIZ_KIND_LABELS, VIZ_KINDS } from "../components/assistant/vizPrompt";
import { localPracticeScaffold } from "../components/assistant/localPractice";
import { fetchAndBuildLcPractice } from "../components/assistant/leetcodeFlow";
import { extractLcSlug, useLeetCodeStore } from "../stores/leetcodeStore";
import { commandDefinition } from "../commands/registry";
import {
  loadWorkspaceConfig,
  type WorkspaceConfig,
} from "../services/workspaceConfig";

const GrokHelperPanel = lazy(() =>
  import("../components/assistant/GrokHelperPanel").then((module) => ({
    default: module.GrokHelperPanel,
  })),
);
const AssistantPanel = lazy(() =>
  import("../components/assistant/AssistantPanel").then((module) => ({
    default: module.AssistantPanel,
  })),
);
const VisualizeDialog = lazy(() =>
  import("../components/assistant/VisualizeDialog").then((module) => ({
    default: module.VisualizeDialog,
  })),
);
const StudyBoardDialog = lazy(() =>
  import("../components/study/StudyBoardDialog").then((module) => ({
    default: module.StudyBoardDialog,
  })),
);

function injectWorkspaceFonts(fonts: { family: string; path: string }[]): void {
  const styleId = "scratchcli-workspace-fonts";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = fonts
    .map((font) => {
      const url = convertFileSrc(font.path);
      const format = font.path.toLowerCase().endsWith(".woff2")
        ? "woff2"
        : font.path.toLowerCase().endsWith(".otf")
          ? "opentype"
          : "truetype";
      return `@font-face{font-family:"${font.family}";src:url("${url}") format("${format}");font-display:swap;}`;
    })
    .join("\n");
}

export function App() {
  const {
    saveStatus,
    error,
    loadNotes,
    createNote,
    selectNote,
    patchActive,
    saveActive,
    archiveActive,
    clearError,
  } = useNoteStore();
  const notes = useNoteStore((state) => state.notes);
  const appearance = useAppearanceStore();
  const session = useSessionStore();
  const editorActions = useRef<EditorActions | null>(null);
  const [terminalRequest, setTerminalRequest] = useState<{
    id: number;
    command: string;
    code?: string;
  } | null>(null);
  const [cliNotice, setCliNotice] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const requestId = useRef(0);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [grokOpen, setGrokOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [visualizeOpen, setVisualizeOpen] = useState(false);
  const [vizInitialKind, setVizInitialKind] = useState<VizKind | undefined>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(
    () => localStorage.getItem("scratchcli-welcome-dismissed") !== "true",
  );
  const [testSummary, setTestSummary] = useState<TestRunSummary | null>(null);
  const [interviewTick, setInterviewTick] = useState(0);
  const [cwdFiles, setCwdFiles] = useState<string[]>([]);
  const [fontCatalog, setFontCatalog] = useState<FontOption[]>(SYSTEM_FONTS);
  const [workspaceConfig, setWorkspaceConfig] =
    useState<WorkspaceConfig | null>(null);
  const fontCatalogRef = useRef(fontCatalog);

  useEffect(() => {
    fontCatalogRef.current = fontCatalog;
  }, [fontCatalog]);

  useEffect(() => {
    let cancelled = false;
    void loadWorkspaceConfig(session.cwd)
      .then((config) => {
        if (cancelled) return;
        setWorkspaceConfig(config);
        if (config?.preferredShell) {
          useSessionStore.getState().setShellMode(config.preferredShell);
        }
      })
      .catch(() => {
        if (!cancelled) setWorkspaceConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session.cwd]);

  useEffect(() => {
    void (async () => {
      try {
        await loadNotes();
      } catch {
        /* store handles */
      }
      try {
        if (!useSessionStore.getState().cwd) {
          useSessionStore.getState().setCwd(await fileService.defaultCwd());
        }
      } catch {
        useSessionStore.getState().setCwd("");
      }

      await ensureWebFontsLoaded(SYSTEM_FONTS);
      await hydrateGrokApiKeyFromSecrets();

      // Always keep the full curated catalog (web + system); never drop web faces.
      let nextFonts: FontOption[] = [...SYSTEM_FONTS];
      try {
        const userFonts = await fileService.listUserFonts();
        injectWorkspaceFonts(userFonts);
        nextFonts = [
          ...SYSTEM_FONTS,
          ...userFonts.map((font) => workspaceFontOption(font.family)),
        ];
      } catch {
        /* keep curated catalog */
      }
      setFontCatalog(nextFonts);

      const current = useAppearanceStore.getState().fontFamily;
      if (!nextFonts.some((font) => font.value === current)) {
        const match =
          nextFonts.find((font) => current.includes(font.family)) ??
          nextFonts[0];
        if (match) useAppearanceStore.getState().setFontFamily(match.value);
      }
    })();
  }, [loadNotes]);

  useAutosave(
    session.viewMode === "editing" && session.documentKind === "note"
      ? saveStatus
      : "idle",
    saveActive,
  );

  const registerEditorActions = useCallback((actions: EditorActions) => {
    editorActions.current = actions;
  }, []);

  const executeEditorCommand = useCallback(
    (command: EditorCommand, payload?: string) => {
      editorActions.current?.execute(command, payload);
    },
    [],
  );

  const sendTerminalCommand = useCallback((command: string, code?: string) => {
    setTerminalRequest({ id: ++requestId.current, command, code });
  }, []);

  const editing = session.viewMode === "editing";
  const effectiveCliDock =
    grokOpen || assistantOpen ? "bottom" : session.cliDock;

  const openCoach = useCallback(() => {
    setAssistantOpen(false);
    setGrokOpen(true);
  }, []);

  const openAssistant = useCallback(() => {
    setGrokOpen(false);
    setAssistantOpen(true);
  }, []);

  const sidePaneOpen = grokOpen || assistantOpen;
  const activeTab =
    session.tabs.find((tab) => tab.id === session.activeTabId) ?? null;
  const bufferContent = activeTab?.content ?? "";
  const bufferLanguage = activeTab?.language ?? "python";
  const isDirty = useCallback(() => {
    const tab = useSessionStore.getState().getActiveTab();
    return Boolean(tab?.dirty);
  }, []);

  const closeTabSafely = useCallback((id: string) => {
    const tab = useSessionStore.getState().tabs.find((item) => item.id === id);
    if (
      tab?.dirty &&
      !window.confirm(`Close "${tab.title}" and discard its unsaved changes?`)
    ) {
      return;
    }
    useSessionStore.getState().closeTab(id);
  }, []);

  const quittingRef = useRef(false);

  /** Confirm unsaved work, then hard-quit (keeps tabs for Resume on next launch). */
  const requestQuit = useCallback(async () => {
    if (quittingRef.current) return;
    const dirty = useSessionStore.getState().tabs.filter((tab) => tab.dirty);
    if (dirty.length > 0) {
      const ok = window.confirm(
        `Quit ScratchCLI with ${dirty.length} unsaved ${
          dirty.length === 1 ? "tab" : "tabs"
        }?\n\nYour tabs stay saved for Resume editor next time.`,
      );
      if (!ok) return;
    }
    quittingRef.current = true;
    try {
      await quitApp();
    } catch {
      // Fallback if the command is unavailable: force-destroy the window.
      try {
        await getCurrentWindow().destroy();
      } catch {
        await getCurrentWindow().close();
        quittingRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      // Always intercept. After onCloseRequested, Tauri calls destroy() — which
      // previously failed without allow-destroy and left the process hung.
      // Own the quit path instead (confirm → quit_app → process exit).
      event.preventDefault();
      await requestQuit();
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [requestQuit]);

  /** New or modified buffer — Escape / Ctrl+X should prompt to save. */
  const needsSavePrompt = useCallback(() => {
    const tab = useSessionStore.getState().getActiveTab();
    if (!tab) return false;
    return Boolean(tab.dirty || tab.isNew);
  }, []);

  const statusTitle = activeTab?.path ?? activeTab?.title ?? "ScratchCLI";

  const runPracticeTests = useCallback(async () => {
    try {
      const result = await executePython(
        bufferContent,
        "run",
        useSessionStore.getState().cwd || null,
      );
      const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      const summary = parseTestOutput(combined);
      setTestSummary(summary);
      if (summary) {
        useStudyStore.getState().recordPractice({
          title: statusTitle,
          path: activeTab?.path,
          passed: summary.total > 0 && summary.passed === summary.total,
        });
      }
      sendTerminalCommand("run", bufferContent);
    } catch (error) {
      setTestSummary({
        passed: 0,
        total: 0,
        cases: [],
        raw: normalizeError(error).message,
      });
    }
  }, [activeTab?.path, bufferContent, sendTerminalCommand, statusTitle]);

  const saveDocument = useCallback(async () => {
    const tab = useSessionStore.getState().getActiveTab();
    if (!tab) throw new Error("No active tab to save.");
    if (tab.kind === "file" && tab.path) {
      const saved = await fileService.writeTextFile(tab.path, tab.content);
      useSessionStore.getState().markActiveSaved(saved.path);
      return `Saved ${saved.path}`;
    }
    if (tab.kind === "note" && tab.noteId) {
      await selectNote(tab.noteId);
      patchActive({
        title: tab.title,
        content: tab.content,
        language: tab.language,
      });
      useNoteStore.setState({ saveStatus: "dirty" });
      await saveActive();
      if (useNoteStore.getState().saveStatus === "error") {
        throw new Error(
          useNoteStore.getState().error?.message ?? "Save failed.",
        );
      }
      useSessionStore.getState().markActiveSaved();
      return `Saved note ${tab.title || tab.noteId}`;
    }
    // Untitled note tab — create then save
    await createNote();
    const created = useNoteStore.getState().activeNote;
    if (!created) throw new Error("Could not create note.");
    patchActive({
      title: tab.title,
      content: tab.content,
      language: tab.language,
    });
    useNoteStore.setState({ saveStatus: "dirty" });
    await saveActive();
    useSessionStore.getState().patchTab(tab.id, {
      noteId: created.id,
      dirty: false,
      title: tab.title || created.title,
    });
    return `Saved note ${tab.title || created.id}`;
  }, [createNote, patchActive, saveActive, selectNote]);

  const createPracticeFile = useCallback(
    async (file: { content: string; fileName: string }) => {
      const cwd =
        useSessionStore.getState().cwd || (await fileService.defaultCwd());
      let base = file.fileName.replace(/[^\w.-]+/g, "_");
      if (!base.toLowerCase().endsWith(".py")) base = `${base}.py`;
      const stem = base.replace(/\.py$/i, "");
      let attempt = 0;
      let path = await fileService.resolvePath(cwd, base);
      while (attempt < 40) {
        try {
          await fileService.readTextFile(path);
          attempt += 1;
          path = await fileService.resolvePath(cwd, `${stem}_${attempt}.py`);
        } catch {
          break;
        }
      }
      const written = await fileService.writeTextFile(path, file.content);
      useSessionStore.getState().openFileDocument({
        path: written.path,
        content: written.content,
        language: "python",
        isNew: true,
      });
      useSessionStore.getState().setShellMode("python");
      useStudyStore.getState().recordPractice({
        title: file.fileName,
        path: written.path,
      });
      return written.path;
    },
    [],
  );

  const startInterview = useCallback(
    async (difficulty: InterviewDifficulty, minutes = 25) => {
      useInterviewStore.getState().start(difficulty, minutes);
      const scaffold = localPracticeScaffold(difficulty);
      const hasKey = Boolean(useAppearanceStore.getState().grokApiKey?.trim());
      await createPracticeFile({
        content: scaffold.content,
        fileName: scaffold.fileName,
      });
      if (hasKey) {
        openCoach();
      }
    },
    [createPracticeFile, openCoach],
  );

  const discardActiveNote = useCallback(async () => {
    const tab = useSessionStore.getState().getActiveTab();
    if (!tab?.noteId) return;
    const note = await noteService.get(tab.noteId);
    useSessionStore.getState().patchTab(tab.id, {
      content: note.content,
      title: note.title,
      language: note.language,
      dirty: false,
    });
  }, []);

  const closeEditor = useCallback(
    async (opts?: { discard?: boolean }) => {
      if (!opts?.discard && needsSavePrompt()) {
        session.requestNanoExit();
        return;
      }
      if (opts?.discard) {
        await discardActiveNote();
      }
      session.leaveEditor();
      const tabs = useSessionStore.getState().tabs.length;
      return tabs
        ? `Back to CLI. ${tabs} tab(s) kept — type resume to return.`
        : "Back to CLI.";
    },
    [discardActiveNote, needsSavePrompt, session],
  );

  const handleNanoChoice = useCallback(
    async (choice: "y" | "n" | "c") => {
      if (choice === "c") {
        session.clearNanoPrompt();
        return;
      }
      try {
        if (choice === "y") {
          await saveDocument();
        } else {
          await discardActiveNote();
        }
        session.leaveEditor();
      } catch {
        session.clearNanoPrompt();
      }
    },
    [discardActiveNote, saveDocument, session],
  );

  const handleNanoExit = useCallback(() => {
    if (!editing) return;
    // Already asking Y/N/C — don't toggle/cancel here (Escape handles cancel).
    if (useSessionStore.getState().nanoPrompt) return;
    if (needsSavePrompt()) {
      session.requestNanoExit();
    } else {
      session.leaveEditor();
    }
  }, [editing, needsSavePrompt, session]);

  const cliHandlers: CliHandlers = useMemo(
    () => ({
      listNotes: async () => {
        const items = useNoteStore.getState().notes;
        if (!items.length) return "(no notes — type new to create one)";
        return items
          .map(
            (note) =>
              `${note.id.slice(0, 8)}  ${note.title || "(untitled)"}  [${note.updatedAt.slice(0, 10)}]`,
          )
          .join("\n");
      },
      openNote: async (query) => {
        const q = query.trim().toLowerCase();
        const items = useNoteStore.getState().notes;
        const match =
          items.find((note) => note.id.toLowerCase() === q) ??
          items.find((note) => note.id.toLowerCase().startsWith(q)) ??
          items.find((note) => note.title.toLowerCase() === q) ??
          items.find((note) => note.title.toLowerCase().includes(q));
        if (!match) throw new Error(`Note not found: ${query}`);
        const note = await noteService.get(match.id);
        await selectNote(note.id);
        useSessionStore.getState().openNoteDocument({
          id: note.id,
          title: note.title,
          content: note.content,
          language: note.language,
          color: note.color,
        });
        return `Opened note ${note.title || note.id}`;
      },
      openFile: async (path) => {
        const cwd = useSessionStore.getState().cwd;
        const resolved = await fileService.resolvePath(cwd, path);
        const file = await fileService.readTextFile(resolved);
        useSessionStore.getState().openFileDocument({
          path: file.path,
          content: file.content,
          language: languageFromPath(file.path),
        });
        return `Opened ${file.path}`;
      },
      lookNote: async (query) => {
        const q = query.trim().toLowerCase();
        const items = useNoteStore.getState().notes;
        const match =
          items.find((note) => note.id.toLowerCase() === q) ??
          items.find((note) => note.id.toLowerCase().startsWith(q)) ??
          items.find((note) => note.title.toLowerCase() === q) ??
          items.find((note) => note.title.toLowerCase().includes(q));
        if (!match) throw new Error(`Note not found: ${query}`);
        const note = await noteService.get(match.id);
        return `--- ${note.title || note.id} ---\n${note.content || "(empty note)"}`;
      },
      lookFile: async (path) => {
        const cwd = useSessionStore.getState().cwd;
        const resolved = await fileService.resolvePath(cwd, path);
        const file = await fileService.readTextFile(resolved);
        return `--- ${file.path} ---\n${file.content || "(empty file)"}`;
      },
      removeNote: async (query) => {
        const q = query.trim().toLowerCase();
        const state = useSessionStore.getState();
        const items = useNoteStore.getState().notes;
        const match =
          items.find((note) => note.id.toLowerCase() === q) ??
          items.find((note) => note.id.toLowerCase().startsWith(q)) ??
          items.find((note) => note.title.toLowerCase() === q) ??
          items.find((note) => note.title.toLowerCase().includes(q));
        if (!match) throw new Error(`Note not found: ${query}`);
        await noteService.remove(match.id);
        for (const tab of state.tabs.filter((tab) => tab.noteId === match.id)) {
          state.closeTab(tab.id);
        }
        await useNoteStore.getState().loadNotes();
        return `Removed note ${match.title || match.id}`;
      },
      removePath: async (path) => {
        const state = useSessionStore.getState();
        const resolved = await fileService.resolvePath(state.cwd, path);
        for (const tab of state.tabs.filter(
          (tab) => tab.path?.toLowerCase() === resolved.toLowerCase(),
        )) {
          state.closeTab(tab.id);
        }
        const result = await fileService.removePath(resolved);
        return `Removed ${result.kind} ${result.path}`;
      },
      mkdir: async (path) => {
        const cwd = useSessionStore.getState().cwd;
        const resolved = await fileService.resolvePath(cwd, path);
        const created = await fileService.createDirectory(resolved);
        return `Created directory ${created}`;
      },
      touch: async (path) => {
        const cwd = useSessionStore.getState().cwd;
        const resolved = await fileService.resolvePath(cwd, path);
        const created = await fileService.createFile(resolved);
        useSessionStore.getState().openFileDocument({
          path: created,
          content: "",
          language: languageFromPath(created),
          isNew: true,
        });
        return `Created file ${created}`;
      },
      touchNote: async (title) => {
        if (!title) {
          useSessionStore.getState().requestNoteTitle();
          return "Note title:";
        }
        await createNote();
        const note = useNoteStore.getState().activeNote;
        if (!note) throw new Error("Could not create note.");
        patchActive({ title });
        useSessionStore.getState().clearNanoPrompt();
        useSessionStore.getState().openNoteDocument({
          id: note.id,
          title,
          content: note.content,
          language: note.language,
          color: note.color,
        });
        return `Created note "${title}"`;
      },
      splitView: async (count) => {
        const state = useSessionStore.getState();
        if (!state.tabs.length) {
          throw new Error("Open a tab first, then split.");
        }
        if (count) {
          state.setSplitCount(count);
          return `Split view set to ${count} pane${count === 1 ? "" : "s"}.`;
        }
        const next = ((state.splitCount % 4) + 1) as 1 | 2 | 3 | 4;
        state.setSplitCount(next);
        return `Split view set to ${next} pane${next === 1 ? "" : "s"}.`;
      },
      listTabs: async () => {
        const { tabs, activeTabId, splitCount } = useSessionStore.getState();
        if (!tabs.length) return "(no open tabs)";
        return (
          tabs
            .map(
              (tab, index) =>
                `${tab.id === activeTabId ? "*" : " "} ${index + 1}. ${tab.dirty ? "•" : " "}${tab.title} [${tab.kind}]`,
            )
            .join("\n") + `\n(split ${splitCount})`
        );
      },
      newTab: async () => {
        await createNote();
        const note = useNoteStore.getState().activeNote;
        if (!note) throw new Error("Could not create note tab.");
        useSessionStore.getState().openNoteDocument({
          id: note.id,
          title: note.title,
          content: note.content,
          language: note.language,
          color: note.color,
        });
        return `Opened new tab ${note.title || note.id}`;
      },
      cloneTab: async () => {
        const state = useSessionStore.getState();
        if (!state.getActiveTab()) {
          throw new Error("Open a note or file first, then clone.");
        }
        const id = state.cloneActiveTab();
        const tab = useSessionStore
          .getState()
          .tabs.find((item) => item.id === id);
        return `Cloned into tab "${tab?.title ?? "copy"}"`;
      },
      closeTab: async (query) => {
        const state = useSessionStore.getState();
        if (!state.tabs.length) return "No tabs open.";
        if (!query) {
          if (!state.activeTabId) return "No active tab.";
          state.closeTab(state.activeTabId);
          return "Closed active tab.";
        }
        const q = query.toLowerCase();
        const match =
          state.tabs.find((tab) => tab.title.toLowerCase() === q) ??
          state.tabs.find((tab) => tab.title.toLowerCase().includes(q)) ??
          state.tabs.find((tab) => tab.id.startsWith(q));
        if (!match) throw new Error(`Tab not found: ${query}`);
        state.closeTab(match.id);
        return `Closed tab ${match.title}`;
      },
      createNote: async (title) => {
        if (!title) {
          useSessionStore.getState().requestNoteTitle();
          return "Note title:";
        }
        await createNote();
        const note = useNoteStore.getState().activeNote;
        if (!note) throw new Error("Could not create note.");
        patchActive({ title });
        useSessionStore.getState().clearNanoPrompt();
        useSessionStore.getState().openNoteDocument({
          id: note.id,
          title,
          content: note.content,
          language: note.language,
          color: note.color,
        });
        return `Created note "${title}"`;
      },
      saveDocument,
      closeEditor,
      requestSaveExit: () => session.requestNanoExit(),
      requestNoteTitle: () => session.requestNoteTitle(),
      setLanguage: (language) => {
        useSessionStore.getState().patchActiveTab({ language });
      },
      changeCwd: async (path) => {
        const cwd = useSessionStore.getState().cwd;
        const resolved = await fileService.resolvePath(cwd, path);
        await fileService.listDirectory(resolved);
        useSessionStore.getState().setCwd(resolved);
        return `cwd ${resolved}`;
      },
      listDirectory: async (path) => {
        const cwd = useSessionStore.getState().cwd;
        const target = path ? await fileService.resolvePath(cwd, path) : cwd;
        const entries = await fileService.listDirectory(target);
        return { basePath: target, entries };
      },
      getBuffer: () => {
        const tab = useSessionStore.getState().getActiveTab();
        return {
          code: tab?.content ?? "",
          language: tab?.language ?? "python",
        };
      },
      isDirty,
      onShellModeChange: session.setShellMode,
      onFontsChanged: (fonts) => {
        const byFamily = new Map<string, FontOption>();
        for (const font of [...SYSTEM_FONTS, ...fonts]) {
          byFamily.set(`${font.source}:${font.family}`, font);
        }
        setFontCatalog([...byFamily.values()]);
        void fileService
          .listUserFonts()
          .then(injectWorkspaceFonts)
          .catch(() => undefined);
      },
      getFontCatalog: () => fontCatalogRef.current,
      openGrok: () => openCoach(),
      openAssistant: () => openAssistant(),
      openAiSettings: () => setAiSettingsOpen(true),
      launchAgent: async (name) => {
        const { whichCommand } = await import("../services/chat");
        const found = await whichCommand(name);
        if (!found) {
          throw new Error(
            `${name} was not found on PATH. Install the CLI, then try again.`,
          );
        }
        return found;
      },
      resumeEditor: () => useSessionStore.getState().resumeEditor(),
      insertSnippet: async (id) => {
        if (!id || id === "list" || id === "ls" || id === "?") {
          return listSnippets()
            .map((s) => `${s.id}  ${s.label}  [${s.tags.join(", ")}]`)
            .join("\n");
        }
        const snip = getSnippet(id);
        if (!snip) {
          throw new Error(`Unknown snippet "${id}". Try: snip list`);
        }
        executeEditorCommand("insert", snip.body);
        return `Inserted snippet ${snip.id}`;
      },
    }),
    [
      closeEditor,
      createNote,
      executeEditorCommand,
      isDirty,
      openAssistant,
      openCoach,
      patchActive,
      saveDocument,
      selectNote,
      session,
    ],
  );

  const handleSlashCommand = useCallback(
    (command: string, content: string) => {
      const normalized =
        command.trim().replace(/^\//, "").split(/\s+/)[0]?.toLowerCase() ?? "";
      if (
        normalized === "run" ||
        normalized === "runtime" ||
        normalized === "build" ||
        normalized === "check"
      ) {
        sendTerminalCommand(
          normalized === "check" || normalized === "build" ? "build" : "run",
          content,
        );
      } else if (normalized === "help" || normalized === "?") {
        setHelpOpen(true);
      } else if (
        normalized === "coach" ||
        normalized === "dsa" ||
        normalized === "grok"
      ) {
        openCoach();
      } else if (
        normalized === "assistant" ||
        normalized === "chat" ||
        normalized === "ai"
      ) {
        openAssistant();
      } else {
        sendTerminalCommand(command);
      }
    },
    [sendTerminalCommand, openCoach, openAssistant],
  );

  useEffect(() => {
    if (!paletteOpen) return;
    void (async () => {
      try {
        const cwd =
          useSessionStore.getState().cwd || (await fileService.defaultCwd());
        const entries = await fileService.listDirectory(cwd);
        setCwdFiles(
          entries
            .filter((e) => !e.isDir)
            .map((e) => e.name)
            .slice(0, 40),
        );
      } catch {
        setCwdFiles([]);
      }
    })();
  }, [paletteOpen]);

  const openVisualize = useCallback((kind?: VizKind) => {
    setVizInitialKind(kind);
    setVisualizeOpen(true);
  }, []);

  const paletteItems = useMemo((): PaletteItem[] => {
    const metadata = (id: string) => {
      const definition = commandDefinition(id);
      return definition
        ? {
            description: definition.description,
            shortcut: definition.shortcut,
            safety: definition.safety,
          }
        : {};
    };
    const items: PaletteItem[] = [
      {
        id: "execution.run",
        label: "Run buffer",
        section: "Commands",
        keywords: "python execute",
        ...metadata("execution.run"),
        run: () => sendTerminalCommand("run", bufferContent),
      },
      {
        id: "execution.build",
        label: "Build buffer",
        section: "Commands",
        keywords: "check compile",
        ...metadata("execution.build"),
        run: () => sendTerminalCommand("build", bufferContent),
      },
      {
        id: "document.save",
        label: "Save",
        section: "Commands",
        ...metadata("document.save"),
        run: () => void saveDocument().catch(() => undefined),
      },
      {
        id: "mode.cli",
        label: "Back to CLI",
        section: "Commands",
        keywords: "terminal shell nano leave close",
        ...metadata("mode.cli"),
        run: () => {
          if (useSessionStore.getState().viewMode === "editing") {
            handleNanoExit();
          } else {
            useSessionStore.getState().focusCli();
          }
        },
      },
      {
        id: "mode.editor",
        label: "Resume editor",
        section: "Commands",
        keywords: "note file nano edit tabs",
        ...metadata("mode.editor"),
        run: () => {
          if (!useSessionStore.getState().resumeEditor()) {
            useSessionStore.getState().focusCli("open ");
          }
        },
      },
      {
        id: "assistant.open",
        label: "Open Assistant",
        section: "Commands",
        keywords: "chat ai ollama lmstudio openai anthropic",
        ...metadata("assistant.open"),
        run: () => openAssistant(),
      },
      {
        id: "practice.open",
        label: "Open Practice workspace",
        section: "Commands",
        keywords: "assistant ai grok coach dsa",
        ...metadata("practice.open"),
        run: () => openCoach(),
      },
      {
        id: "agent.claude",
        label: "Launch Claude Code",
        section: "Execution",
        keywords: "cli agent terminal",
        ...metadata("agent.claude"),
        run: () => sendTerminalCommand("claude"),
      },
      {
        id: "agent.codex",
        label: "Launch Codex",
        section: "Execution",
        keywords: "cli agent openai terminal",
        ...metadata("agent.codex"),
        run: () => sendTerminalCommand("codex"),
      },
      {
        id: "viz",
        label: "Visualize",
        section: "Commands",
        keywords: "animation dsa",
        run: () => openVisualize(),
      },
      {
        id: "appearance.open",
        label: "Appearance",
        section: "Commands",
        keywords: "font color opacity theme",
        ...metadata("appearance.open"),
        run: () => setAppearanceOpen(true),
      },
      {
        id: "ai.settings",
        label: "AI keys",
        section: "Commands",
        keywords: "api key ollama openai anthropic grok env",
        ...metadata("ai.settings"),
        run: () => setAiSettingsOpen(true),
      },
      {
        id: "system.help",
        label: "Help",
        section: "Commands",
        ...metadata("system.help"),
        run: () => setHelpOpen(true),
      },
      {
        id: "symbol.toggle",
        label: "Toggle pretty symbols",
        section: "Commands",
        keywords: "pi != greek unicode",
        run: () => {
          const a = useAppearanceStore.getState();
          a.setPrettySymbols(!a.prettySymbols);
        },
      },
      {
        id: "test.run",
        label: "Run practice tests",
        section: "Commands",
        keywords: "pass fail strip",
        run: () => void runPracticeTests(),
      },
      {
        id: "study.board",
        label: "Study board",
        section: "Commands",
        keywords: "streak history",
        run: () => setStudyOpen(true),
      },
      {
        id: "documents.library",
        label: "Notes library",
        section: "Documents",
        keywords: "archive trash pin search",
        ...metadata("documents.library"),
        run: () => setNotesOpen(true),
      },
      {
        id: "export.today",
        label: "Export today's practice",
        section: "Commands",
        keywords: "zip pack",
        run: () => {
          void (async () => {
            const cwd =
              useSessionStore.getState().cwd ||
              (await fileService.defaultCwd());
            await exportTodayPractice(cwd, useStudyStore.getState().history);
          })().catch(() => undefined);
        },
      },
      {
        id: "interview.start",
        label: "Interview mode (25m medium)",
        section: "Commands",
        keywords: "timer practice",
        run: () => void startInterview("medium", 25),
      },
      {
        id: "interview.start.easy",
        label: "Interview mode · easy 25m",
        section: "Commands",
        run: () => void startInterview("easy", 25),
      },
      {
        id: "interview.start.hard",
        label: "Interview mode · hard 25m",
        section: "Commands",
        run: () => void startInterview("hard", 25),
      },
      {
        id: "interview.15",
        label: "Interview mode · 15m",
        section: "Commands",
        run: () => void startInterview("medium", 15),
      },
      {
        id: "interview.45",
        label: "Interview mode · 45m",
        section: "Commands",
        run: () => void startInterview("medium", 45),
      },
      {
        id: "interview.reveal",
        label: "Interview · Reveal hints",
        section: "Commands",
        run: () => useInterviewStore.getState().unlockReveal(),
      },
      {
        id: "interview.stop",
        label: "Interview · Stop",
        section: "Commands",
        run: () => useInterviewStore.getState().stop(),
      },
      {
        id: "practice.easy",
        label: "LeetCode · easy (Amazon OA)",
        section: "Commands",
        keywords: "leetcode oa amazon",
        run: () => {
          void (async () => {
            try {
              const result = await fetchAndBuildLcPractice({
                kind: "leetcode",
                mode: "easy",
              });
              await createPracticeFile(result.file);
            } catch {
              void createPracticeFile(localPracticeScaffold("easy"));
            }
          })();
        },
      },
      {
        id: "practice.medium",
        label: "LeetCode · medium (Amazon OA)",
        section: "Commands",
        keywords: "leetcode oa amazon",
        run: () => {
          void (async () => {
            try {
              const result = await fetchAndBuildLcPractice({
                kind: "leetcode",
                mode: "medium",
              });
              await createPracticeFile(result.file);
            } catch {
              void createPracticeFile(localPracticeScaffold("medium"));
            }
          })();
        },
      },
      {
        id: "practice.oa",
        label: "Amazon OA · next LeetCode",
        section: "Commands",
        keywords: "amazon oa leetcode next",
        run: () => {
          void (async () => {
            try {
              const result = await fetchAndBuildLcPractice({
                kind: "leetcode",
                mode: "oa",
              });
              await createPracticeFile(result.file);
            } catch {
              void createPracticeFile(localPracticeScaffold("medium"));
            }
          })();
        },
      },
      {
        id: "practice.done",
        label: "LeetCode · mark done",
        section: "Commands",
        keywords: "done complete finished",
        run: () => {
          const tab = useSessionStore.getState().getActiveTab();
          const buffer = tab?.content ?? "";
          const slug =
            extractLcSlug(buffer) ?? useLeetCodeStore.getState().lastSlug;
          if (slug) useLeetCodeStore.getState().markDone(slug);
        },
      },
      {
        id: "practice.hard",
        label: "Invent AI practice · hard",
        section: "Commands",
        keywords: "invent original grok",
        run: () => {
          void createPracticeFile(localPracticeScaffold("hard"));
        },
      },
    ];

    for (const snip of listSnippets()) {
      items.push({
        id: `snippet.${snip.id}`,
        label: `Insert: ${snip.label}`,
        section: "Snippets",
        keywords: snip.tags.join(" "),
        run: () => executeEditorCommand("insert", snip.body),
      });
    }

    for (const kind of VIZ_KINDS) {
      items.push({
        id: `viz.${kind}`,
        label: `Visualize: ${VIZ_KIND_LABELS[kind]}`,
        section: "Patterns",
        keywords: kind,
        run: () => openVisualize(kind),
      });
    }

    for (const note of notes.slice(0, 40)) {
      items.push({
        id: `note.${note.id}`,
        label: note.title || note.id.slice(0, 8),
        section: "Notes",
        keywords: note.id,
        run: () => void cliHandlers.openNote(note.id),
      });
    }

    for (const name of cwdFiles) {
      items.push({
        id: `file.${name}`,
        label: name,
        section: "Files",
        run: () => void cliHandlers.openFile(name).catch(() => undefined),
      });
    }

    return items;
  }, [
    bufferContent,
    cliHandlers,
    createPracticeFile,
    cwdFiles,
    executeEditorCommand,
    handleNanoExit,
    notes,
    openAssistant,
    openCoach,
    openVisualize,
    runPracticeTests,
    saveDocument,
    sendTerminalCommand,
    startInterview,
  ]);

  const interviewActive = useInterviewStore((s) => s.active);

  useEffect(() => {
    if (!interviewActive) return;
    const id = window.setInterval(() => setInterviewTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [interviewActive]);

  const interviewRemainingLabel = (() => {
    void interviewTick;
    const state = useInterviewStore.getState();
    if (!state.active || state.endsAt == null) return null;
    const ms = Math.max(0, state.endsAt - Date.now());
    const mins = Math.floor(ms / 60_000);
    const secs = Math.floor((ms % 60_000) / 1000);
    return {
      label: `${mins}:${secs.toString().padStart(2, "0")}`,
      locked: state.isHintLocked(),
      difficulty: state.difficulty,
    };
  })();

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const key = event.key;
      const mod = event.ctrlKey || event.metaKey;

      if (key === "Escape") {
        if (paletteOpen) {
          event.preventDefault();
          setPaletteOpen(false);
          return;
        }
        if (studyOpen) {
          event.preventDefault();
          setStudyOpen(false);
          return;
        }
        if (notesOpen) {
          event.preventDefault();
          setNotesOpen(false);
          return;
        }
        if (helpOpen) {
          event.preventDefault();
          setHelpOpen(false);
          return;
        }
        if (appearanceOpen) {
          event.preventDefault();
          setAppearanceOpen(false);
          return;
        }
        if (aiSettingsOpen) {
          event.preventDefault();
          setAiSettingsOpen(false);
          return;
        }
        if (visualizeOpen) {
          event.preventDefault();
          setVisualizeOpen(false);
          return;
        }
        if (grokOpen) {
          event.preventDefault();
          setGrokOpen(false);
          return;
        }
        if (assistantOpen) {
          event.preventDefault();
          setAssistantOpen(false);
          return;
        }
        if (editing) {
          event.preventDefault();
          const prompt = useSessionStore.getState().nanoPrompt;
          if (prompt === "save-exit" || prompt === "note-title") {
            useSessionStore.getState().clearNanoPrompt();
            return;
          }
          handleNanoExit();
          return;
        }
      }

      if (
        mod &&
        (key === "\\" ||
          key === "`" ||
          event.code === "Backslash" ||
          event.code === "Backquote")
      ) {
        event.preventDefault();
        useSessionStore.getState().focusCli();
        return;
      }

      // "/" activates the CLI for commands (same idea as Ctrl+\ / Ctrl+`).
      // Skip when already typing in an input/textarea/select, or with modifiers.
      if (key === "/" && !mod && !event.altKey) {
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        ) {
          return;
        }
        // CodeMirror handles "/" at line-start itself; other targets focus CLI.
        if (target instanceof HTMLElement && target.closest(".cm-editor")) {
          return;
        }
        event.preventDefault();
        useSessionStore.getState().focusCli("/");
        return;
      }

      if (!mod) return;

      // Ctrl+ / Ctrl- zoom text (also = and Numpad keys).
      if (
        key === "=" ||
        key === "+" ||
        event.code === "Equal" ||
        event.code === "NumpadAdd"
      ) {
        event.preventDefault();
        const appearance = useAppearanceStore.getState();
        appearance.setFontSize(appearance.fontSize + 1);
        return;
      }
      if (
        key === "-" ||
        event.code === "Minus" ||
        event.code === "NumpadSubtract"
      ) {
        event.preventDefault();
        const appearance = useAppearanceStore.getState();
        appearance.setFontSize(appearance.fontSize - 1);
        return;
      }

      const lower = key.toLowerCase();
      if (lower === "k" && !event.shiftKey) {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (lower === "p" && event.shiftKey) {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (lower === "t" && event.shiftKey) {
        event.preventDefault();
        void runPracticeTests();
        return;
      }
      if (lower === "s" && !event.shiftKey) {
        event.preventDefault();
        void saveDocument().catch(() => undefined);
      } else if (lower === "x" && !event.shiftKey) {
        // Nano-style exit (also Escape).
        if (editing) {
          event.preventDefault();
          handleNanoExit();
        }
      } else if (lower === "n" && event.shiftKey) {
        event.preventDefault();
        setNotesOpen(true);
      } else if (lower === "n" && !event.shiftKey) {
        event.preventDefault();
        void cliHandlers.createNote();
      } else if (lower === "z" && event.shiftKey) {
        event.preventDefault();
        executeEditorCommand("redo");
      } else if (lower === "z") {
        event.preventDefault();
        executeEditorCommand("undo");
      } else if (lower === "c" && event.shiftKey) {
        event.preventDefault();
        if (editing) void cliHandlers.cloneTab().catch(() => undefined);
      } else if (lower === "b" && !event.shiftKey) {
        event.preventDefault();
        sendTerminalCommand("build", bufferContent);
      } else if (lower === "r" && !event.shiftKey) {
        event.preventDefault();
        sendTerminalCommand("run", bufferContent);
      } else if (lower === "f" && !event.shiftKey) {
        event.preventDefault();
        executeEditorCommand("find");
      } else if (lower === "m" && !event.shiftKey) {
        event.preventDefault();
        cliHandlers.setLanguage(
          bufferLanguage === "python" ? "markdown" : "python",
        );
      } else if (lower === "," || (lower === "s" && event.shiftKey)) {
        // Font / color / opacity (Ctrl+, or Ctrl+Shift+S)
        event.preventDefault();
        setAppearanceOpen(true);
      } else if (lower === "g" && !event.shiftKey) {
        event.preventDefault();
        openCoach();
      } else if (lower === "a" && event.shiftKey) {
        event.preventDefault();
        openAssistant();
      } else if (lower === "v" && event.shiftKey) {
        event.preventDefault();
        openVisualize();
      } else if (lower === "h" && !event.shiftKey) {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    appearanceOpen,
    aiSettingsOpen,
    bufferContent,
    bufferLanguage,
    cliHandlers,
    editing,
    executeEditorCommand,
    grokOpen,
    assistantOpen,
    handleNanoExit,
    helpOpen,
    openVisualize,
    openCoach,
    openAssistant,
    paletteOpen,
    runPracticeTests,
    saveDocument,
    sendTerminalCommand,
    studyOpen,
    notesOpen,
    visualizeOpen,
  ]);

  useEffect(() => {
    if (session.viewMode === "cli") {
      useSessionStore.getState().focusCli();
      return;
    }
    // Entering the editor: keep the bottom terminal a strip, not a takeover.
    const state = useSessionStore.getState();
    const workspace = document.querySelector(
      ".sticky-workspace",
    ) as HTMLElement | null;
    const hostW = workspace?.clientWidth || window.innerWidth;
    const hostH = workspace?.clientHeight || window.innerHeight;
    const dock = sidePaneOpen ? "bottom" : state.cliDock;
    const bottomDefault = 148;
    const maxBottom = Math.max(bottomDefault, Math.floor(hostH * 0.35));
    const maxSide = Math.max(160, Math.floor(hostW * 0.45));
    if (dock === "bottom") {
      if (state.cliSize > maxBottom || state.cliSize < 72) {
        state.setCliSize(bottomDefault);
      }
    } else if (state.cliSize > maxSide) {
      state.setCliSize(maxSide);
    }
    const maxGrok = Math.max(
      160,
      Math.min(Math.floor(hostW * 0.42), Math.floor(hostW - 200)),
    );
    if (state.grokWidth > maxGrok) state.setGrokWidth(maxGrok);
  }, [session.viewMode, sidePaneOpen]);

  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 960,
    height: typeof window !== "undefined" ? window.innerHeight : 700,
  }));

  useEffect(() => {
    if (!sidePaneOpen) return;
    const workspace = document.querySelector(
      ".sticky-workspace",
    ) as HTMLElement | null;
    const hostW = workspace?.clientWidth || window.innerWidth;
    const maxGrok = Math.max(
      160,
      Math.min(Math.floor(hostW * 0.4), Math.floor(hostW - 220)),
    );
    const state = useSessionStore.getState();
    const next = Math.min(state.grokWidth, maxGrok);
    if (next !== state.grokWidth) state.setGrokWidth(next);
    // Prefer a compact default in small windowed frames.
    if (hostW < 700 && state.grokWidth > Math.min(260, maxGrok)) {
      state.setGrokWidth(Math.min(260, maxGrok));
    }
  }, [sidePaneOpen]);

  useEffect(() => {
    const clampPanels = () => {
      if (
        document.documentElement.dataset.grokResizing === "1" ||
        document.documentElement.dataset.cliResizing === "1"
      ) {
        return;
      }
      const workspace = document.querySelector(
        ".sticky-workspace",
      ) as HTMLElement | null;
      const hostW = workspace?.clientWidth || window.innerWidth;
      const hostH = workspace?.clientHeight || window.innerHeight;
      const sessionState = useSessionStore.getState();
      const cliAsBottom = sidePaneOpen || sessionState.cliDock === "bottom";
      const bottomDefault = 148;
      const maxCli = cliAsBottom
        ? Math.max(bottomDefault, Math.floor(hostH * 0.35))
        : Math.max(160, Math.floor(hostW * 0.45));
      if (sessionState.cliSize > maxCli) {
        sessionState.setCliSize(cliAsBottom ? bottomDefault : maxCli);
      }
      // Keep editor/CLI usable in windowed mode (leave ≥200px for main pane).
      const maxGrok = Math.max(
        160,
        Math.min(Math.floor(hostW * 0.42), Math.floor(hostW - 200)),
      );
      if (sessionState.grokWidth > maxGrok) {
        sessionState.setGrokWidth(maxGrok);
      }
      // Clear live drag override on the workspace only (shell keeps React value).
      workspace?.style.removeProperty("--grok-width");
    };

    const onResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      clampPanels();
    };

    onResize();
    window.addEventListener("resize", onResize);

    const workspace = document.querySelector(".sticky-workspace");
    const ro =
      workspace && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            setViewport({
              width: window.innerWidth,
              height: window.innerHeight,
            });
            clampPanels();
          })
        : null;
    if (workspace && ro) ro.observe(workspace);

    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [sidePaneOpen]);

  const effectiveFontSize = useMemo(
    () => scaledFontSize(appearance.fontSize, viewport.width, viewport.height),
    [appearance.fontSize, viewport.height, viewport.width],
  );

  const shellStyle = {
    "--app-opacity": appearance.opacity,
    "--editor-font": appearance.fontFamily,
    "--editor-font-size": `${effectiveFontSize}px`,
    "--grok-width": `${session.grokWidth}px`,
    "--cli-size": `${session.cliSize}px`,
    "--custom-bg": appearance.backgroundColor ?? "var(--base-background)",
    "--custom-fg": appearance.foregroundColor ?? "var(--text)",
    ...(appearance.foregroundColor
      ? {
          "--text": appearance.foregroundColor,
          color: appearance.foregroundColor,
        }
      : {}),
    ...(appearance.backgroundColor
      ? { "--base-background": appearance.backgroundColor }
      : {}),
  } as CSSProperties;

  const dirtyLabel = activeTab?.dirty ? "Unsaved" : "";

  return (
    <div
      className="app-shell sticky-only cli-app"
      data-theme={appearance.theme}
      data-shell={session.shellMode}
      data-mode={session.viewMode}
      data-matrix={appearance.matrixRain ? "on" : "off"}
      style={shellStyle}
    >
      {appearance.matrixRain && <MatrixRain />}
      <TabDragController />
      <section className="sticky-window">
        <StickyHeader
          title={statusTitle}
          saveLabel={dirtyLabel}
          language={bufferLanguage}
          shellMode={session.shellMode}
          editing={editing}
          canArchive={editing && activeTab?.kind === "note"}
          notes={notes}
          onNew={() => void cliHandlers.createNote()}
          onOpenNote={(noteId) => void cliHandlers.openNote(noteId)}
          onRefreshNotes={() => void loadNotes()}
          onSave={() => void saveDocument().catch(() => undefined)}
          onBuild={() => sendTerminalCommand("build", bufferContent)}
          onRun={() => sendTerminalCommand("run", bufferContent)}
          onArchive={() => void archiveActive()}
          onEditorCommand={executeEditorCommand}
          onAppearance={() => setAppearanceOpen(true)}
          onAiSettings={() => setAiSettingsOpen(true)}
          onBackToCli={() => handleNanoExit()}
          onQuit={() => void requestQuit()}
          canResumeEditor={!editing && session.tabs.length > 0}
          onResumeEditor={() => {
            if (!useSessionStore.getState().resumeEditor()) {
              session.focusCli("open ");
            }
          }}
          onGrok={() => openCoach()}
          onAssistant={() => openAssistant()}
          onVisualize={() => openVisualize()}
          onCloneTab={() => void cliHandlers.cloneTab()}
          onLanguageChange={(language) =>
            cliHandlers.setLanguage(
              language as "python" | "markdown" | "plaintext",
            )
          }
          onHelp={() => setHelpOpen(true)}
          onNotes={() => setNotesOpen(true)}
        />
        {interviewRemainingLabel ? (
          <div
            className="interview-chip"
            data-locked={interviewRemainingLabel.locked ? "true" : "false"}
          >
            <span>
              Interview {interviewRemainingLabel.difficulty} ·{" "}
              {interviewRemainingLabel.label}
              {interviewRemainingLabel.locked ? " · hints locked" : ""}
            </span>
            <button
              type="button"
              onClick={() => useInterviewStore.getState().unlockReveal()}
            >
              Reveal
            </button>
            <button
              type="button"
              onClick={() => useInterviewStore.getState().stop()}
            >
              End
            </button>
          </div>
        ) : null}
        {editing && (session.tabs.length > 1 || session.splitCount > 1) && (
          <TabBar
            tabs={session.tabs}
            activeTabId={session.activeTabId}
            onSelect={(id) => session.setActiveTab(id)}
            onClose={closeTabSafely}
            onNew={() => void cliHandlers.newTab()}
            onClone={() => void cliHandlers.cloneTab()}
            onUnsplit={
              session.splitCount > 1
                ? () => session.setSplitCount(1)
                : undefined
            }
          />
        )}
        <main
          className={`sticky-workspace ${editing ? "is-editing" : "is-cli"}${
            editing && session.splitCount > 1 ? " is-split" : ""
          }${editing ? ` cli-dock-${effectiveCliDock}` : ""}${
            sidePaneOpen ? " has-grok" : ""
          }`}
        >
          {error && <ErrorBanner error={error} onDismiss={clearError} />}
          <div
            className={sidePaneOpen ? "grok-split" : "workspace-fill"}
            style={
              sidePaneOpen
                ? ({
                    "--grok-width": `${session.grokWidth}px`,
                  } as CSSProperties)
                : undefined
            }
          >
            <div className="grok-split-main">
              {editing ? (
                <div className="editor-column">
                  <div className="editor-stack">
                    {testSummary ? (
                      <TestStrip
                        summary={testSummary}
                        onClear={() => setTestSummary(null)}
                      />
                    ) : null}
                    {session.tabs.length > 0 && (
                      <SplitWorkspace
                        tabs={session.tabs}
                        splitCount={session.splitCount}
                        splitAxis={session.splitAxis}
                        paneTabIds={session.paneTabIds}
                        paneSizes={session.paneSizes}
                        focusedPaneIndex={session.focusedPaneIndex}
                        dark={appearance.theme !== "light"}
                        fontFamily={appearance.fontFamily}
                        fontSize={effectiveFontSize}
                        onFocusPane={(index) => session.setFocusedPane(index)}
                        onSelectTabInPane={(paneIndex, tabId) => {
                          if (!tabId) {
                            session.setPaneTab(paneIndex, null);
                            return;
                          }
                          session.setPaneTab(paneIndex, tabId);
                          session.setActiveTab(tabId);
                        }}
                        onCloseTab={closeTabSafely}
                        onPaneSizesChange={(sizes) =>
                          session.setPaneSizes(sizes)
                        }
                        onPatchTab={(tabId, patch) => {
                          session.patchTab(tabId, patch);
                          const tab = useSessionStore
                            .getState()
                            .tabs.find((item) => item.id === tabId);
                          if (tab?.kind === "note" && tab.noteId) {
                            const noteState = useNoteStore.getState();
                            if (noteState.activeNote?.id === tab.noteId) {
                              patchActive(patch);
                            } else {
                              useNoteStore.setState({
                                activeNote: noteState.activeNote,
                                saveStatus: "dirty",
                              });
                              void selectNote(tab.noteId).then(() => {
                                patchActive({
                                  content: tab.content,
                                  title: tab.title,
                                  language: tab.language,
                                  ...patch,
                                });
                              });
                            }
                          }
                        }}
                        onActionsReady={registerEditorActions}
                        onSlashCommand={handleSlashCommand}
                        onNanoExit={handleNanoExit}
                        onActivateCommand={(seed) =>
                          useSessionStore.getState().focusCli(seed)
                        }
                      />
                    )}
                    <div className="editor-status-bar">
                      <span>
                        {(bufferContent.length || 0).toLocaleString()}{" "}
                        characters
                      </span>
                      <span title={session.cwd || "No workspace"}>
                        {session.cwd
                          ? session.cwd.replace(/^.*[\\/]/, "")
                          : "No workspace"}
                      </span>
                      <span>{session.shellMode.toUpperCase()}</span>
                      <span>
                        {appearance.grokApiKey ? "AI ready" : "AI offline"}
                      </span>
                      <span>{activeTab?.dirty ? "Unsaved" : "Saved"}</span>
                      <label>
                        <span className="sr-only">Language</span>
                        <select
                          value={bufferLanguage}
                          onChange={(event) =>
                            cliHandlers.setLanguage(
                              event.target.value as
                                "python" | "markdown" | "plaintext",
                            )
                          }
                        >
                          <option value="python">Python</option>
                          <option value="markdown">Markdown</option>
                          <option value="plaintext">Plain text</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <CliFrame
                    dock={effectiveCliDock}
                    size={session.cliSize}
                    onDockChange={(dock) => session.setCliDock(dock)}
                    onSizeChange={(size) => session.setCliSize(size)}
                  >
                    <TerminalPanel
                      variant={session.viewMode}
                      code={bufferContent}
                      language={bufferLanguage}
                      cwd={session.cwd}
                      shellMode={session.shellMode}
                      nanoPrompt={session.nanoPrompt}
                      focusToken={session.cliFocusToken}
                      cliSeed={session.cliSeed}
                      handlers={cliHandlers}
                      request={terminalRequest}
                      notice={cliNotice}
                      onNanoChoice={(choice) => void handleNanoChoice(choice)}
                      onCliSeedConsumed={() =>
                        useSessionStore.getState().clearCliSeed()
                      }
                    />
                  </CliFrame>
                </div>
              ) : (
                <div className="cli-home">
                  {welcomeOpen && session.tabs.length === 0 && (
                    <DeveloperCockpitWelcome
                      cwd={session.cwd}
                      onNewScratch={() => {
                        setWelcomeOpen(false);
                        void cliHandlers.newTab();
                      }}
                      onOpenFile={() => {
                        setWelcomeOpen(false);
                        session.focusCli("open ");
                      }}
                      onOpenWorkspace={() => {
                        setWelcomeOpen(false);
                        session.focusCli("cd ");
                      }}
                      onDismiss={() => {
                        localStorage.setItem(
                          "scratchcli-welcome-dismissed",
                          "true",
                        );
                        setWelcomeOpen(false);
                      }}
                    />
                  )}
                  <TerminalPanel
                    variant={session.viewMode}
                    code={bufferContent}
                    language={bufferLanguage}
                    cwd={session.cwd}
                    shellMode={session.shellMode}
                    nanoPrompt={session.nanoPrompt}
                    focusToken={session.cliFocusToken}
                    cliSeed={session.cliSeed}
                    handlers={cliHandlers}
                    request={terminalRequest}
                    notice={cliNotice}
                    onNanoChoice={(choice) => void handleNanoChoice(choice)}
                    onCliSeedConsumed={() =>
                      useSessionStore.getState().clearCliSeed()
                    }
                  />
                  <footer
                    className="cockpit-status"
                    aria-label="Workspace status"
                  >
                    <span
                      className="sticky-mode-badge"
                      data-mode="cli"
                      title="CLI mode — open a file or note to enter the editor"
                    >
                      CLI
                    </span>
                    <span title={session.cwd || "No workspace"}>
                      {session.cwd || "No workspace selected"}
                    </span>
                    <span>{session.shellMode.toUpperCase()}</span>
                    {session.tabs.length > 0 ? (
                      <button
                        type="button"
                        className="cockpit-resume"
                        onClick={() =>
                          useSessionStore.getState().resumeEditor()
                        }
                      >
                        Resume editor ({session.tabs.length})
                      </button>
                    ) : null}
                    <span>
                      {workspaceConfig ? ".scratchcli.json" : "Default config"}
                    </span>
                    <span>Local</span>
                    <span>
                      {appearance.grokApiKey ? "AI ready" : "AI offline"}
                    </span>
                    <span>Ctrl+K · Commands</span>
                  </footer>
                </div>
              )}
            </div>
            {sidePaneOpen ? (
              <GrokSplitSash
                width={session.grokWidth}
                onWidthChange={(width) => session.setGrokWidth(width)}
              />
            ) : null}
            {editing && grokOpen && (
              <Suspense
                fallback={
                  <div className="feature-loading">Opening Practice…</div>
                }
              >
                <GrokHelperPanel
                  language={bufferLanguage}
                  buffer={bufferContent}
                  title={statusTitle}
                  width={session.grokWidth}
                  onWidthChange={(width) => session.setGrokWidth(width)}
                  onClose={() => setGrokOpen(false)}
                  onOpenSettings={() => setAiSettingsOpen(true)}
                  onInsert={(text) => {
                    const active = useSessionStore.getState().getActiveTab();
                    const next = bufferContent
                      ? `${bufferContent.replace(/\s*$/, "")}\n\n${text}\n`
                      : `${text}\n`;
                    if (active) {
                      session.patchTab(active.id, { content: next });
                      if (active.kind === "note" && active.noteId) {
                        patchActive({ content: next });
                      }
                    }
                  }}
                  onApplyBuffer={(content) => {
                    const active = useSessionStore.getState().getActiveTab();
                    if (!active) return;
                    session.patchTab(active.id, { content, dirty: true });
                    if (active.kind === "note" && active.noteId) {
                      patchActive({ content });
                    }
                  }}
                  onCreatePracticeFile={createPracticeFile}
                  onOpenVisualize={() => openVisualize()}
                />
              </Suspense>
            )}
            {editing && assistantOpen && (
              <Suspense
                fallback={
                  <div className="feature-loading">Opening Assistant…</div>
                }
              >
                <AssistantPanel
                  language={bufferLanguage}
                  buffer={bufferContent}
                  title={statusTitle}
                  cwd={session.cwd}
                  width={session.grokWidth}
                  onWidthChange={(width) => session.setGrokWidth(width)}
                  onClose={() => setAssistantOpen(false)}
                  onOpenSettings={() => setAiSettingsOpen(true)}
                />
              </Suspense>
            )}
            {!editing && grokOpen && (
              <Suspense
                fallback={
                  <div className="feature-loading">Opening Practice…</div>
                }
              >
                <GrokHelperPanel
                  language={bufferLanguage}
                  buffer=""
                  title="CLI"
                  width={session.grokWidth}
                  onWidthChange={(width) => session.setGrokWidth(width)}
                  onClose={() => setGrokOpen(false)}
                  onOpenSettings={() => setAiSettingsOpen(true)}
                  onInsert={() => undefined}
                  onCreatePracticeFile={createPracticeFile}
                  onOpenVisualize={() => openVisualize()}
                />
              </Suspense>
            )}
            {!editing && assistantOpen && (
              <Suspense
                fallback={
                  <div className="feature-loading">Opening Assistant…</div>
                }
              >
                <AssistantPanel
                  language={bufferLanguage}
                  buffer={bufferContent}
                  title="CLI"
                  cwd={session.cwd}
                  width={session.grokWidth}
                  onWidthChange={(width) => session.setGrokWidth(width)}
                  onClose={() => setAssistantOpen(false)}
                  onOpenSettings={() => setAiSettingsOpen(true)}
                />
              </Suspense>
            )}
          </div>
        </main>
      </section>
      {appearanceOpen && (
        <AppearanceDialog
          fonts={fontCatalog}
          onClose={() => setAppearanceOpen(false)}
        />
      )}
      {aiSettingsOpen && (
        <AiSettingsDialog onClose={() => setAiSettingsOpen(false)} />
      )}
      {paletteOpen && (
        <CommandPalette
          items={paletteItems}
          onClose={() => setPaletteOpen(false)}
        />
      )}
      {studyOpen && (
        <Suspense fallback={null}>
          <StudyBoardDialog
            onClose={() => setStudyOpen(false)}
            onOpenViz={(kind) => openVisualize(kind)}
          />
        </Suspense>
      )}
      {notesOpen && (
        <NotesLibraryDialog
          initialNotes={notes}
          onOpen={(id) => void cliHandlers.openNote(id)}
          onChanged={() => void loadNotes()}
          onClose={() => setNotesOpen(false)}
          onCliMessage={(text) => setCliNotice({ id: Date.now(), text })}
          onNoteColorChanged={(noteId, color) => {
            const state = useSessionStore.getState();
            const tab = state.tabs.find(
              (item) => item.kind === "note" && item.noteId === noteId,
            );
            if (tab) state.patchTab(tab.id, { color });
            const active = useNoteStore.getState().activeNote;
            if (active?.id === noteId) {
              useNoteStore.getState().patchActive({ color });
            }
          }}
        />
      )}
      {visualizeOpen && (
        <Suspense fallback={null}>
          <VisualizeDialog
            language={bufferLanguage}
            buffer={bufferContent}
            initialKind={vizInitialKind}
            onClose={() => {
              setVisualizeOpen(false);
              setVizInitialKind(undefined);
            }}
          />
        </Suspense>
      )}
      {helpOpen && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={() => setHelpOpen(false)}
        >
          <section
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="help-title">ScratchCLI help</h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label="Close"
              >
                x
              </button>
            </header>
            <div className="help-dialog-body">
              <pre>{helpText}</pre>
              <p>
                Focus the CLI with / (start of a line in the editor), Ctrl+\, or
                Ctrl+`. Text size scales with the window; Ctrl+= / Ctrl+- still
                nudge it. Drag the terminal edge to resize; drag the grip to a
                side/bottom edge to dock it like Windows snap. Ctrl+S saves.
                Escape or Ctrl+X exits the editor and asks to save if the file
                is new or modified. After ls, double-click a file to open it.
                Use split 2 in the CLI for editor panes.
              </p>
              <section className="help-about" aria-label="About">
                <h3>About</h3>
                <p>
                  ScratchCLI — a quiet, local-first coding scratchpad.
                  <br />
                  Version 0.1.0
                </p>
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
