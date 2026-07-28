import { invoke } from "@tauri-apps/api/core";
import {
  pythonExecutionResultSchema,
  type PythonExecutionResult,
  type PythonMode,
} from "../types/python";

export async function executePython(
  code: string,
  mode: PythonMode,
  cwd?: string | null,
): Promise<PythonExecutionResult> {
  const value = await invoke("execute_python", {
    code,
    mode,
    cwd: cwd?.trim() ? cwd : null,
  });
  return pythonExecutionResultSchema.parse(value);
}
