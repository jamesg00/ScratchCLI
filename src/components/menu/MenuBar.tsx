import type { EditorCommand } from "../editor/NoteEditor";
import type { ReactNode } from "react";

type Props = {
  terminalOpen: boolean;
  onNew: () => void;
  onSave: () => void;
  onArchive: () => void;
  onEditorCommand: (command: EditorCommand) => void;
  onAppearance: () => void;
  onAiSettings?: () => void;
  onToggleTerminal: () => void;
  onHelp: () => void;
};

type MenuItemProps = {
  children: ReactNode;
  shortcut?: string;
  onClick: () => void;
};

function MenuItem({ children, shortcut, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(event) => {
        event.currentTarget.closest("details")?.removeAttribute("open");
        onClick();
      }}
    >
      <span>{children}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
}

export function MenuBar({
  terminalOpen,
  onNew,
  onSave,
  onArchive,
  onEditorCommand,
  onAppearance,
  onAiSettings,
  onToggleTerminal,
  onHelp,
}: Props) {
  return (
    <nav className="menu-bar" aria-label="Application menu">
      <details>
        <summary>File</summary>
        <div role="menu">
          <MenuItem shortcut="Ctrl+N" onClick={onNew}>
            New note
          </MenuItem>
          <MenuItem shortcut="Ctrl+S" onClick={onSave}>
            Save
          </MenuItem>
          <MenuItem onClick={onArchive}>Archive note</MenuItem>
        </div>
      </details>
      <details>
        <summary>Edit</summary>
        <div role="menu">
          <MenuItem shortcut="Ctrl+Z" onClick={() => onEditorCommand("undo")}>
            Undo
          </MenuItem>
          <MenuItem
            shortcut="Ctrl+Shift+Z"
            onClick={() => onEditorCommand("redo")}
          >
            Redo
          </MenuItem>
          <hr />
          <MenuItem shortcut="Ctrl+F" onClick={() => onEditorCommand("find")}>
            Find
          </MenuItem>
          <MenuItem
            shortcut="Ctrl+A"
            onClick={() => onEditorCommand("selectAll")}
          >
            Select all
          </MenuItem>
        </div>
      </details>
      <details>
        <summary>Format</summary>
        <div role="menu">
          <MenuItem onClick={onAppearance}>Appearance...</MenuItem>
          {onAiSettings ? (
            <MenuItem onClick={onAiSettings}>AI keys...</MenuItem>
          ) : null}
          <MenuItem onClick={() => onEditorCommand("indent")}>Indent</MenuItem>
          <MenuItem onClick={() => onEditorCommand("outdent")}>
            Outdent
          </MenuItem>
        </div>
      </details>
      <details>
        <summary>View</summary>
        <div role="menu">
          <MenuItem shortcut="Ctrl+`" onClick={onToggleTerminal}>
            {terminalOpen ? "Hide terminal" : "Show terminal"}
          </MenuItem>
          <MenuItem onClick={() => onEditorCommand("focus")}>
            Focus editor
          </MenuItem>
        </div>
      </details>
      <details>
        <summary>Help</summary>
        <div role="menu">
          <MenuItem onClick={onHelp}>Commands and shortcuts</MenuItem>
          <MenuItem onClick={onHelp}>About ScratchCLI</MenuItem>
        </div>
      </details>
      <span className="menu-title">ScratchCLI</span>
    </nav>
  );
}
