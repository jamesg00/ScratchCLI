import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ShellKind } from "../types/shell";

export type PtyStartResult = { sessionId: string };
export type PtyDataEvent = { sessionId: string; data: string };
export type PtyExitEvent = { sessionId: string; code: number | null };

export async function shellNeedsPty(command: string): Promise<boolean> {
  return invoke<boolean>("shell_needs_pty", { command });
}

export async function startPtySession(options: {
  shell: ShellKind;
  command: string;
  cols: number;
  rows: number;
  cwd?: string;
}): Promise<PtyStartResult> {
  return invoke<PtyStartResult>("start_pty_session", {
    shell: options.shell,
    command: options.command,
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd ?? null,
  });
}

export async function writePtySession(
  sessionId: string,
  data: string,
): Promise<void> {
  await invoke("write_pty_session", { sessionId, data });
}

export async function resizePtySession(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke("resize_pty_session", { sessionId, cols, rows });
}

export async function killPtySession(sessionId: string): Promise<void> {
  await invoke("kill_pty_session", { sessionId });
}

export async function disposePtySession(sessionId: string): Promise<void> {
  await invoke("dispose_pty_session", { sessionId });
}

export async function listenPtyData(
  handler: (event: PtyDataEvent) => void,
): Promise<UnlistenFn> {
  return listen<PtyDataEvent>("pty-data", (event) => handler(event.payload));
}

export async function listenPtyExit(
  handler: (event: PtyExitEvent) => void,
): Promise<UnlistenFn> {
  return listen<PtyExitEvent>("pty-exit", (event) => handler(event.payload));
}
