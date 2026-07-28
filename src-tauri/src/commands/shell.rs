use crate::error::AppError;
use serde::Serialize;
use std::{
    io::ErrorKind,
    process::Stdio,
    time::{Duration, Instant},
};
use tokio::{process::Command, time::timeout};

const MAX_COMMAND_BYTES: usize = 32_768;
const MAX_OUTPUT_BYTES: usize = 65_536;
const EXECUTION_TIMEOUT: Duration = Duration::from_secs(120);
const EXECUTION_TIMEOUT_SECS: u64 = 120;

/// Tools that need a real TTY / interactive stdin — not compatible with piped capture.
const INTERACTIVE_COMMANDS: &[&str] = &[
    "claude",
    "codex",
    "vim",
    "nvim",
    "nano",
    "vi",
    "less",
    "more",
    "top",
    "htop",
    "ssh",
    "tmux",
    "screen",
    "watch",
    "gdb",
    "lldb",
    "python",
    "python3",
    "py",
    "node",
    "irb",
    "psql",
    "mysql",
    "mongo",
    "redis-cli",
    "cacafire",
    "cmatrix",
    "asciiquarium",
    "sl",
    "nyancat",
    "hollywood",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellExecutionResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    duration_ms: u64,
    truncated: bool,
    executable: String,
}

#[tauri::command]
pub async fn execute_local_shell(
    shell: String,
    command: String,
    cwd: Option<String>,
) -> Result<ShellExecutionResult, AppError> {
    if command.trim().is_empty() {
        return Err(shell_error("Enter a command to run.", false));
    }
    if command.len() > MAX_COMMAND_BYTES {
        return Err(shell_error(
            "Local shell commands are limited to 32 KB.",
            false,
        ));
    }

    // Interactive TUIs need a PTY — the frontend hosts them via start_pty_session.
    if looks_interactive(&command) {
        return Err(AppError {
            code: "NEEDS_PTY",
            message: "This command needs an interactive terminal session.".into(),
            retryable: false,
            details: None,
        });
    }

    let candidates: Vec<(&str, Vec<&str>)> = match shell.as_str() {
        "powershell" => vec![
            (
                "pwsh.exe",
                vec!["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"],
            ),
            (
                "powershell.exe",
                vec!["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"],
            ),
        ],
        "cmd" => vec![("cmd.exe", vec!["/D", "/S", "/C"])],
        // Use the default distro login shell via bash -lc (better PATH / profile).
        "wsl" => vec![("wsl.exe", vec!["-e", "bash", "-lc"])],
        _ => return Err(shell_error("Shell must be powershell, cmd, or wsl.", false)),
    };

    for (executable, arguments) in candidates {
        match run_candidate(executable, &arguments, &command, cwd.as_deref()).await {
            Ok(result) => {
                if looks_like_tty_error(&result) {
                    return Err(AppError {
                        code: "NEEDS_PTY",
                        message: "This command needs an interactive terminal session.".into(),
                        retryable: false,
                        details: None,
                    });
                }
                return Ok(result);
            }
            Err(CandidateError::NotFound) => continue,
            Err(CandidateError::Timeout) => {
                return Err(shell_error(
                    &format!(
                        "The local command was stopped after the {EXECUTION_TIMEOUT_SECS}-second safety limit."
                    ),
                    false,
                ))
            }
            Err(CandidateError::Start) => {
                return Err(shell_error("The local shell could not be started.", true))
            }
        }
    }

    let message = match shell.as_str() {
        "powershell" => {
            "PowerShell was not found. Install PowerShell 7 or enable Windows PowerShell."
        }
        "cmd" => "Command Prompt was not found on this Windows installation.",
        "wsl" => "WSL was not found. Install WSL and at least one Linux distribution.",
        _ => "The requested local shell was not found.",
    };
    Err(shell_error(message, false))
}

enum CandidateError {
    NotFound,
    Timeout,
    Start,
}

fn command_basename(command: &str) -> String {
    let token = command
        .trim()
        .trim_start_matches("sudo ")
        .split_whitespace()
        .next()
        .unwrap_or("")
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    token
}

