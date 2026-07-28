import { z } from "zod";

export const shellKindSchema = z.enum(["powershell", "cmd", "wsl"]);

export const shellExecutionResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int().nullable(),
  durationMs: z.number().nonnegative(),
  truncated: z.boolean(),
  executable: z.string(),
});

export type ShellKind = z.infer<typeof shellKindSchema>;
export type ShellExecutionResult = z.infer<typeof shellExecutionResultSchema>;
