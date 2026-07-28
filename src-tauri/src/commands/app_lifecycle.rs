//! App lifecycle helpers (clean quit).

use crate::commands::pty::PtyState;
use tauri::{AppHandle, Manager};

/// Tear down PTY sessions and terminate the process.
/// Window close alone can leave reader threads alive on Windows.
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    if let Some(state) = app.try_state::<PtyState>() {
        state.kill_all();
    }
    // Prefer Tauri's exit so plugins can wind down, then hard-exit as a
    // safety net if non-daemon threads keep the process alive.
    app.exit(0);
    std::process::exit(0);
}
