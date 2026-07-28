PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'markdown',
    color TEXT NOT NULL DEFAULT 'yellow'
        CHECK (color IN ('yellow', 'blue', 'green', 'pink', 'purple', 'gray')),
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_active_updated
    ON notes (is_archived, updated_at DESC)
    WHERE deleted_at IS NULL;
