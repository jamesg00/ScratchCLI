import { fileService } from "../services/files";
import type { StudyHistoryItem } from "../stores/studyStore";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Copy today's practice files into scratchcli-export-YYYYMMDD under cwd. */
export async function exportTodayPractice(
  cwd: string,
  history: StudyHistoryItem[],
): Promise<string> {
  const date = today();
  const todays = history.filter((item) => item.date === date && item.path);
  const folderName = `scratchcli-export-${date}`;
  const dir = await fileService.resolvePath(cwd, folderName);
  await fileService.createDirectory(dir);

  const copied: string[] = [];
  for (const item of todays) {
    if (!item.path) continue;
    try {
      const file = await fileService.readTextFile(item.path);
      const base =
        item.path.split(/[/\\]/).filter(Boolean).at(-1) || "practice.py";
      const dest = await fileService.resolvePath(dir, base);
      await fileService.writeTextFile(dest, file.content);
      copied.push(base);
    } catch {
      // skip missing files
    }
  }

  const summary = [
    `# ScratchCLI export ${date}`,
    "",
    `Files: ${copied.length}`,
    ...copied.map((name) => `- ${name}`),
    "",
    "## History",
    ...todays.map(
      (item) =>
        `- ${item.title}${item.passed == null ? "" : item.passed ? " (pass)" : " (fail)"}`,
    ),
    "",
  ].join("\n");
  await fileService.writeTextFile(
    await fileService.resolvePath(dir, "SUMMARY.md"),
    summary,
  );

  return `Exported ${copied.length} file(s) to ${dir}`;
}
