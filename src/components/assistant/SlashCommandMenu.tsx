export type SlashCommand = {
  id: string;
  label: string;
  description: string;
};

type Props = {
  commands: SlashCommand[];
  query: string;
  activeIndex: number;
  onChoose: (command: SlashCommand) => void;
};

// eslint-disable-next-line react-refresh/only-export-components
export function matchingSlashCommands(commands: SlashCommand[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return commands;
  return commands.filter((command) =>
    `${command.id} ${command.label} ${command.description}`
      .toLowerCase()
      .includes(needle),
  );
}

export function SlashCommandMenu({
  commands,
  query,
  activeIndex,
  onChoose,
}: Props) {
  const matches = matchingSlashCommands(commands, query);
  if (matches.length === 0) return null;
  return (
    <div className="slash-command-menu" role="listbox" aria-label="Commands">
      {matches.map((command, index) => (
        <button
          key={command.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          data-active={index === activeIndex ? "true" : "false"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChoose(command)}
        >
          <span>/{command.label}</span>
          <small>{command.description}</small>
        </button>
      ))}
    </div>
  );
}