fn looks_interactive(command: &str) -> bool {
    let base = command_basename(command);
    if !INTERACTIVE_COMMANDS.contains(&base.as_str()) {
        return false;
    }
    // One-shot python/node invocations are fine to capture.
    if matches!(base.as_str(), "python" | "python3" | "py" | "node") {
        let lower = command.to_ascii_lowercase();
        if lower.contains(" -c ")
            || lower.contains(" -m ")
            || lower.contains(" --version")
            || lower.contains(" -v")
            || lower.ends_with(".py")
            || lower.ends_with(".js")
            || lower.ends_with(".mjs")
        {
            return false;
        }
        // Bare `python` / `py` / `node` = REPL → PTY.
        return command.split_whitespace().count() <= 1;
    }
    true
}

fn looks_like_tty_error(result: &ShellExecutionResult) -> bool {
    let text = format!("{}{}", result.stderr, result.stdout).to_ascii_lowercase();
    text.contains("stdin is not a terminal")
        || text.contains("not a tty")
        || text.contains("not a terminal")
        || text.contains("pseudoterminal")
        || text.contains("raw mode is not supported")
}

#[tauri::command]
pub fn shell_needs_pty(command: String) -> bool {
    looks_interactive(&command)
}

async fn run_candidate(
    executable: &str,
    arguments: &[&str],
    input: &str,
    cwd: Option<&str>,
) -> Result<ShellExecutionResult, CandidateError> {
    let mut process = Command::new(executable);
    process
        .args(arguments)
        .arg(input)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    if let Some(dir) = cwd.filter(|value| !value.is_empty()) {
        process.current_dir(dir);
    }

    #[cfg(target_os = "windows")]
    process.creation_flags(0x0800_0000);

    let started = Instant::now();
    let output = match timeout(EXECUTION_TIMEOUT, process.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(error)) if error.kind() == ErrorKind::NotFound => {
            return Err(CandidateError::NotFound)
        }
        Ok(Err(_)) => return Err(CandidateError::Start),
        Err(_) => return Err(CandidateError::Timeout),
    };

    let stdout_truncated = output.stdout.len() > MAX_OUTPUT_BYTES;
    let stderr_truncated = output.stderr.len() > MAX_OUTPUT_BYTES;

    Ok(ShellExecutionResult {
        stdout: decode_output(&output.stdout),
        stderr: decode_output(&output.stderr),
        exit_code: output.status.code(),
        duration_ms: started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64,
        truncated: stdout_truncated || stderr_truncated,
        executable: executable.to_string(),
    })
}

fn decode_output(bytes: &[u8]) -> String {
    let limited = &bytes[..bytes.len().min(MAX_OUTPUT_BYTES)];
    let looks_utf16_le = limited.len() >= 4
        && limited
            .iter()
            .skip(1)
            .step_by(2)
            .filter(|byte| **byte == 0)
            .count()
            > limited.len() / 6;

    if looks_utf16_le {
        let units = limited
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        String::from_utf16_lossy(&units)
    } else {
        String::from_utf8_lossy(limited).into_owned()
    }
}

fn shell_error(message: &str, retryable: bool) -> AppError {
    AppError {
        code: "SHELL_ERROR",
        message: message.into(),
        retryable,
        details: None,
    }
}

#[cfg(test)]
mod tests {
    use super::{command_basename, decode_output, looks_interactive};

    #[test]
    fn decodes_utf16_windows_shell_errors() {
        let encoded = "Access denied."
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>();

        assert_eq!(decode_output(&encoded), "Access denied.");
    }

    #[test]
    fn detects_interactive_wsl_tools() {
        assert!(looks_interactive("claude"));
        assert!(looks_interactive("codex"));
        assert!(looks_interactive("sudo nvim file"));
        assert!(!looks_interactive("ls -la"));
        assert!(!looks_interactive("python -c \"print(1)\""));
        assert!(!looks_interactive("python -m pip install requests"));
        assert!(!looks_interactive("py -3 script.py"));
        assert!(looks_interactive("python"));
        assert!(looks_interactive("py"));
        assert_eq!(command_basename("/usr/bin/claude"), "claude");
    }
}
