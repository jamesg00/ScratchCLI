use crate::error::AppError;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

type PtyWriter = Box<dyn Write + Send>;
type PtyMaster = Box<dyn portable_pty::MasterPty + Send>;
type PtyChild = Box<dyn portable_pty::Child + Send + Sync>;

struct LiveSession {
    writer: Mutex<PtyWriter>,
    master: Mutex<PtyMaster>,
    child: Mutex<PtyChild>,
}

#[derive(Clone, Default)]
pub struct PtyState {
    sessions: Arc<Mutex<HashMap<String, Arc<LiveSession>>>>,
}

impl PtyState {
    /// Kill every interactive session (used on app quit so the process can exit).
    pub fn kill_all(&self) {
        let sessions = match self.sessions.lock() {
            Ok(mut map) => std::mem::take(&mut *map),
            Err(_) => return,
        };
        for (_id, session) in sessions {
            if let Ok(mut child) = session.child.lock() {
                if let Some(pid) = child.process_id() {
                    kill_process_tree(pid);
                }
                let _ = child.kill();
            }
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PtyDataPayload {
    session_id: String,
    data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PtyExitPayload {
    session_id: String,
    code: Option<i32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyStartResult {
    session_id: String,
}

fn pty_error(message: impl Into<String>) -> AppError {
    AppError {
        code: "PTY_ERROR",
        message: message.into(),
        retryable: true,
        details: None,
    }
}

fn is_simple_command(command: &str) -> bool {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return false;
    }
    // No shell metacharacters → safe to exec directly under WSL.
    !trimmed.chars().any(|ch| {
        matches!(
            ch,
            '|' | '&' | ';' | '<' | '>' | '(' | ')' | '$' | '`' | '\n' | '"' | '\''
        )
    })
}

fn build_command(
    shell: &str,
    command: &str,
    cwd: Option<&str>,
) -> Result<CommandBuilder, AppError> {
    let trimmed = command.trim();
    // Prefer cmd.exe as ConPTY host on Windows — powershell -Command nests poorly
    // and often leaves a blank PTY after the TUI exits.
    let use_cmd_host = cfg!(windows) && shell != "wsl";

    let mut cmd = if use_cmd_host {
        let mut builder = CommandBuilder::new("cmd.exe");
        builder.arg("/D");
        builder.arg("/S");
        builder.arg("/C");
        builder.arg(trimmed);
        if let Some(dir) = cwd.filter(|value| !value.is_empty()) {
            builder.cwd(dir);
        }
        builder
    } else {
        match shell {
            "wsl" => {
                let mut builder = CommandBuilder::new("wsl.exe");
                if let Some(dir) = cwd.filter(|value| !value.is_empty()) {
                    builder.arg("--cd");
                    builder.arg(dir);
                }
                if is_simple_command(trimmed) {
                    // Faster than bash -lc for TUIs like cacafire.
                    builder.arg("-e");
                    for part in trimmed.split_whitespace() {
                        builder.arg(part);
                    }
                } else {
                    builder.arg("-e");
                    builder.arg("bash");
                    builder.arg("-lc");
                    builder.arg(trimmed);
                }
                builder
            }
            "cmd" => {
                let mut builder = CommandBuilder::new("cmd.exe");
                builder.arg("/D");
                builder.arg("/S");
                builder.arg("/C");
                builder.arg(trimmed);
                if let Some(dir) = cwd.filter(|value| !value.is_empty()) {
                    builder.cwd(dir);
                }
                builder
            }
            "powershell" => {
                let mut builder = CommandBuilder::new("powershell.exe");
                builder.arg("-NoLogo");
                builder.arg("-NoProfile");
                builder.arg("-Command");
                builder.arg(trimmed);
                if let Some(dir) = cwd.filter(|value| !value.is_empty()) {
                    builder.cwd(dir);
                }
                builder
            }
            _ => {
                return Err(pty_error(
                    "Interactive hosting supports powershell, cmd, or wsl.",
                ))
            }
        }
    };

    // Help color / TUI apps detect a capable terminal.
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("FORCE_COLOR", "1");
    // Some CLIs go non-interactive when CI is set in the parent environment.
    cmd.env_remove("CI");
    Ok(cmd)
}

fn finish_session(
    sessions: &Arc<Mutex<HashMap<String, Arc<LiveSession>>>>,
    exited: &AtomicBool,
    app: &AppHandle,
    session_id: &str,
    code: Option<i32>,
) {
    if exited.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Ok(mut map) = sessions.lock() {
        map.remove(session_id);
    }
    let _ = app.emit(
        "pty-exit",
        PtyExitPayload {
            session_id: session_id.to_string(),
            code,
        },
    );
}

fn kill_process_tree(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = pid;
    }
}

#[tauri::command]
pub fn start_pty_session(
    app: AppHandle,
    state: State<'_, PtyState>,
    shell: String,
    command: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
) -> Result<PtyStartResult, AppError> {
    if command.trim().is_empty() {
        return Err(pty_error("Enter a command to run."));
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(8),
            cols: cols.max(20),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| pty_error(format!("Could not open PTY: {error}")))?;

    let cmd = build_command(&shell, command.trim(), cwd.as_deref())?;
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|error| pty_error(format!("Could not start interactive session: {error}")))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| pty_error(format!("Could not read PTY: {error}")))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| pty_error(format!("Could not write PTY: {error}")))?;

