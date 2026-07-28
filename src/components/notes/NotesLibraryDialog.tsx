import { useEffect, useMemo, useState } from "react";
import { noteService } from "../../services/notes";
import type { NoteColor, NoteListItem, NoteRevision } from "../../types/note";

type View = "notes" | "archive" | "trash";

type Props = {
  initialNotes: NoteListItem[];
  onOpen: (id: string) => void;
  onChanged: () => void;
  onClose: () => void;
  onCliMessage?: (message: string) => void;
  onNoteColorChanged?: (noteId: string, color: NoteColor) => void;
};

const COLORS: NoteColor[] = [
  "yellow",
  "blue",
  "green",
  "pink",
  "purple",
  "gray",
];

function nextColor(current: NoteColor): NoteColor {
  const index = COLORS.indexOf(current);
  return COLORS[(index + 1) % COLORS.length] ?? "yellow";
}

function noteLabel(note: Pick<NoteListItem, "title">): string {
  return note.title.trim() || "Untitled note";
}

export function NotesLibraryDialog({
  initialNotes,
  onOpen,
  onChanged,
  onClose,
  onCliMessage,
  onNoteColorChanged,
}: Props) {
  const [view, setView] = useState<View>("notes");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<NoteListItem[]>(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revisionsFor, setRevisionsFor] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<NoteRevision[]>([]);

  const load = async (nextView = view, search = query) => {
    setBusy(true);
    setError("");
    try {
      if (nextView === "trash") {
        setRows(await noteService.listDeleted());
      } else if (search.trim()) {
        const found = await noteService.search(search);
        setRows(
          found.filter((note) =>
            nextView === "archive" ? note.isArchived : !note.isArchived,
          ),
        );
      } else {
        const all = await noteService.list(true);
        setRows(
          all.filter((note) =>
            nextView === "archive" ? note.isArchived : !note.isArchived,
          ),
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load notes.",
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(() => void load(view, query), 160);
    return () => window.clearTimeout(id);
    // load intentionally follows the selected view and query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, view]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = useMemo(
    () => ({ notes: "Notes", archive: "Archive", trash: "Trash" })[view],
    [view],
  );

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      onChanged();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const showRevisions = async (noteId: string) => {
    setBusy(true);
    setError("");
    try {
      const list = await noteService.revisions(noteId);
      setRevisions(list);
      setRevisionsFor(noteId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load revisions.",
      );
    } finally {
      setBusy(false);
    }
  };

  const restoreRevision = async (revision: NoteRevision) => {
    if (
      !window.confirm(
        `Restore "${revision.title || "Untitled"}" from ${new Date(revision.createdAt).toLocaleString()}?`,
      )
    ) {
      return;
    }
    await act(async () => {
      const full = await noteService.get(revision.noteId);
      await noteService.update({
        id: full.id,
        title: revision.title,
        content: revision.content,
        language: revision.language,
        color: full.color,
        isPinned: full.isPinned,
      });
      setRevisionsFor(null);
    });
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="notes-library"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-library-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>SCRATCHCLI LIBRARY</p>
            <h2 id="notes-library-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <nav aria-label="Note views">
          {(["notes", "archive", "trash"] as const).map((item) => (
            <button
              key={item}
              type="button"
              data-active={view === item}
              onClick={() => {
                setRevisionsFor(null);
                setView(item);
              }}
            >
              {item === "notes"
                ? "Notes"
                : item === "archive"
                  ? "Archive"
                  : "Trash"}
            </button>
          ))}
        </nav>
        {view !== "trash" && (
          <input
            className="notes-library-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles and content…"
            autoFocus
          />
        )}
        {error && <p className="notes-library-error">{error}</p>}
        {revisionsFor ? (
          <div className="notes-library-revisions">
            <div className="notes-library-revisions-head">
              <strong>Revision history</strong>
              <button type="button" onClick={() => setRevisionsFor(null)}>
                Back
              </button>
            </div>
            {revisions.length === 0 ? (
              <div className="notes-library-empty">No revisions yet.</div>
            ) : (
              revisions.map((revision) => (
                <article key={revision.id}>
                  <button
                    type="button"
                    className="notes-library-open"
                    onClick={() => void restoreRevision(revision)}
                  >
                    <strong>
                      {new Date(revision.createdAt).toLocaleString()}
                    </strong>
                    <span>{revision.title.trim() || "Untitled note"}</span>
                    <span>
                      {(revision.content.trim() || "Empty note").slice(0, 160)}
                    </span>
                  </button>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="notes-library-list" aria-busy={busy}>
            {!busy && rows.length === 0 && (
              <div className="notes-library-empty">Nothing here yet.</div>
            )}
            {rows.map((note) => (
              <article key={note.id} data-color={note.color}>
                <button
                  type="button"
                  className="notes-library-open"
                  disabled={view === "trash"}
                  onClick={() => {
                    onOpen(note.id);
                    onClose();
                  }}
                >
                  <strong>
                    {note.isPinned ? "[pin] " : ""}
                    {noteLabel(note)}
                  </strong>
                  <span>{note.content.trim() || "Empty note"}</span>
                </button>
                <div className="notes-library-actions">
                  {view === "notes" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void act(async () => {
                            const full = await noteService.get(note.id);
                            const nextPinned = !full.isPinned;
                            await noteService.update({
                              id: full.id,
                              title: full.title,
                              content: full.content,
                              language: full.language,
                              color: full.color,
                              isPinned: nextPinned,
                            });
                            const name = noteLabel(full);
                            onCliMessage?.(
                              nextPinned
                                ? `pinned "${name}"`
                                : `unpinned "${name}"`,
                            );
                          })
                        }
                      >
                        {note.isPinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        type="button"
                        title={`Color: ${note.color} (click to cycle)`}
                        onClick={() =>
                          void act(async () => {
                            const full = await noteService.get(note.id);
                            const color = nextColor(full.color);
                            await noteService.update({
                              id: full.id,
                              title: full.title,
                              content: full.content,
                              language: full.language,
                              color,
                              isPinned: full.isPinned,
                            });
                            onNoteColorChanged?.(full.id, color);
                          })
                        }
                      >
                        Color
                      </button>
                      <button
                        type="button"
                        onClick={() => void showRevisions(note.id)}
                      >
                        History
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void act(() => noteService.archive(note.id, true))
                        }
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Move "${note.title || "Untitled"}" to Trash?`,
                            )
                          ) {
                            void act(() => noteService.remove(note.id));
                          }
                        }}
                      >
                        Trash
                      </button>
                    </>
                  )}
                  {view === "archive" && (
                    <button
                      type="button"
                      onClick={() =>
                        void act(() => noteService.archive(note.id, false))
                      }
                    >
                      Restore
                    </button>
                  )}
                  {view === "trash" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void act(() => noteService.restore(note.id))
                        }
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Permanently delete "${note.title || "Untitled"}"? This cannot be undone.`,
                            )
                          ) {
                            void act(() =>
                              noteService.permanentlyRemove(note.id),
                            );
                          }
                        }}
                      >
                        Delete forever
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
