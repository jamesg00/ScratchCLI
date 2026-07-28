// Hide the console window in release builds (GUI-only Windows app).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    scratchcli_lib::run();
}
