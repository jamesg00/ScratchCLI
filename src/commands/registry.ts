export type CommandCategory =
  | "Workspace"
  | "Documents"
  | "Execution"
  | "Appearance"
  | "Practice"
  | "System";

export type CommandSafety = "safe" | "confirm" | "destructive";

export type CommandDefinition = {
  id: string;
  aliases: readonly string[];
  label: string;
  description: string;
  usage: string;
  category: CommandCategory;
  shortcut?: string;
  safety: CommandSafety;
  acceptsArgument?: boolean;
};

export const COMMAND_REGISTRY = [
  {
    id: "document.new",
    aliases: ["new", "touch note"],
    label: "New scratch",
    description: "Create an untitled local scratch note.",
    usage: "new [title]",
    category: "Documents",
    shortcut: "Ctrl+N",
    safety: "safe",
    acceptsArgument: true,
  },
  {
    id: "document.open",
    aliases: ["open", "edit"],
    label: "Open file",
    description:
      "Open a disk file in Editor mode (nano-style). Close returns to CLI.",
    usage: "open <path>",
    category: "Documents",
    safety: "safe",
    acceptsArgument: true,
  },
  {
    id: "mode.cli",
    aliases: ["close", "cli"],
    label: "Back to CLI",
    description: "Leave Editor mode and return to the full CLI home.",
    usage: "close",
    category: "Workspace",
    shortcut: "Esc",
    safety: "safe",
  },
  {
    id: "mode.editor",
    aliases: ["resume", "editor"],
    label: "Resume editor",
    description: "Return to Editor mode with previously open tabs.",
    usage: "resume",
    category: "Workspace",
    safety: "safe",
  },
  {
    id: "document.save",
    aliases: ["save", "write"],
    label: "Save",
    description: "Save the active note or file.",
    usage: "save",
    category: "Documents",
    shortcut: "Ctrl+S",
    safety: "safe",
  },
  {
    id: "workspace.open",
    aliases: ["cd"],
    label: "Open workspace",
    description: "Use a folder as the terminal and file workspace.",
    usage: "cd <folder>",
    category: "Workspace",
    safety: "safe",
    acceptsArgument: true,
  },
  {
    id: "documents.library",
    aliases: ["notes"],
    label: "Notes library",
    description: "Browse, search, archive, restore, and trash notes.",
    usage: "notes",
    category: "Documents",
    shortcut: "Ctrl+Shift+N",
    safety: "safe",
  },
  {
    id: "workspace.palette",
    aliases: [],
    label: "Command palette",
    description: "Search every ScratchCLI action, note, and nearby file.",
    usage: "",
    category: "Workspace",
    shortcut: "Ctrl+K",
    safety: "safe",
  },
  {
    id: "execution.run",
    aliases: ["run", "/run"],
    label: "Run buffer",
    description: "Execute the current Python buffer.",
    usage: "run",
    category: "Execution",
    shortcut: "Ctrl+R",
    safety: "safe",
  },
  {
    id: "execution.build",
    aliases: ["build", "/build"],
    label: "Build buffer",
    description: "Check the current Python buffer for syntax errors.",
    usage: "build",
    category: "Execution",
    shortcut: "Ctrl+B",
    safety: "safe",
  },
  {
    id: "appearance.open",
    aliases: ["theme", "font", "opacity"],
    label: "Appearance",
    description: "Change theme, font, colors, and transparency.",
    usage: "theme light|dark|pro|comet",
    category: "Appearance",
    shortcut: "Ctrl+,",
    safety: "safe",
  },
  {
    id: "ai.settings",
    aliases: ["aisettings", "apikeys", "env"],
    label: "AI keys",
    description:
      "API keys, Ollama/LM Studio URLs, and default Assistant provider.",
    usage: "env",
    category: "System",
    safety: "safe",
  },
  {
    id: "practice.open",
    aliases: ["coach", "dsa", "study", "lessons"],
    label: "Open Practice workspace",
    description: "Open optional DSA coaching and interview tools.",
    usage: "coach",
    category: "Practice",
    shortcut: "Ctrl+G",
    safety: "safe",
  },
  {
    id: "assistant.open",
    aliases: ["assistant", "chat", "ai"],
    label: "Open Assistant",
    description:
      "General coding chat with local models (Ollama/LM Studio) or cloud API keys.",
    usage: "assistant",
    category: "System",
    shortcut: "Ctrl+Shift+A",
    safety: "safe",
  },
  {
    id: "agent.claude",
    aliases: ["claude"],
    label: "Launch Claude Code",
    description:
      "Start Claude Code in the in-app terminal (requires `claude` on PATH).",
    usage: "claude",
    category: "Execution",
    safety: "safe",
  },
  {
    id: "agent.codex",
    aliases: ["codex"],
    label: "Launch Codex",
    description:
      "Start Codex in the in-app terminal (requires `codex` on PATH).",
    usage: "codex",
    category: "Execution",
    safety: "safe",
  },
  {
    id: "system.help",
    aliases: ["help"],
    label: "Help",
    description: "Show commands and keyboard shortcuts.",
    usage: "help",
    category: "System",
    shortcut: "Ctrl+H",
    safety: "safe",
  },
] as const satisfies readonly CommandDefinition[];

export function commandDefinition(id: string): CommandDefinition | undefined {
  return COMMAND_REGISTRY.find((command) => command.id === id);
}
