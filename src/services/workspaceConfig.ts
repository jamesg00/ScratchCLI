import { z } from "zod";
import { fileService } from "./files";

const workspaceConfigSchema = z.object({
  interpreter: z.string().min(1).optional(),
  runCommand: z.string().min(1).optional(),
  environment: z.array(z.string().min(1)).default([]),
  preferredShell: z.enum(["cmd", "powershell", "wsl", "python"]).optional(),
  snippets: z.array(z.string().min(1)).default([]),
  ignoredPaths: z.array(z.string().min(1)).default([]),
});

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;

export async function loadWorkspaceConfig(
  cwd: string,
): Promise<WorkspaceConfig | null> {
  if (!cwd.trim()) return null;
  const path = await fileService.resolvePath(cwd, ".scratchcli.json");
  try {
    const file = await fileService.readTextFile(path);
    return workspaceConfigSchema.parse(JSON.parse(file.content));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not.?found|does not exist|no such file/i.test(message)) return null;
    throw error;
  }
}
