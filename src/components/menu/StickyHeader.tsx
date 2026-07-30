import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { EditorCommand } from "../editor/NoteEditor";
import type { NoteListItem } from "../../types/note";
import { RecentNotesMenu } from "./RecentNotesMenu";

type Props = {
  title: string;
  saveLabel: string;
  language: string;
  shellMode: string;
  editing: boolean;
  canArchive: boolean;
  notes: NoteListItem[];
  onNew: () => void;
  onOpenNote: (noteId: string) => void;
  onRefreshNotes?: () => void;
  onSave: () => void;
  onBuild: () => void;
  onRun: () => void;
  onLanguageChange: (language: string) => void;
  onAppearance: () => void;
  onAiSettings?: () => void;
  onArchive: () => void;
  onHelp: () => void;
  onNotes: () => void;
  onGrok?: () => void;
  onAssistant?: () => void;
  onVisualize?: () => void;
  onCloneTab?: () => void;
  onBackToCli: () => void;
  onQuit: () => void;
  canResumeEditor?: boolean;
  onResumeEditor?: () => void;
  onEditorCommand: (command: EditorCommand) => void;
};

const shellLabels: Record<string, string> = {
  cmd: "CMD",
  powershell: "PS",
  wsl: "WSL",
  python: "PY",
};

export function StickyHeader({
  title,
  saveLabel,
  language,
  shellMode,
  editing,
  canArchive,
  notes,
  onNew,
  onOpenNote,
  onRefreshNotes,
  onSave,
  onBuild,
  onRun,
  onLanguageChange,
  onAppearance,
  onAiSettings,
  onArchive,
  onHelp,
  onNotes,
  onGrok,
  onAssistant,
  onVisualize,
  onCloneTab,
  onBackToCli,
  onQuit,
  canResumeEditor,
  onResumeEditor,
  onEditorCommand,
}: Props) {
  const appWindow = getCurrentWindow();
  const shellLabel = shellLabels[shellMode] ?? shellMode.toUpperCase();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let disposed = false;
    const syncMaximized = async () => {
      try {
        const value = await appWindow.isMaximized();
        if (!disposed) setMaximized(value);
      } catch {
        // ignore
      }
    };
    void syncMaximized();
    const unlistenPromise = appWindow.onResized(() => {
      void syncMaximized();
    });
    return () => {
      disposed = true;
      void unlistenPromise.then((stop) => stop());
    };
  }, [appWindow]);

  const settingsActions = useMemo(() => {
    const actions: Array<{
      label: string;
      shortcut?: string;
      onClick: () => void;
    }> = [
      {
        label: "Appearance",
        shortcut: "Ctrl+,",
        onClick: onAppearance,
      },
    ];
    if (onAiSettings) {
      actions.push({ label: "AI keys", onClick: onAiSettings });
    }
    actions.push({ label: "Help", shortcut: "Ctrl+H", onClick: onHelp });
    return actions;
  }, [onAiSettings, onAppearance, onHelp]);

  const toolActions = useMemo(() => {
    const actions: Array<{
      label: string;
      shortcut?: string;
      onClick: () => void;
    }> = [];
    if (onAssistant) {
      actions.push({
        label: "Assistant",
        shortcut: "Ctrl+Shift+A",
        onClick: onAssistant,
      });
    }
    if (onGrok) {
      actions.push({
        label: "DSA coach",
        shortcut: "Ctrl+G",
        onClick: onGrok,
      });
    }
    if (onVisualize) {
      actions.push({
        label: "Visualize",
        shortcut: "Ctrl+Shift+V",
        onClick: onVisualize,
      });
    }
    return actions;
  }, [onAssistant, onGrok, onVisualize]);

  const fileActions = useMemo(() => {
    const actions: Array<{
      label: string;
      shortcut?: string;
      onClick: () => void;
    }> = [];
    if (editing) {
      actions.push({
        label: "Back to CLI",
        shortcut: "Esc",
        onClick: onBackToCli,
      });
    } else if (canResumeEditor && onResumeEditor) {
      actions.push({ label: "Resume editor", onClick: onResumeEditor });
    }
    if (editing && onCloneTab) {
      actions.push({
        label: "Clone tab",
        shortcut: "Ctrl+Shift+C",
        onClick: onCloneTab,
      });
    }
    actions.push(
      { label: "Save", shortcut: "Ctrl+S", onClick: onSave },
      { label: "Build", shortcut: "Ctrl+B", onClick: onBuild },
      { label: "Run", shortcut: "Ctrl+R", onClick: onRun },
    );
    if (canArchive) {
      actions.push({ label: "Archive note", onClick: onArchive });
    }
    return actions;
  }, [
    canArchive,
    canResumeEditor,
    editing,
    onArchive,
    onBackToCli,
    onBuild,
    onCloneTab,
    onResumeEditor,
    onRun,
    onSave,
  ]);

  const editActions = useMemo(
    () => [
      {
        label: "Undo",
        shortcut: "Ctrl+Z",
        onClick: () => onEditorCommand("undo"),
      },
      {
        label: "Redo",
        shortcut: "Ctrl+Shift+Z",
        onClick: () => onEditorCommand("redo"),
      },
      {
        label: "Find",
        shortcut: "Ctrl+F",
        onClick: () => onEditorCommand("find"),
      },
      {
        label: language === "python" ? "Markdown" : "Python",
        shortcut: "Ctrl+M",
        onClick: () =>
          onLanguageChange(language === "python" ? "markdown" : "python"),
      },
    ],
    [language, onEditorCommand, onLanguageChange],
  );

  return (
    <header className="sticky-header">
      <RecentNotesMenu
        notes={notes}
        onNew={onNew}
        onOpen={onOpenNote}
        onRefresh={onRefreshNotes}
        onNotesLibrary={onNotes}
        fileActions={fileActions}
        editActions={editActions}
        settingsActions={settingsActions}
        toolActions={toolActions}
      />
      <span className="sticky-save-state" data-tauri-drag-region>
        <img
          className="sticky-logo"
          src="/icon.svg"
          width={22}
          height={22}
          alt=""
          draggable={false}
        />
        <span className="sticky-brand">ScratchCLI</span>
        <span
          className="sticky-shell-badge"
          data-shell={shellMode}
          title={shellMode}
        >
          <i className="sticky-shell-dot" aria-hidden="true" />
          <span>{shellLabel}</span>
        </span>
        <span
          className="sticky-mode-badge"
          data-mode={editing ? "editing" : "cli"}
          title={
            editing
              ? "Editor mode — Esc / close returns to CLI"
              : "CLI mode — open a file or note to enter the editor"
          }
        >
          {editing ? "EDITOR" : "CLI"}
        </span>
        {(saveLabel || (editing && title)) && (
          <span className="sticky-path-label">
            {saveLabel ? `${saveLabel} · ` : ""}
            {editing ? title : ""}
          </span>
        )}
      </span>
      <button
        type="button"
        className="sticky-header-button"
        onClick={() => void appWindow.minimize()}
        aria-label="Minimize"
        title="Minimize"
      >
        -
      </button>
      <button
        type="button"
        className="sticky-header-button"
        onClick={() => void appWindow.toggleMaximize()}
        aria-label={maximized ? "Restore" : "Maximize"}
        title={maximized ? "Restore" : "Maximize"}
      >
        {maximized ? "❐" : "□"}
      </button>
      <button
        type="button"
        className="sticky-header-button close"
        onClick={() => onQuit()}
        aria-label="Close"
        title="Close"
      >
        x
      </button>
    </header>
  );
}
