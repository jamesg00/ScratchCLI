import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ShellKind } from "../types/shell";

export type ViewMode = "cli" | "editing";
export type ShellMode = "python" | ShellKind;
export type DocumentKind = "note" | "file";
export type NanoPrompt = "save-exit" | "note-title" | null;
export type SplitCount = 1 | 2 | 3 | 4;
export type CliDock = "bottom" | "left" | "right";
export type SplitAxis = "horizontal" | "vertical";
export type TabDropEdge = "left" | "right" | "top" | "bottom" | "center";

export const SCRATCHCLI_TAB_MIME = "application/x-scratchcli-tab";
const CLI_SIZE_MIN = 72;
const CLI_SIZE_DEFAULT_BOTTOM = 148;
const CLI_SIZE_DEFAULT_SIDE = 280;
const CLI_SIZE_MAX_BOTTOM_RATIO = 0.35;
const GROK_WIDTH_MIN = 160;
const GROK_WIDTH_DEFAULT = 280;
const GROK_WIDTH_MAX = 900;

export type EditorTab = {
  id: string;
  kind: DocumentKind;
  title: string;
  noteId?: string;
  path?: string;
  content: string;
  language: string;
  dirty: boolean;
  /** Sticky-note accent for note tabs; files use gray. */
  color?: "yellow" | "blue" | "green" | "pink" | "purple" | "gray";
  /** True until the first successful save after create / open-as-new. */
  isNew?: boolean;
};

export type FileBuffer = {
  path: string;
  content: string;
  language: string;
  dirty: boolean;
};

function newId(): string {
  return crypto.randomUUID();
}

function equalSizes(count: SplitCount): number[] {
  return Array.from({ length: 4 }, (_, index) =>
    index < count ? 1 / count : 0,
  );
}

function ensurePaneTabs(
  paneTabIds: (string | null)[],
  tabs: EditorTab[],
  splitCount: SplitCount,
  activeTabId: string | null,
): (string | null)[] {
  const next = [...paneTabIds];
  while (next.length < 4) next.push(null);
  for (let i = 0; i < splitCount; i += 1) {
    if (next[i] && !tabs.some((tab) => tab.id === next[i])) {
      next[i] = null;
    }
  }
  if (activeTabId && !next.slice(0, splitCount).includes(activeTabId)) {
    next[0] = activeTabId;
  }
  for (let i = 0; i < splitCount; i += 1) {
    if (!next[i] && tabs[i]) next[i] = tabs[i]!.id;
    else if (!next[i] && activeTabId) next[i] = activeTabId;
  }
  return next.slice(0, 4);
}

