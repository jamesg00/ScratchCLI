use crate::error::{AppError, CoreError};
use serde::Serialize;
use std::{
    io::ErrorKind,
    path::Path,
    process::Stdio,
    time::{Duration, Instant},
};
use tokio::{process::Command, time::timeout};

const MAX_CODE_BYTES: usize = 200_000;
const MAX_OUTPUT_BYTES: usize = 65_536;
const EXECUTION_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonExecutionResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    duration_ms: u64,
    truncated: bool,
}

#[tauri::command]
pub async fn execute_python(
    code: String,
    mode: String,
    cwd: Option<String>,
) -> Result<PythonExecutionResult, AppError> {
    if code.len() > MAX_CODE_BYTES {
        return Err(AppError {
            code: "VALIDATION_ERROR",
            message: "Python execution is limited to 200 KB per note.".into(),
            retryable: false,
            details: None,
        });
    }
    if mode != "run" && mode != "build" {
        return Err(CoreError::Validation("Mode must be run or build.".into()).into());
    }

    let (directory, path) = prepare_python_file(code).map_err(AppError::from)?;
    run_file(directory, path, mode, cwd)
        .await
        .map_err(Into::into)
}

fn prepare_python_file(code: String) -> Result<(tempfile::TempDir, std::path::PathBuf), CoreError> {
    let directory = tempfile::Builder::new()
        .prefix("scratchcli-python-")
        .tempdir()
        .map_err(|_| CoreError::PythonExecution)?;
    let path = directory.path().join("main.py");
    std::fs::write(&path, code).map_err(|_| CoreError::PythonExecution)?;
    Ok((directory, path))
}

async fn run_file(
    _directory: tempfile::TempDir,
    path: std::path::PathBuf,
    mode: String,
    cwd: Option<String>,
) -> Result<PythonExecutionResult, CoreError> {
    let candidates: [(&str, &[&str]); 3] = [("py", &["-3"]), ("python", &[]), ("python3", &[])];

    for (executable, prefix_args) in candidates {
        match run_candidate(executable, prefix_args, &path, &mode, cwd.as_deref()).await {
            Ok(result) => return Ok(result),
            Err(CandidateError::NotFound) => continue,
            Err(CandidateError::Timeout) => return Err(CoreError::PythonTimeout),
            Err(CandidateError::Start) => return Err(CoreError::PythonExecution),
        }
    }

    Err(CoreError::PythonUnavailable)
}

enum CandidateError {
    NotFound,
    Timeout,
    Start,
}

async fn run_candidate(
    executable: &str,
    prefix_args: &[&str],
    path: &Path,
    mode: &str,
    cwd: Option<&str>,
) -> Result<PythonExecutionResult, CandidateError> {
    let mut command = Command::new(executable);
    // Use normal system Python (PATH + site-packages) so pip-installed packages work.
    command
        .args(prefix_args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    if let Some(dir) = cwd.filter(|value| !value.is_empty()) {
        command.current_dir(dir);
    }

    if mode == "build" {
        command.args(["-m", "py_compile"]).arg(path);
    } else {
        command.arg(path);
    }

    let started = Instant::now();
    let output = match timeout(EXECUTION_TIMEOUT, command.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(error)) if error.kind() == ErrorKind::NotFound => {
            return Err(CandidateError::NotFound)
        }
        Ok(Err(_)) => return Err(CandidateError::Start),
        Err(_) => return Err(CandidateError::Timeout),
    };

    let stdout_truncated = output.stdout.len() > MAX_OUTPUT_BYTES;
    let stderr_truncated = output.stderr.len() > MAX_OUTPUT_BYTES;
    let stdout =
        String::from_utf8_lossy(&output.stdout[..output.stdout.len().min(MAX_OUTPUT_BYTES)])
            .into_owned();
    let stderr =
        String::from_utf8_lossy(&output.stderr[..output.stderr.len().min(MAX_OUTPUT_BYTES)])
            .into_owned();

    Ok(PythonExecutionResult {
        stdout,
        stderr,
        exit_code: output.status.code(),
        duration_ms: started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64,
        truncated: stdout_truncated || stderr_truncated,
    })
}
