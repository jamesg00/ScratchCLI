/** Claude Code–style ASCII banner for the CLI splash (pure ASCII, monospace-safe). */

export const CLI_BRAND_ASCII = [
  "  ____                 _       _      ____ _     ___ ",
  " / ___|  ___ _ __ __ _| |_ ___| |__  / ___| |   |_ _|",
  " \\___ \\ / __| '__/ _` | __/ __| '_ \\| |   | |    | | ",
  "  ___) | (__| | | (_| | || (__| | | | |___| |___ | | ",
  " |____/ \\___|_|  \\__,_|\\__\\___|_| |_|\\____|_____|___|",
].join("\n");

export function createBrandOutputLine(id: number): {
  id: number;
  kind: "brand";
  text: string;
} {
  return { id, kind: "brand", text: "ScratchCLI" };
}
