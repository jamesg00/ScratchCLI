mod commands;
mod db;
mod error;

use commands::app_lifecycle::quit_app;
use commands::chat::{chat_completion, list_local_models, which_command};
use commands::files::{
    add_user_font, create_directory, create_file, default_cwd, list_directory, list_user_fonts,
    read_text_file, remove_path, resolve_path, write_text_file,
};
use commands::grok::grok_chat;
use commands::leetcode::{
    leetcode_get_problem, leetcode_list_companies, leetcode_list_company_problems,
    leetcode_list_problems,
};
use commands::notes::{
    archive_note, create_note, delete_note, get_note, list_deleted_notes, list_note_revisions,
    list_notes, permanently_delete_note, restore_note, search_notes, update_note,
};
use commands::pty::{
    dispose_pty_session, kill_pty_session, resize_pty_session, start_pty_session,
    write_pty_session, PtyState,
};
use commands::python::execute_python;
use commands::secrets::{secrets_get, secrets_list_providers, secrets_set};
use commands::shell::{execute_local_shell, shell_needs_pty};
use db::repository::NoteRepository;
use tauri::image::Image;
use tauri::{Manager, RunEvent, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(PtyState::default())
        .setup(|app| {
            let database_path = app.path().app_data_dir()?.join("scratchcli.db");
            // Prefer new name; fall back to legacy NotePal DB if present.
            let legacy = app.path().app_data_dir()?.join("notepal.db");
            let database_path = if database_path.exists() {
                database_path
            } else if legacy.exists() {
                legacy
            } else {
                database_path
            };
            let pool = tauri::async_runtime::block_on(db::connect(&database_path))
                .map_err(Box::<dyn std::error::Error>::from)?;
            app.manage(NoteRepository::new(pool));

            // Force taskbar/window icon (Windows often caches the old embedded .ico).
            if let Some(window) = app.get_webview_window("main") {
                let icon = Image::from_bytes(include_bytes!("../icons/128x128.png"))
                    .map_err(Box::<dyn std::error::Error>::from)?;
                window.set_icon(icon)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            quit_app,
            create_note,
            get_note,
            list_notes,
            search_notes,
            list_deleted_notes,
            update_note,
            archive_note,
            delete_note,
            restore_note,
            permanently_delete_note,
            list_note_revisions,
            execute_python,
            execute_local_shell,
            shell_needs_pty,
            start_pty_session,
            write_pty_session,
            resize_pty_session,
            kill_pty_session,
            dispose_pty_session,
            grok_chat,
            chat_completion,
            list_local_models,
            which_command,
            secrets_get,
            secrets_set,
            secrets_list_providers,
            leetcode_list_problems,
            leetcode_list_companies,
            leetcode_list_company_problems,
            leetcode_get_problem,
            read_text_file,
            write_text_file,
            list_directory,
            resolve_path,
            default_cwd,
            list_user_fonts,
            add_user_font,
            remove_path,
            create_directory,
            create_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building ScratchCLI")
        .run(|app_handle, event| match event {
            // PTY reader threads / child shells can keep the process alive after
            // the window is gone — tear them down and force a clean exit.
            RunEvent::WindowEvent {
                event: WindowEvent::Destroyed,
                ..
            } => {
                if let Some(state) = app_handle.try_state::<PtyState>() {
                    state.kill_all();
                }
                app_handle.exit(0);
            }
            RunEvent::ExitRequested { .. } | RunEvent::Exit => {
                if let Some(state) = app_handle.try_state::<PtyState>() {
                    state.kill_all();
                }
            }
            _ => {}
        });
}
