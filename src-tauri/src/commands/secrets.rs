//! App-data secret store for API keys (not Zustand / not workspace JSON).

use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Default, Serialize, Deserialize)]
struct SecretStore {
    keys: HashMap<String, String>,
}

fn secrets_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app.path().app_data_dir().map_err(|error| AppError {
        code: "SECRETS_ERROR",
        message: format!("Could not resolve app data dir: {error}"),
        retryable: false,
        details: None,
    })?;
    fs::create_dir_all(&dir).map_err(|error| AppError {
        code: "SECRETS_ERROR",
        message: format!("Could not create app data dir: {error}"),
        retryable: false,
        details: None,
    })?;
    Ok(dir.join("secrets.json"))
}

fn load_store(path: &PathBuf) -> Result<SecretStore, AppError> {
    if !path.exists() {
        return Ok(SecretStore::default());
    }
    let raw = fs::read_to_string(path).map_err(|error| AppError {
        code: "SECRETS_ERROR",
        message: format!("Could not read secrets: {error}"),
        retryable: false,
        details: None,
    })?;
    if raw.trim().is_empty() {
        return Ok(SecretStore::default());
    }
    serde_json::from_str(&raw).map_err(|error| AppError {
        code: "SECRETS_ERROR",
        message: format!("Secrets file is corrupt: {error}"),
        retryable: false,
        details: None,
    })
}

fn save_store(path: &PathBuf, store: &SecretStore) -> Result<(), AppError> {
    let raw = serde_json::to_string_pretty(store).map_err(|error| AppError {
        code: "SECRETS_ERROR",
        message: format!("Could not serialize secrets: {error}"),
        retryable: false,
        details: None,
    })?;
    fs::write(path, raw).map_err(|error| AppError {
        code: "SECRETS_ERROR",
        message: format!("Could not write secrets: {error}"),
        retryable: false,
        details: None,
    })?;
    Ok(())
}

fn normalize_provider(provider: &str) -> Result<String, AppError> {
    let value = provider.trim().to_ascii_lowercase();
    match value.as_str() {
        "ollama" | "lmstudio" | "xai" | "openai" | "anthropic" | "grok" => {
            Ok(if value == "grok" {
                "xai".into()
            } else {
                value
            })
        }
        _ => Err(AppError {
            code: "SECRETS_ERROR",
            message: format!("Unknown provider for secrets: {provider}"),
            retryable: false,
            details: None,
        }),
    }
}

#[tauri::command]
pub fn secrets_get(app: AppHandle, provider: String) -> Result<Option<String>, AppError> {
    let key = normalize_provider(&provider)?;
    let path = secrets_path(&app)?;
    let store = load_store(&path)?;
    Ok(store.keys.get(&key).cloned().filter(|value| !value.trim().is_empty()))
}

#[tauri::command]
pub fn secrets_set(app: AppHandle, provider: String, value: String) -> Result<(), AppError> {
    let key = normalize_provider(&provider)?;
    let path = secrets_path(&app)?;
    let mut store = load_store(&path)?;
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        store.keys.remove(&key);
    } else {
        store.keys.insert(key, trimmed);
    }
    save_store(&path, &store)
}

#[tauri::command]
pub fn secrets_list_providers(app: AppHandle) -> Result<Vec<String>, AppError> {
    let path = secrets_path(&app)?;
    let store = load_store(&path)?;
    let mut keys: Vec<String> = store
        .keys
        .into_iter()
        .filter(|(_, value)| !value.trim().is_empty())
        .map(|(key, _)| key)
        .collect();
    keys.sort();
    Ok(keys)
}
