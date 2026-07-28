import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { z } from "zod";

export const textFileResultSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const dirEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDir: z.boolean(),
});

export const fontInfoSchema = z.object({
  family: z.string(),
  path: z.string(),
  fileName: z.string(),
});

export type TextFileResult = z.infer<typeof textFileResultSchema>;
export type DirEntry = z.infer<typeof dirEntrySchema>;
export type FontInfo = z.infer<typeof fontInfoSchema>;

export const fileService = {
  async readTextFile(path: string): Promise<TextFileResult> {
    const value = await invoke("read_text_file", { path });
    return textFileResultSchema.parse(value);
  },

  async writeTextFile(path: string, content: string): Promise<TextFileResult> {
    const value = await invoke("write_text_file", { path, content });
    return textFileResultSchema.parse(value);
  },

  async listDirectory(path: string): Promise<DirEntry[]> {
    const value = await invoke("list_directory", { path });
    return dirEntrySchema.array().parse(value);
  },

  async resolvePath(cwd: string, path: string): Promise<string> {
    return z.string().parse(await invoke("resolve_path", { cwd, path }));
  },

  async defaultCwd(): Promise<string> {
    return z.string().parse(await invoke("default_cwd"));
  },

  async listUserFonts(): Promise<FontInfo[]> {
    const value = await invoke("list_user_fonts");
    return fontInfoSchema.array().parse(value);
  },

  async addUserFont(sourcePath: string): Promise<FontInfo> {
    const value = await invoke("add_user_font", { sourcePath });
    return fontInfoSchema.parse(value);
  },

  async removePath(path: string): Promise<{ path: string; kind: string }> {
    const value = await invoke("remove_path", { path });
    return z.object({ path: z.string(), kind: z.string() }).parse(value);
  },

  async createDirectory(path: string): Promise<string> {
    return z.string().parse(await invoke("create_directory", { path }));
  },

  async createFile(path: string): Promise<string> {
    return z.string().parse(await invoke("create_file", { path }));
  },

  fontFaceUrl(path: string): string {
    return convertFileSrc(path);
  },
};

export function languageFromPath(
  path: string,
): "python" | "markdown" | "plaintext" {
  const lower = path.toLowerCase();
  if (
    lower.endsWith(".py") ||
    lower.endsWith(".pyw") ||
    lower.endsWith(".pyi")
  ) {
    return "python";
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".txt") || lower.endsWith(".text")) return "plaintext";
  // Default to Python so run/build work without `/language python`.
  return "python";
}