type SessionState = {
  viewMode: ViewMode;
  shellMode: ShellMode;
  cwd: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  focusedPaneIndex: number;
  splitCount: SplitCount;
  /** horizontal = side-by-side panes; vertical = stacked (2-pane drag top/bottom). */
  splitAxis: SplitAxis;
  paneTabIds: (string | null)[];
  paneSizes: number[];
  cliDock: CliDock;
  cliSize: number;
  grokWidth: number;
  /** @deprecated mirrored from active tab for older call sites */
  documentKind: DocumentKind;
  fileBuffer: FileBuffer | null;
  nanoPrompt: NanoPrompt;
  cliFocusToken: number;
  cliSeed: string | null;
  setViewMode: (viewMode: ViewMode) => void;
  setShellMode: (shellMode: ShellMode) => void;
  setCwd: (cwd: string) => void;
  openNoteDocument: (note: {
    id: string;
    title: string;
    content: string;
    language: string;
    color?: EditorTab["color"];
  }) => string;
  openFileDocument: (
    buffer: Omit<FileBuffer, "dirty"> & {
      title?: string;
      isNew?: boolean;
    },
  ) => string;
  openEmptyTab: () => string;
  cloneActiveTab: () => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  patchActiveTab: (
    patch: Partial<Pick<EditorTab, "content" | "language" | "title">>,
  ) => void;
  patchTab: (
    id: string,
    patch: Partial<
      Pick<
        EditorTab,
        | "content"
        | "language"
        | "title"
        | "dirty"
        | "path"
        | "noteId"
        | "isNew"
        | "color"
      >
    >,
  ) => void;
  markActiveSaved: (path?: string) => void;
  setSplitCount: (count: SplitCount) => void;
  setPaneTab: (paneIndex: number, tabId: string | null) => void;
  setFocusedPane: (index: number) => void;
  setPaneSizes: (sizes: number[]) => void;
  dockTabDrop: (tabId: string, edge: TabDropEdge, paneIndex?: number) => void;
  setCliDock: (dock: CliDock) => void;
  setCliSize: (size: number) => void;
  setGrokWidth: (width: number) => void;
  /** Legacy helpers kept for compatibility */
  patchFileBuffer: (
    patch: Partial<Pick<FileBuffer, "content" | "language">>,
  ) => void;
  markFileSaved: (path?: string) => void;
  clearFileBuffer: () => void;
  requestNanoExit: () => void;
  requestNoteTitle: () => void;
  clearNanoPrompt: () => void;
  focusCli: (seed?: string) => void;
  clearCliSeed: () => void;
  enterEditor: () => void;
  resumeEditor: () => boolean;
  leaveEditor: () => void;
  getActiveTab: () => EditorTab | null;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      viewMode: "cli",
      shellMode: "cmd",
      cwd: "",
      tabs: [],
      activeTabId: null,
      focusedPaneIndex: 0,
      splitCount: 1,
      splitAxis: "horizontal",
      paneTabIds: [null, null, null, null],
      paneSizes: equalSizes(1),
      cliDock: "bottom",
      cliSize: CLI_SIZE_DEFAULT_BOTTOM,
      grokWidth: GROK_WIDTH_DEFAULT,
      documentKind: "note",
      fileBuffer: null,
      nanoPrompt: null,
      cliFocusToken: 0,
      cliSeed: null,
      setViewMode: (viewMode) => set({ viewMode }),
      setShellMode: (shellMode) => set({ shellMode }),
      setCwd: (cwd) => set({ cwd }),
      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((tab) => tab.id === activeTabId) ?? null;
      },
      openNoteDocument: (note) => {
        const existing = get().tabs.find(
          (tab) => tab.kind === "note" && tab.noteId === note.id,
        );
        if (existing) {
          set((state) => ({
            viewMode: "editing",
            activeTabId: existing.id,
            documentKind: "note",
            fileBuffer: null,
            nanoPrompt: null,
            tabs: state.tabs.map((tab) =>
              tab.id === existing.id
                ? {
                    ...tab,
                    title: note.title || tab.title,
                    content: note.content,
                    language: note.language,
                    color: note.color ?? tab.color ?? "yellow",
                  }
                : tab,
            ),
            paneTabIds: ensurePaneTabs(
              state.paneTabIds.map((id, index) =>
                index === state.focusedPaneIndex ? existing.id : id,
              ),
              state.tabs,
              state.splitCount,
              existing.id,
            ),
          }));
          return existing.id;
        }
        const tab: EditorTab = {
          id: newId(),
          kind: "note",
          title: note.title || "Untitled note",
          noteId: note.id,
          content: note.content,
          language: note.language,
          color: note.color ?? "yellow",
          dirty: false,
          isNew: !note.content,
        };
        set((state) => {
          const tabs = [...state.tabs, tab];
          const paneTabIds = [...state.paneTabIds];
          paneTabIds[state.focusedPaneIndex] = tab.id;
          return {
            viewMode: "editing",
            tabs,
            activeTabId: tab.id,
            documentKind: "note",
            fileBuffer: null,
            nanoPrompt: null,
            paneTabIds: ensurePaneTabs(
              paneTabIds,
              tabs,
              state.splitCount,
              tab.id,
            ),
          };
        });
        return tab.id;
      },
      openFileDocument: (buffer) => {
        const existing = get().tabs.find(
          (tab) => tab.kind === "file" && tab.path === buffer.path,
        );
        if (existing) {
          set((state) => ({
            viewMode: "editing",
            activeTabId: existing.id,
            documentKind: "file",
            fileBuffer: {
              path: existing.path!,
              content: existing.content,
              language: existing.language,
              dirty: existing.dirty,
            },
            nanoPrompt: null,
            paneTabIds: ensurePaneTabs(
              state.paneTabIds.map((id, index) =>
                index === state.focusedPaneIndex ? existing.id : id,
              ),
              state.tabs,
              state.splitCount,
              existing.id,
            ),
          }));
          return existing.id;
        }
        const title =
          buffer.title ||
          buffer.path.split(/[/\\]/).filter(Boolean).at(-1) ||
          buffer.path;
        const tab: EditorTab = {
          id: newId(),
          kind: "file",
          title,
          path: buffer.path,
          content: buffer.content,
          language: buffer.language,
          dirty: false,
          isNew: Boolean(buffer.isNew),
        };
        set((state) => {
          const tabs = [...state.tabs, tab];
          const paneTabIds = [...state.paneTabIds];
          paneTabIds[state.focusedPaneIndex] = tab.id;
          return {
            viewMode: "editing",
            tabs,
            activeTabId: tab.id,
            documentKind: "file",
            fileBuffer: { ...buffer, dirty: false },
            nanoPrompt: null,
            paneTabIds: ensurePaneTabs(
              paneTabIds,
              tabs,
              state.splitCount,
              tab.id,
            ),
          };
        });
        return tab.id;
      },
      openEmptyTab: () => {
        const tab: EditorTab = {
          id: newId(),
          kind: "note",
          title: "Untitled",
          content: "",
          language: "python",
          dirty: true,
          isNew: true,
        };
        set((state) => {
          const tabs = [...state.tabs, tab];
          const paneTabIds = [...state.paneTabIds];
          paneTabIds[state.focusedPaneIndex] = tab.id;
          return {
            viewMode: "editing",
            tabs,
            activeTabId: tab.id,
            documentKind: "note",
            fileBuffer: null,
            paneTabIds: ensurePaneTabs(
              paneTabIds,
              tabs,
              state.splitCount,
              tab.id,
            ),
          };
        });
        return tab.id;
      },
      cloneActiveTab: () => {
        const active = get().getActiveTab();
        if (!active) {
          throw new Error("No open tab to clone.");
        }
        const baseTitle =
          active.title?.trim() ||
          active.path?.split(/[/\\]/).filter(Boolean).at(-1) ||
          "Untitled";
        const copyTitle = / copy(?: \d+)?$/i.test(baseTitle)
          ? `${baseTitle.replace(/ copy(?: \d+)?$/i, "")} copy`
          : `${baseTitle} copy`;
        const tab: EditorTab = {
          id: newId(),
          kind: "note",
          title: copyTitle,
          content: active.content,
          language: active.language || "python",
          color: active.color ?? "yellow",
          dirty: true,
          isNew: true,
        };
        set((state) => {
          const tabs = [...state.tabs, tab];
          const paneTabIds = [...state.paneTabIds];
          paneTabIds[state.focusedPaneIndex] = tab.id;
          return {
            viewMode: "editing",
            tabs,
            activeTabId: tab.id,
            documentKind: "note",
            fileBuffer: null,
            nanoPrompt: null,
            paneTabIds: ensurePaneTabs(
              paneTabIds,
              tabs,
              state.splitCount,
              tab.id,
            ),
          };
        });
        return tab.id;
      },
      closeTab: (id) => {
        set((state) => {
          const tabs = state.tabs.filter((tab) => tab.id !== id);
          const activeTabId =
            state.activeTabId === id
              ? (tabs[Math.max(0, tabs.length - 1)]?.id ?? null)
              : state.activeTabId;
          const paneTabIds = state.paneTabIds.map((paneId) =>
            paneId === id ? activeTabId : paneId,
          );
          const active = tabs.find((tab) => tab.id === activeTabId) ?? null;
          return {
            tabs,
            activeTabId,
            viewMode: tabs.length ? "editing" : "cli",
            documentKind: active?.kind ?? "note",
            fileBuffer:
              active?.kind === "file" && active.path
                ? {
                    path: active.path,
                    content: active.content,
                    language: active.language,
                    dirty: active.dirty,
                  }
                : null,
            paneTabIds: ensurePaneTabs(
              paneTabIds,
              tabs,
              state.splitCount,
              activeTabId,
            ),
            splitCount: tabs.length ? state.splitCount : (1 as SplitCount),
            nanoPrompt: null,
          };
        });
      },
      setActiveTab: (id) => {
        set((state) => {
          const active = state.tabs.find((tab) => tab.id === id);
          if (!active) return state;
          const paneTabIds = [...state.paneTabIds];
          paneTabIds[state.focusedPaneIndex] = id;
          return {
            activeTabId: id,
            viewMode: "editing",
            documentKind: active.kind,
            fileBuffer:
              active.kind === "file" && active.path
                ? {
                    path: active.path,
                    content: active.content,
                    language: active.language,
                    dirty: active.dirty,
                  }
                : null,
            paneTabIds: ensurePaneTabs(
              paneTabIds,
              state.tabs,
              state.splitCount,
              id,
            ),
          };
        });
      },
      patchActiveTab: (patch) => {
        const id = get().activeTabId;
        if (!id) return;
        get().patchTab(id, { ...patch, dirty: true });
      },
      patchTab: (id, patch) => {
        set((state) => {
          const tabs = state.tabs.map((tab) =>
            tab.id === id
              ? {
                  ...tab,
                  ...patch,
                  dirty: patch.dirty ?? true,
                  title:
                    patch.title ??
                    (patch.content != null && tab.kind === "note"
                      ? patch.content
                          .split(/\r?\n/)
                          .map((line) => line.trim())
                          .find(Boolean)
                          ?.replace(/^#+\s*/, "")
                          .slice(0, 80) || tab.title
                      : tab.title),
                }
              : tab,
          );
          const active = tabs.find((tab) => tab.id === state.activeTabId);
          return {
            tabs,
            fileBuffer:
              active?.kind === "file" && active.path
                ? {
                    path: active.path,
                    content: active.content,
                    language: active.language,
                    dirty: active.dirty,
                  }
                : state.fileBuffer,
          };
        });
      },
      markActiveSaved: (path) => {
        const id = get().activeTabId;
        if (!id) return;
        get().patchTab(id, {
          dirty: false,
          isNew: false,
          ...(path
            ? { path, title: path.split(/[/\\]/).filter(Boolean).at(-1) }
            : {}),
        });
        set((state) => {
          const active = state.tabs.find((tab) => tab.id === id);
          return {
            fileBuffer:
              active?.kind === "file" && active.path
                ? {
                    path: active.path,
                    content: active.content,
                    language: active.language,
                    dirty: false,
                  }
                : null,
          };
        });
      },
      setSplitCount: (count) => {
        set((state) => ({
          splitCount: count,
          splitAxis: count === 1 ? "horizontal" : state.splitAxis,
          paneSizes: equalSizes(count),
          paneTabIds: ensurePaneTabs(
            state.paneTabIds,
            state.tabs,
            count,
            state.activeTabId,
          ),
          focusedPaneIndex: Math.min(state.focusedPaneIndex, count - 1),
        }));
      },
      setPaneTab: (paneIndex, tabId) => {
        set((state) => {
          if (paneIndex < 0 || paneIndex >= state.splitCount) return state;
          const paneTabIds = [...state.paneTabIds];
          paneTabIds[paneIndex] = tabId;
          return {
            paneTabIds,
            activeTabId: tabId ?? state.activeTabId,
            focusedPaneIndex: paneIndex,
          };
        });
      },
      dockTabDrop: (tabId, edge, paneIndex = 0) => {
        const state = get();
        if (!state.tabs.some((tab) => tab.id === tabId)) return;

        if (edge === "center") {
          if (state.splitCount === 1) {
            set((current) => ({
              activeTabId: tabId,
              paneTabIds: ensurePaneTabs(
                current.paneTabIds.map((id, index) =>
                  index === 0 ? tabId : id,
                ),
                current.tabs,
                1,
                tabId,
              ),
              focusedPaneIndex: 0,
            }));
            return;
          }
          get().setPaneTab(
            Math.max(0, Math.min(state.splitCount - 1, paneIndex)),
            tabId,
          );
          return;
        }

        const hostIndex = Math.max(
          0,
          Math.min(state.splitCount - 1, paneIndex),
        );
        const hostTabId =
          state.paneTabIds[hostIndex] ??
          state.activeTabId ??
          state.tabs.find((tab) => tab.id !== tabId)?.id ??
          tabId;
        const otherTabId =
          hostTabId === tabId
            ? (state.tabs.find((tab) => tab.id !== tabId)?.id ?? tabId)
            : hostTabId;

        const vertical = edge === "top" || edge === "bottom";
        const leading = edge === "left" || edge === "top";

        if (state.splitCount === 1) {
          set({
            splitCount: 2,
            splitAxis: vertical ? "vertical" : "horizontal",
            paneSizes: equalSizes(2),
            paneTabIds: leading
              ? [tabId, otherTabId, null, null]
              : [otherTabId, tabId, null, null],
            activeTabId: tabId,
            focusedPaneIndex: leading ? 0 : 1,
            viewMode: "editing",
          });
          return;
        }

        // Grow a side-by-side row when dropping on an outer edge (up to 4).
        if (
          !vertical &&
          state.splitCount < 4 &&
          ((edge === "left" && hostIndex === 0) ||
            (edge === "right" && hostIndex === state.splitCount - 1))
        ) {
          const nextCount = (state.splitCount + 1) as SplitCount;
          const panes = state.paneTabIds.slice(0, state.splitCount);
          if (edge === "left") panes.unshift(tabId);
          else panes.push(tabId);
          while (panes.length < 4) panes.push(null);
          set({
            splitCount: nextCount,
            splitAxis: "horizontal",
            paneSizes: equalSizes(nextCount),
            paneTabIds: panes.slice(0, 4),
            activeTabId: tabId,
            focusedPaneIndex: edge === "left" ? 0 : nextCount - 1,
          });
          return;
        }

        // Otherwise assign into the host or adjacent pane.
        let target = hostIndex;
        if (edge === "right" && hostIndex < state.splitCount - 1) {
          target = hostIndex + 1;
        } else if (
          edge === "bottom" &&
          state.splitCount === 4 &&
          hostIndex < 2
        ) {
          target = hostIndex + 2;
        } else if (edge === "top" && state.splitCount === 4 && hostIndex >= 2) {
          target = hostIndex - 2;
        }
        get().setPaneTab(target, tabId);
      },
      setFocusedPane: (index) => {
        set((state) => {
          const tabId = state.paneTabIds[index];
          const active = state.tabs.find((tab) => tab.id === tabId);
          return {
            focusedPaneIndex: index,
            activeTabId: tabId ?? state.activeTabId,
            documentKind: active?.kind ?? state.documentKind,
            fileBuffer:
              active?.kind === "file" && active.path
                ? {
                    path: active.path,
                    content: active.content,
                    language: active.language,
                    dirty: active.dirty,
                  }
                : active
                  ? null
                  : state.fileBuffer,
          };
        });
      },
      setPaneSizes: (sizes) => {
        const filled = [...sizes];
        while (filled.length < 4) filled.push(0);
        set({ paneSizes: filled.slice(0, 4) });
      },
      setCliDock: (cliDock) =>
        set((state) => ({
          cliDock,
          cliSize:
            cliDock === "bottom"
              ? state.cliDock === "bottom"
                ? state.cliSize
                : CLI_SIZE_DEFAULT_BOTTOM
              : state.cliDock !== "bottom"
                ? state.cliSize
                : CLI_SIZE_DEFAULT_SIDE,
        })),
      setCliSize: (cliSize) =>
        set({
          cliSize: Math.max(CLI_SIZE_MIN, Math.round(cliSize)),
        }),
      setGrokWidth: (width) =>
        set({
          grokWidth: Math.min(
            GROK_WIDTH_MAX,
            Math.max(GROK_WIDTH_MIN, Math.round(width)),
          ),
        }),
      patchFileBuffer: (patch) => {
        const active = get().getActiveTab();
        if (!active) return;
        get().patchTab(active.id, patch);
      },
      markFileSaved: (path) => get().markActiveSaved(path),
      clearFileBuffer: () => set({ fileBuffer: null, documentKind: "note" }),
      requestNanoExit: () =>
        set((state) => ({
          nanoPrompt: "save-exit",
          cliFocusToken: state.cliFocusToken + 1,
        })),
      requestNoteTitle: () =>
        set((state) => ({
          nanoPrompt: "note-title",
          cliFocusToken: state.cliFocusToken + 1,
        })),
      clearNanoPrompt: () => set({ nanoPrompt: null }),
      focusCli: (seed) =>
        set((state) => ({
          cliFocusToken: state.cliFocusToken + 1,
          cliSeed: seed ?? null,
        })),
      clearCliSeed: () => set({ cliSeed: null }),
      enterEditor: () => {
        const { tabs, activeTabId } = get();
        if (!tabs.length) return;
        const active =
          tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
        set({
          viewMode: "editing",
          activeTabId: active?.id ?? null,
          documentKind: active?.kind ?? "note",
          nanoPrompt: null,
          fileBuffer:
            active?.kind === "file" && active.path
              ? {
                  path: active.path,
                  content: active.content,
                  language: active.language,
                  dirty: active.dirty,
                }
              : null,
        });
      },
      resumeEditor: () => {
        const { tabs } = get();
        if (!tabs.length) return false;
        get().enterEditor();
        return true;
      },
      leaveEditor: () =>
        set((state) => {
          const active =
            state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
          return {
            viewMode: "cli" as const,
            nanoPrompt: null,
            cliSeed: null,
            // Keep tabs in memory for Resume editor (nano leave → CLI home).
            documentKind: active?.kind ?? state.documentKind,
          };
        }),
    }),
    {
      name: "scratchcli-session",
      version: 3,
      partialize: (state) => ({
        viewMode: state.viewMode,
        shellMode: state.shellMode,
        cwd: state.cwd,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        focusedPaneIndex: state.focusedPaneIndex,
        splitCount: state.splitCount,
        splitAxis: state.splitAxis,
        paneTabIds: state.paneTabIds,
        paneSizes: state.paneSizes,
        cliDock: state.cliDock,
        cliSize: state.cliSize,
        grokWidth: state.grokWidth,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Partial<SessionState>;
        if (version < 2) {
          return {
            ...state,
            viewMode: "cli",
            tabs: [],
            activeTabId: null,
            focusedPaneIndex: 0,
            splitCount: 1,
            paneTabIds: [null, null, null, null],
            paneSizes: equalSizes(1),
          } as SessionState;
        }
        if (version < 3) {
          const tabs = state.tabs ?? [];
          const hasDirty = tabs.some((tab) => tab.dirty);
          return {
            ...state,
            // CLI-first: clean sessions boot to CLI; dirty work restores Editor.
            viewMode: hasDirty && tabs.length ? "editing" : "cli",
            cliSize:
              typeof state.cliSize === "number" && state.cliSize >= CLI_SIZE_MIN
                ? state.cliSize
                : CLI_SIZE_DEFAULT_BOTTOM,
          } as SessionState;
        }
        return state as SessionState;
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SessionState>;
        const tabs = saved.tabs ?? current.tabs;
        const hasDirty = tabs.some((tab) => tab.dirty);
        const nextView: ViewMode =
          hasDirty && tabs.length > 0 ? "editing" : "cli";
        return {
          ...current,
          ...saved,
          viewMode: nextView,
        };
      },
    },
  ),
);

export { CLI_SIZE_DEFAULT_BOTTOM, CLI_SIZE_MAX_BOTTOM_RATIO };
