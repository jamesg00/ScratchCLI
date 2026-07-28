use crate::error::{AppError, CoreError};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const MAX_TEXT_BYTES: usize = 2_000_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFileResult {
    path: String,
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontInfo {
    family: String,
    path: String,
    file_name: String,
}

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<TextFileResult, AppError> {
    let resolved = resolve_existing_file(&path)?;
    let bytes = std::fs::read(&resolved).map_err(|error| map_io(error, &resolved))?;
    if bytes.len() > MAX_TEXT_BYTES {
        return Err(
            CoreError::Validation("Text files larger than 2 MB cannot be opened.".into()).into(),
        );
    }
    let content = String::from_utf8(bytes)
        .map_err(|_| CoreError::Validation("That file is not valid UTF-8 text.".into()))?;
    Ok(TextFileResult {
        path: resolved.to_string_lossy().into_owned(),
        content,
    })
}

#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> Result<TextFileResult, AppError> {
    if content.len() > MAX_TEXT_BYTES {
        return Err(
            CoreError::Validation("Text files larger than 2 MB cannot be saved.".into()).into(),
        );
    }
    let resolved = resolve_write_path(&path)?;
    if let Some(parent) = resolved.parent() {
        std::fs::create_dir_all(parent).map_err(|error| map_io(error, parent))?;
    }
    std::fs::write(&resolved, content.as_bytes()).map_err(|error| map_io(error, &resolved))?;
    Ok(TextFileResult {
        path: resolved.to_string_lossy().into_owned(),
        content,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemovePathResult {
    path: String,
    kind: String,
}

#[tauri::command]
pub async fn remove_path(path: String) -> Result<RemovePathResult, AppError> {
    let resolved = PathBuf::from(&path);
    if !resolved.exists() {
        return Err(CoreError::Validation(format!("Path not found: {path}")).into());
    }
    if resolved.is_dir() {
        std::fs::remove_dir_all(&resolved).map_err(|error| map_io(error, &resolved))?;
        return Ok(RemovePathResult {
            path: resolved.to_string_lossy().into_owned(),
            kind: "directory".into(),
        });
    }
    if resolved.is_file() {
        std::fs::remove_file(&resolved).map_err(|error| map_io(error, &resolved))?;
        return Ok(RemovePathResult {
            path: resolved.to_string_lossy().into_owned(),
            kind: "file".into(),
        });
    }
    Err(CoreError::Validation(format!("Cannot remove path: {path}")).into())
}

#[tauri::command]
pub async fn create_directory(path: String) -> Result<String, AppError> {
    let resolved = PathBuf::from(&path);
    if resolved.exists() {
        if resolved.is_dir() {
            return Ok(resolved.to_string_lossy().into_owned());
        }
        return Err(CoreError::Validation(format!("A file already exists at {path}")).into());
    }
    std::fs::create_dir_all(&resolved).map_err(|error| map_io(error, &resolved))?;
    Ok(resolved.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn create_file(path: String) -> Result<String, AppError> {
    let resolved = PathBuf::from(&path);
    if resolved.exists() {
        if resolved.is_file() {
            return Ok(resolved.to_string_lossy().into_owned());
        }
        return Err(CoreError::Validation(format!("A directory already exists at {path}")).into());
    }
    if let Some(parent) = resolved.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|error| map_io(error, parent))?;
        }
    }
    std::fs::write(&resolved, b"").map_err(|error| map_io(error, &resolved))?;
    Ok(resolved.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<DirEntry>, AppError> {
    let resolved = resolve_existing_dir(&path)?;
    let mut entries = Vec::new();
    let read = std::fs::read_dir(&resolved).map_err(|error| map_io(error, &resolved))?;
    for entry in read {
        let entry = entry.map_err(|error| map_io(error, &resolved))?;
        let meta = entry
            .metadata()
            .map_err(|error| map_io(error, &entry.path()))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        entries.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().into_owned(),
            is_dir: meta.is_dir(),
        });
    }
    entries.sort_by_key(|entry| entry.name.to_lowercase());
    Ok(entries)
}

#[tauri::command]
pub async fn resolve_path(cwd: String, path: String) -> Result<String, AppError> {
    Ok(join_cwd(&cwd, &path)?.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn default_cwd() -> Result<String, AppError> {
    std::env::current_dir()
        .or_else(|_| dirs_home())
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|_| {
            CoreError::Validation("Could not determine the starting directory.".into()).into()
        })
}

#[tauri::command]
pub async fn list_user_fonts(app: AppHandle) -> Result<Vec<FontInfo>, AppError> {
    let dir = fonts_dir(&app)?;
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut fonts = Vec::new();
    let read = std::fs::read_dir(&dir).map_err(|error| map_io(error, &dir))?;
    for entry in read {
        let entry = entry.map_err(|error| map_io(error, &dir))?;
        let path = entry.path();
        if !is_font_file(&path) {
            continue;
        }
        let file_name = path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_default();
        fonts.push(FontInfo {
            family: font_family_from_name(&file_name),
            path: path.to_string_lossy().into_owned(),
            file_name,
        });
    }
    fonts.sort_by_key(|font| font.family.to_lowercase());
    Ok(fonts)
}

#[tauri::command]
pub async fn add_user_font(app: AppHandle, source_path: String) -> Result<FontInfo, AppError> {
    let source = resolve_existing_file(&source_path)?;
    if !is_font_file(&source) {
        return Err(
            CoreError::Validation("Font files must be .ttf, .otf, or .woff2.".into()).into(),
        );
    }
    let dir = fonts_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|error| map_io(error, &dir))?;
    let file_name = source
        .file_name()
        .ok_or_else(|| CoreError::Validation("Invalid font file name.".into()))?
        .to_owned();
    let destination = dir.join(&file_name);
    std::fs::copy(&source, &destination).map_err(|error| map_io(error, &destination))?;
    let file_name = file_name.to_string_lossy().into_owned();
    Ok(FontInfo {
        family: font_family_from_name(&file_name),
        path: destination.to_string_lossy().into_owned(),
        file_name,
    })
}

fn fonts_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| CoreError::Validation("Could not resolve app data directory.".into()))?
        .join("fonts");
    Ok(dir)
}

