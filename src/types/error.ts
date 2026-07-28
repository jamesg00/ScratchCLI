import { z } from "zod";

export const appErrorSchema = z.object({
  code: z.enum([
    "VALIDATION_ERROR",
    "DATABASE_ERROR",
    "NETWORK_ERROR",
    "PYTHON_ERROR",
    "SHELL_ERROR",
    "PTY_ERROR",
    "NEEDS_PTY",
    "GROK_ERROR",
    "WINDOW_ERROR",
    "UNKNOWN_ERROR",
  ]),
  message: z.string(),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type AppError = z.infer<typeof appErrorSchema>;

export function normalizeError(error: unknown): AppError {
  const parsed = appErrorSchema.safeParse(error);
  if (parsed.success) return parsed.data;

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") {
      const code =
        typeof record.code === "string" ? record.code : "UNKNOWN_ERROR";
      const known = appErrorSchema.shape.code.safeParse(code);
      return {
        code: known.success ? known.data : "UNKNOWN_ERROR",
        message: record.message,
        retryable: Boolean(record.retryable),
        details:
          record.details && typeof record.details === "object"
            ? (record.details as Record<string, unknown>)
            : undefined,
      };
    }
  }

  if (typeof error === "string") {
    try {
      const nested = appErrorSchema.safeParse(JSON.parse(error));
      if (nested.success) return nested.data;
      const loose = JSON.parse(error) as Record<string, unknown>;
      if (typeof loose.message === "string") {
        return normalizeError(loose);
      }
    } catch {
      return {
        code: "UNKNOWN_ERROR",
        message: error,
        retryable: false,
      };
    }
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "Something went wrong. Your note content is still in the editor.",
    retryable: false,
  };
}