    let session_id = Uuid::new_v4().to_string();
    let live = Arc::new(LiveSession {
        writer: Mutex::new(writer),
        master: Mutex::new(pair.master),
        child: Mutex::new(child),
    });

    state
        .sessions
        .lock()
        .map_err(|_| pty_error("PTY state lock poisoned."))?
        .insert(session_id.clone(), Arc::clone(&live));

    let emit_id = session_id.clone();
    let app_reader = app.clone();
    let sessions_reader = Arc::clone(&state.sessions);
    let wait_handle = Arc::clone(&live);
    let sessions_wait = Arc::clone(&state.sessions);
    let app_wait = app.clone();
    let emit_wait = session_id.clone();
    let exited = Arc::new(AtomicBool::new(false));
    let exited_reader = Arc::clone(&exited);
    let exited_wait = Arc::clone(&exited);

    // Reader: coalesce flood output (cacafire etc.) into fewer UI events.
    thread::spawn(move || {
        let mut buffer = [0u8; 64 * 1024];
        let mut pending = String::new();
        let mut last_emit = Instant::now();
        let flush = |app: &AppHandle, session_id: &str, pending: &mut String| {
            if pending.is_empty() {
                return;
            }
            let data = std::mem::take(pending);
            let _ = app.emit(
                "pty-data",
                PtyDataPayload {
                    session_id: session_id.to_string(),
                    data,
                },
            );
        };

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    pending.push_str(&String::from_utf8_lossy(&buffer[..n]));
                    let elapsed = last_emit.elapsed() >= Duration::from_millis(24);
                    if pending.len() >= 48 * 1024 || elapsed {
                        flush(&app_reader, &emit_id, &mut pending);
                        last_emit = Instant::now();
                    }
                }
                Err(_) => break,
            }
        }
        flush(&app_reader, &emit_id, &mut pending);
        finish_session(
            &sessions_reader,
            &exited_reader,
            &app_reader,
            &emit_id,
            None,
        );
    });

    // Waiter: poll try_wait WITHOUT holding the lock, so kill_pty_session can
    // acquire the child and terminate WSL/TUI process trees.
    thread::spawn(move || {
        let code = loop {
            if exited_wait.load(Ordering::SeqCst) {
                break None;
            }
            let polled = {
                let mut child = match wait_handle.child.lock() {
                    Ok(child) => child,
                    Err(_) => break None,
                };
                match child.try_wait() {
                    Ok(Some(status)) => Some(Some(status.exit_code() as i32)),
                    Ok(None) => None,
                    Err(_) => Some(None),
                }
            };
            if let Some(code) = polled {
                break code;
            }
            thread::sleep(Duration::from_millis(40));
        };
        finish_session(&sessions_wait, &exited_wait, &app_wait, &emit_wait, code);
    });

    Ok(PtyStartResult { session_id })
}

#[tauri::command]
pub fn write_pty_session(
    state: State<'_, PtyState>,
    session_id: String,
    data: String,
) -> Result<(), AppError> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| pty_error("PTY state lock poisoned."))?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| pty_error("Interactive session is not running."))?;
    let mut writer = session
        .writer
        .lock()
        .map_err(|_| pty_error("PTY writer lock poisoned."))?;
    writer
        .write_all(data.as_bytes())
        .and_then(|_| writer.flush())
        .map_err(|error| pty_error(format!("Could not send input: {error}")))
}

#[tauri::command]
pub fn resize_pty_session(
    state: State<'_, PtyState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), AppError> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| pty_error("PTY state lock poisoned."))?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| pty_error("Interactive session is not running."))?;
    let master = session
        .master
        .lock()
        .map_err(|_| pty_error("PTY master lock poisoned."))?;
    master
        .resize(PtySize {
            rows: rows.max(8),
            cols: cols.max(20),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| pty_error(format!("Could not resize PTY: {error}")))
}

#[tauri::command]
pub fn kill_pty_session(state: State<'_, PtyState>, session_id: String) -> Result<(), AppError> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| pty_error("PTY state lock poisoned."))?;
    if let Some(session) = sessions.remove(&session_id) {
        if let Ok(mut child) = session.child.lock() {
            if let Some(pid) = child.process_id() {
                kill_process_tree(pid);
            }
            let _ = child.kill();
        }
    }
    Ok(())
}

/// Drop a finished session from the map (called after pty-exit on the frontend).
#[tauri::command]
pub fn dispose_pty_session(state: State<'_, PtyState>, session_id: String) -> Result<(), AppError> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| pty_error("PTY state lock poisoned."))?;
    sessions.remove(&session_id);
    Ok(())
}
