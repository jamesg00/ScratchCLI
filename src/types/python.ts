import { z } from "zod";

export const pythonExecutionResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int().nullable(),
  durationMs: z.number().nonnegative(),
  truncated: z.boolean(),
});

export type PythonExecutionResult = z.infer<typeof pythonExecutionResultSchema>;
export type PythonMode = "run" | "build";
