import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NoteListItem } from "../../types/note";

type MenuAction = {
  label: string;
  shortcut?: string;
  onClick: () => void;
};

type Props = {
  notes: NoteListItem[];
  onNew: () => void;
  onOpen: (noteId: string) => void;
  onRefresh?: () => void;
  onNotesLibrary: () => void;
  fileActions: MenuAction[];
  editActions: MenuAction[];
  settingsActions: MenuAction[];
  toolActions: MenuAction[];
};

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.max(1, Math.round(seconds / 3600))}h ago`;
  if (seconds < 86400 * 7)
    return `${Math.max(1, Math.round(seconds / 86400))}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function previewText(content: string): string {
  const cleaned = content
    .replace(/\r\n/g, "\n")
    .replace(/^#!\s+/gm, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Empty note";
  return cleaned.length > 88 ? `${cleaned.slice(0, 88)}…` : cleaned;
}

function noteTitle(note: NoteListItem): string {
  const title = note.title.trim();
  if (title && title.toLowerCase() !== "untitled") return title;
  const first = note.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!first) return "Untitled note";
  return first.replace(/^#+\s*/, "").slice(0, 48) || "Untitled note";
}

function MenuSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="app-menu-section">
      <h3>{label}</h3>
      {children}
    </section>
  );
}

export function RecentNotesMenu({
  notes,
  onNew,
  onOpen,
  onRefresh,
  onNotesLibrary,
  fileActions,
  editActions,
  settingsActions,
  toolActions,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const recent = useMemo(() => {
    return [...notes]
      .filter((note) => !note.isArchived)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      })
      .slice(0, 10);
  }, [notes]);

  const close = () => setOpen(false);

  const run = (action: () => void) => {
    close();
    // Let the menu finish closing before opening a dialog. This keeps the
    // dialog above the menu and avoids a competing title-bar interaction.
    window.requestAnimationFrame(action);
  };

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      if (next) onRefresh?.();
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      const target = event.target;
      if (target instanceof Node && root?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="recent-notes-menu"
      data-open={open ? "1" : "0"}
    >
      <button
        type="button"
        className="sticky-header-button recent-notes-trigger"
        aria-label="Menu"
        title="Menu"
        aria-expanded={open}
        aria-controls="app-menu-panel"
        onClick={toggle}
      >
        <span className="recent-notes-bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
      <div
        className="recent-notes-shell"
        data-open={open ? "1" : "0"}
      >
        <div className="recent-notes-clip">
          <div
            id="app-menu-panel"
            className="recent-notes-panel app-menu-panel"
            role="menu"
            aria-label="Menu"
            aria-hidden={!open}
          >
            {settingsActions.length > 0 && (
              <MenuSection label="Settings">
                {settingsActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="app-menu-item"
                    role="menuitem"
                    tabIndex={open ? 0 : -1}
                    onClick={() => run(action.onClick)}
                  >
                    <span>{action.label}</span>
                    {action.shortcut ? <kbd>{action.shortcut}</kbd> : null}
                  </button>
                ))}
              </MenuSection>
            )}

            <MenuSection label="Notes">
              <header className="recent-notes-head">
                <div>
                  <strong>Recent</strong>
                  <span>Pinned first</span>
                </div>
                <div className="app-menu-note-actions">
                  <button
                    type="button"
                    className="recent-notes-new"
                    onClick={() => run(onNew)}
                  >
                    + New
                  </button>
                  <button
                    type="button"
                    className="recent-notes-new"
                    onClick={() => run(onNotesLibrary)}
                  >
                    Library
                  </button>
                </div>
              </header>
              <div className="recent-notes-list">
                {recent.length === 0 ? (
                  <div className="recent-notes-empty">
                    <p>No notes yet</p>
                    <button type="button" onClick={() => run(onNew)}>
                      Create note
                    </button>
                  </div>
                ) : (
                  recent.map((note, index) => (
                    <button
                      key={note.id}
                      type="button"
                      className="recent-notes-item"
                      data-color={note.color}
                      style={{ animationDelay: `${index * 28}ms` }}
                      role="menuitem"
                      tabIndex={open ? 0 : -1}
                      onClick={() => run(() => onOpen(note.id))}
                    >
                      <span className="recent-notes-swatch" aria-hidden="true" />
                      <span className="recent-notes-body">
                        <span className="recent-notes-title-row">
                          <span className="recent-notes-title">
                            {note.isPinned ? "[pin] " : ""}
                            {noteTitle(note)}
                          </span>
                          <time dateTime={note.updatedAt}>
                            {relativeTime(note.updatedAt)}
                          </time>
                        </span>
                        <span className="recent-notes-preview">
                          {previewText(note.content)}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </MenuSection>

            {fileActions.length > 0 && (
              <MenuSection label="File">
                {fileActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="app-menu-item"
                    role="menuitem"
                    tabIndex={open ? 0 : -1}
                    onClick={() => run(action.onClick)}
                  >
                    <span>{action.label}</span>
                    {action.shortcut ? <kbd>{action.shortcut}</kbd> : null}
                  </button>
                ))}
              </MenuSection>
            )}

            {editActions.length > 0 && (
              <MenuSection label="Edit">
                {editActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="app-menu-item"
                    role="menuitem"
                    tabIndex={open ? 0 : -1}
                    onClick={() => run(action.onClick)}
                  >
                    <span>{action.label}</span>
                    {action.shortcut ? <kbd>{action.shortcut}</kbd> : null}
                  </button>
                ))}
              </MenuSection>
            )}

            {toolActions.length > 0 && (
              <MenuSection label="Tools">
                {toolActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="app-menu-item"
                    role="menuitem"
                    tabIndex={open ? 0 : -1}
                    onClick={() => run(action.onClick)}
                  >
                    <span>{action.label}</span>
                    {action.shortcut ? <kbd>{action.shortcut}</kbd> : null}
                  </button>
                ))}
              </MenuSection>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
