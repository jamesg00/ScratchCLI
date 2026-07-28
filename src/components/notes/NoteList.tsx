import type { NoteListItem } from "../../types/note";

type Props = {
  notes: NoteListItem[];
  activeId?: string;
  loading: boolean;
  onSelect: (id: string) => void;
};

const relativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

function formatUpdated(iso: string) {
  const deltaMinutes = Math.round(
    (new Date(iso).getTime() - Date.now()) / 60_000,
  );
  if (Math.abs(deltaMinutes) < 60)
    return relativeTime.format(deltaMinutes, "minute");
  const deltaDays = Math.round(deltaMinutes / 1_440);
  if (Math.abs(deltaDays) < 7) return relativeTime.format(deltaDays, "day");
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function NoteList({ notes, activeId, loading, onSelect }: Props) {
  if (loading && notes.length === 0) {
    return <p className="list-message">Loading notes…</p>;
  }

  if (notes.length === 0) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">✦</span>
        <p>No notes yet</p>
        <small>Create one and jot something down.</small>
      </div>
    );
  }

  return (
    <nav className="note-list" aria-label="Notes">
      {notes.map((note) => (
        <button
          className="note-card"
          data-active={note.id === activeId}
          data-color={note.color}
          key={note.id}
          type="button"
          onClick={() => onSelect(note.id)}
        >
          <strong>{note.title.trim() || "Untitled note"}</strong>
          <span>{note.content.trim() || "Empty note"}</span>
          <time dateTime={note.updatedAt}>{formatUpdated(note.updatedAt)}</time>
        </button>
      ))}
    </nav>
  );
}
