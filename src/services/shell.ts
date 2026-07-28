import { invoke } from "@tauri-apps/api/core";
import {
  shellExecutionResultSchema,
  type ShellExecutionResult,
  type ShellKind,
} from "../types/shell";

export async function executeLocalShell(
  shell: ShellKind,
  command: string,
  cwd?: string | null,
): Promise<ShellExecutionResult> {
  const value = await invoke("execute_local_shell", {
    shell,
    command,
    cwd: cwd?.trim() ? cwd : null,
  });
  return shellExecutionResultSchema.parse(value);
}