fn dirs_home() -> Result<PathBuf, std::io::Error> {
    if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        return Ok(PathBuf::from(home));
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "home not found",
    ))
}

fn resolve_existing_file(path: &str) -> Result<PathBuf, AppError> {
    let resolved = PathBuf::from(path);
    if !resolved.exists() {
        return Err(CoreError::Validation(format!("File not found: {path}")).into());
    }
    if !resolved.is_file() {
        return Err(CoreError::Validation(format!("Not a file: {path}")).into());
    }
    Ok(resolved)
}

fn resolve_existing_dir(path: &str) -> Result<PathBuf, AppError> {
    let resolved = PathBuf::from(path);
    if !resolved.exists() {
        return Err(CoreError::Validation(format!("Directory not found: {path}")).into());
    }
    if !resolved.is_dir() {
        return Err(CoreError::Validation(format!("Not a directory: {path}")).into());
    }
    Ok(resolved)
}

fn resolve_write_path(path: &str) -> Result<PathBuf, AppError> {
    let resolved = PathBuf::from(path);
    if resolved.exists() && resolved.is_dir() {
        return Err(CoreError::Validation(format!("Path is a directory: {path}")).into());
    }
    Ok(resolved)
}

fn join_cwd(cwd: &str, path: &str) -> Result<PathBuf, AppError> {
    let candidate = PathBuf::from(path);
    if candidate.is_absolute() {
        return Ok(normalize_path(&candidate));
    }
    Ok(normalize_path(&PathBuf::from(cwd).join(candidate)))
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                out.pop();
            }
            std::path::Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

fn is_font_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_ascii_lowercase())
            .as_deref(),
        Some("ttf" | "otf" | "woff2")
    )
}

fn font_family_from_name(file_name: &str) -> String {
    let stem = Path::new(file_name)
        .file_stem()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| file_name.to_string());
    stem.replace(['_', '-'], " ")
}

fn map_io(error: std::io::Error, path: &Path) -> AppError {
    CoreError::Validation(format!(
        "Could not access {}: {}",
        path.to_string_lossy(),
        error.kind()
    ))
    .into()
}
