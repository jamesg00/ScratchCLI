use super::models::{CreateNoteInput, Note, NoteListItem, NoteRevision, UpdateNoteInput};
use crate::error::CoreError;
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Clone)]
pub struct NoteRepository {
    pool: SqlitePool,
}

impl NoteRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, input: CreateNoteInput) -> Result<Note, CoreError> {
        input.validate()?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let title = input.title.unwrap_or_default();
        let color = input.color.unwrap_or_else(|| "yellow".into());

        sqlx::query(
            "INSERT INTO notes (
                id, title, content, language, color, is_pinned, is_archived,
                created_at, updated_at
             ) VALUES (?, ?, '', 'python', ?, 0, 0, ?, ?)",
        )
        .bind(&id)
        .bind(&title)
        .bind(&color)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;
        sqlx::query("INSERT INTO notes_fts(note_id, title, content) VALUES (?, ?, '')")
            .bind(&id)
            .bind(&title)
            .execute(&self.pool)
            .await?;

        self.get(&id).await
    }

    pub async fn get(&self, id: &str) -> Result<Note, CoreError> {
        let note = sqlx::query_as::<_, Note>(
            "SELECT id, title, content, language, color, is_pinned, is_archived,
                    created_at, updated_at, deleted_at
             FROM notes
             WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(CoreError::NotFound)?;
        Ok(note)
    }

    pub async fn list(&self, include_archived: bool) -> Result<Vec<NoteListItem>, CoreError> {
        let notes = sqlx::query_as::<_, NoteListItem>(
            "SELECT id, title, substr(content, 1, 280) AS content, color,
                    is_pinned, is_archived, created_at, updated_at, deleted_at
             FROM notes
             WHERE deleted_at IS NULL
               AND (? = 1 OR is_archived = 0)
             ORDER BY is_pinned DESC, updated_at DESC
             LIMIT 100",
        )
        .bind(include_archived)
        .fetch_all(&self.pool)
        .await?;
        Ok(notes)
    }

    pub async fn search(&self, query: &str) -> Result<Vec<NoteListItem>, CoreError> {
        let query = query.trim();
        if query.is_empty() {
            return self.list(false).await;
        }
        let fts_query = query
            .split_whitespace()
            .map(|token| format!("\"{}\"*", token.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" AND ");
        let notes = sqlx::query_as::<_, NoteListItem>(
            "SELECT n.id, n.title, substr(n.content, 1, 280) AS content, n.color,
                    n.is_pinned, n.is_archived, n.created_at, n.updated_at, n.deleted_at
             FROM notes_fts f
             JOIN notes n ON n.id = f.note_id
             WHERE notes_fts MATCH ? AND n.deleted_at IS NULL
             ORDER BY rank, n.is_pinned DESC
             LIMIT 100",
        )
        .bind(fts_query)
        .fetch_all(&self.pool)
        .await?;
        Ok(notes)
    }

    pub async fn list_deleted(&self) -> Result<Vec<NoteListItem>, CoreError> {
        Ok(sqlx::query_as::<_, NoteListItem>(
            "SELECT id, title, substr(content, 1, 280) AS content, color,
                    is_pinned, is_archived, created_at, updated_at, deleted_at
             FROM notes
             WHERE deleted_at IS NOT NULL
             ORDER BY deleted_at DESC
             LIMIT 100",
        )
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn update(&self, input: UpdateNoteInput) -> Result<Note, CoreError> {
        input.validate()?;
        let now = Utc::now().to_rfc3339();
        let revision_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO note_revisions (id, note_id, title, content, language, created_at)
             SELECT ?, id, title, content, language, ?
             FROM notes WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(revision_id)
        .bind(&now)
        .bind(&input.id)
        .execute(&self.pool)
        .await?;

        let result = sqlx::query(
            "UPDATE notes
             SET title = ?, content = ?, language = ?, color = ?,
                 is_pinned = ?, updated_at = ?
             WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(&input.title)
        .bind(&input.content)
        .bind(&input.language)
        .bind(&input.color)
        .bind(input.is_pinned)
        .bind(now)
        .bind(&input.id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound);
        }
        sqlx::query("DELETE FROM notes_fts WHERE note_id = ?")
            .bind(&input.id)
            .execute(&self.pool)
            .await?;
        sqlx::query("INSERT INTO notes_fts(note_id, title, content) VALUES (?, ?, ?)")
            .bind(&input.id)
            .bind(&input.title)
            .bind(&input.content)
            .execute(&self.pool)
            .await?;
        self.get(&input.id).await
    }

    pub async fn archive(&self, id: &str, archived: bool) -> Result<Note, CoreError> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            "UPDATE notes
             SET is_archived = ?, updated_at = ?
             WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(archived)
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound);
        }
        self.get(id).await
    }

    pub async fn soft_delete(&self, id: &str) -> Result<(), CoreError> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            "UPDATE notes
             SET deleted_at = ?, updated_at = ?
             WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(&now)
        .bind(&now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound);
        }
        Ok(())
    }

    pub async fn restore_deleted(&self, id: &str) -> Result<Note, CoreError> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            "UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL",
        )
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound);
        }
        self.get(id).await
    }

    pub async fn permanently_delete(&self, id: &str) -> Result<(), CoreError> {
        sqlx::query("DELETE FROM notes_fts WHERE note_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        let result = sqlx::query("DELETE FROM notes WHERE id = ? AND deleted_at IS NOT NULL")
            .bind(id)
            .execute(&self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound);
        }
        Ok(())
    }

    pub async fn revisions(&self, note_id: &str) -> Result<Vec<NoteRevision>, CoreError> {
        Ok(sqlx::query_as::<_, NoteRevision>(
            "SELECT id, note_id, title, content, language, created_at
             FROM note_revisions WHERE note_id = ? ORDER BY created_at DESC LIMIT 50",
        )
        .bind(note_id)
        .fetch_all(&self.pool)
        .await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn repository() -> NoteRepository {
        let pool = db::connect(std::path::Path::new(":memory:"))
            .await
            .expect("in-memory database should initialize");
        NoteRepository::new(pool)
    }

    #[tokio::test]
    async fn creates_updates_and_lists_a_note() {
        let repository = repository().await;
        let created = repository
            .create(CreateNoteInput::default())
            .await
            .expect("note should be created");

        let updated = repository
            .update(UpdateNoteInput {
                id: created.id.clone(),
                title: "Repository test".into(),
                content: "persisted content".into(),
                language: "markdown".into(),
                color: "blue".into(),
                is_pinned: true,
            })
            .await
            .expect("note should be updated");

        assert_eq!(updated.content, "persisted content");
        let listed = repository.list(false).await.expect("notes should list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].title, "Repository test");
        let found = repository
            .search("persisted")
            .await
            .expect("notes should be searchable");
        assert_eq!(found.len(), 1);
        let revisions = repository
            .revisions(&created.id)
            .await
            .expect("revisions should list");
        assert_eq!(revisions.len(), 1);
    }

    #[tokio::test]
    async fn delete_is_soft_and_hides_the_note() {
        let repository = repository().await;
        let note = repository
            .create(CreateNoteInput::default())
            .await
            .expect("note should be created");

        repository
            .soft_delete(&note.id)
            .await
            .expect("note should be soft deleted");

        assert!(matches!(
            repository.get(&note.id).await,
            Err(CoreError::NotFound)
        ));
        assert_eq!(
            repository
                .list_deleted()
                .await
                .expect("trash should list")
                .len(),
            1
        );
        repository
            .restore_deleted(&note.id)
            .await
            .expect("note should restore");
        repository
            .soft_delete(&note.id)
            .await
            .expect("note should return to trash");
        repository
            .permanently_delete(&note.id)
            .await
            .expect("note should permanently delete");
        assert!(repository
            .list_deleted()
            .await
            .expect("trash should list")
            .is_empty());
    }
}
