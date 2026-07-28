use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("{0}")]
    Validation(String),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("Note not found")]
    NotFound,
    #[error("Python was not found")]
    PythonUnavailable,
    #[error("Python execution timed out")]
    PythonTimeout,
    #[error("Python could not be started")]
    PythonExecution,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<HashMap<String, serde_json::Value>>,
}

impl From<CoreError> for AppError {
    fn from(error: CoreError) -> Self {
        match error {
            CoreError::Validation(message) => Self {
                code: "VALIDATION_ERROR",
                message,
                retryable: false,
                details: None,
            },
            CoreError::NotFound => Self {
                code: "VALIDATION_ERROR",
                message: "That note no longer exists.".into(),
                retryable: false,
                details: None,
            },
            CoreError::Database(database_error) => {
                tracing_safe_database_error(&database_error);
                Self {
                    code: "DATABASE_ERROR",
                    message: "ScratchCLI could not access its local database.".into(),
                    retryable: true,
                    details: None,
                }
            }
            CoreError::Io(io_error) => {
                eprintln!("database setup failed: {}", io_error.kind());
                Self {
                    code: "DATABASE_ERROR",
                    message: "ScratchCLI could not prepare local storage.".into(),
                    retryable: true,
                    details: None,
                }
            }
            CoreError::PythonUnavailable => Self {
                code: "PYTHON_ERROR",
                message:
                    "Python was not found. Install Python 3 and ensure py, python, or python3 is available."
                        .into(),
                retryable: false,
                details: None,
            },
            CoreError::PythonTimeout => Self {
                code: "PYTHON_ERROR",
                message: "Python was stopped after the 10-second safety limit.".into(),
                retryable: false,
                details: None,
            },
            CoreError::PythonExecution => Self {
                code: "PYTHON_ERROR",
                message: "Python could not be started on this computer.".into(),
                retryable: true,
                details: None,
            },
        }
    }
}

fn tracing_safe_database_error(error: &sqlx::Error) {
    let category = match error {
        sqlx::Error::RowNotFound => "row_not_found",
        sqlx::Error::Database(_) => "database",
        sqlx::Error::Io(_) => "io",
        sqlx::Error::PoolTimedOut => "pool_timeout",
        _ => "other",
    };
    eprintln!("database operation failed: category={category}");
}
