use crate::{
    db::{
        models::{CreateNoteInput, Note, NoteListItem, NoteRevision, UpdateNoteInput},
        repository::NoteRepository,
    },
    error::AppError,
};
use tauri::State;

#[tauri::command]
pub async fn create_note(
    repository: State<'_, NoteRepository>,
    input: CreateNoteInput,
) -> Result<Note, AppError> {
    repository.create(input).await.map_err(Into::into)
}

#[tauri::command]
pub async fn search_notes(
    repository: State<'_, NoteRepository>,
    query: String,
) -> Result<Vec<NoteListItem>, AppError> {
    repository.search(&query).await.map_err(Into::into)
}

#[tauri::command]
pub async fn list_deleted_notes(
    repository: State<'_, NoteRepository>,
) -> Result<Vec<NoteListItem>, AppError> {
    repository.list_deleted().await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_note(repository: State<'_, NoteRepository>, id: String) -> Result<Note, AppError> {
    repository.get(&id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn list_notes(
    repository: State<'_, NoteRepository>,
    include_archived: bool,
) -> Result<Vec<NoteListItem>, AppError> {
    repository.list(include_archived).await.map_err(Into::into)
}

#[tauri::command]
pub async fn update_note(
    repository: State<'_, NoteRepository>,
    input: UpdateNoteInput,
) -> Result<Note, AppError> {
    repository.update(input).await.map_err(Into::into)
}

#[tauri::command]
pub async fn archive_note(
    repository: State<'_, NoteRepository>,
    id: String,
    archived: bool,
) -> Result<Note, AppError> {
    repository.archive(&id, archived).await.map_err(Into::into)
}

#[tauri::command]
pub async fn delete_note(
    repository: State<'_, NoteRepository>,
    id: String,
) -> Result<(), AppError> {
    repository.soft_delete(&id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn restore_note(
    repository: State<'_, NoteRepository>,
    id: String,
) -> Result<Note, AppError> {
    repository.restore_deleted(&id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn permanently_delete_note(
    repository: State<'_, NoteRepository>,
    id: String,
) -> Result<(), AppError> {
    repository.permanently_delete(&id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn list_note_revisions(
    repository: State<'_, NoteRepository>,
    note_id: String,
) -> Result<Vec<NoteRevision>, AppError> {
    repository.revisions(&note_id).await.map_err(Into::into)
}
