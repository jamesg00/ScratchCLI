use crate::error::CoreError;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

const COLORS: [&str; 6] = ["yellow", "blue", "green", "pink", "purple", "gray"];

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub language: String,
    pub color: String,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteListItem {
    pub id: String,
    pub title: String,
    pub content: String,
    pub color: String,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteRevision {
    pub id: String,
    pub note_id: String,
    pub title: String,
    pub content: String,
    pub language: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteInput {
    pub title: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteInput {
    pub id: String,
    pub title: String,
    pub content: String,
    pub language: String,
    pub color: String,
    pub is_pinned: bool,
}

impl CreateNoteInput {
    pub fn validate(&self) -> Result<(), CoreError> {
        if let Some(title) = &self.title {
            validate_title(title)?;
        }
        if let Some(color) = &self.color {
            validate_color(color)?;
        }
        Ok(())
    }
}

impl UpdateNoteInput {
    pub fn validate(&self) -> Result<(), CoreError> {
        if self.id.trim().is_empty() {
            return Err(CoreError::Validation("A note ID is required.".into()));
        }
        validate_title(&self.title)?;
        validate_color(&self.color)?;
        if self.language.trim().is_empty() || self.language.len() > 64 {
            return Err(CoreError::Validation(
                "Language must be between 1 and 64 characters.".into(),
            ));
        }
        if self.content.len() > 2_000_000 {
            return Err(CoreError::Validation(
                "This note is too large to save safely.".into(),
            ));
        }
        Ok(())
    }
}

fn validate_title(title: &str) -> Result<(), CoreError> {
    if title.len() > 500 {
        return Err(CoreError::Validation(
            "Note titles may contain at most 500 characters.".into(),
        ));
    }
    Ok(())
}

fn validate_color(color: &str) -> Result<(), CoreError> {
    if !COLORS.contains(&color) {
        return Err(CoreError::Validation(
            "Choose a supported note color.".into(),
        ));
    }
    Ok(())
}
