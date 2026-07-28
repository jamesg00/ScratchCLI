type Props = {
  cwd: string;
  onNewScratch: () => void;
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
  onDismiss: () => void;
};

export function DeveloperCockpitWelcome({
  cwd,
  onNewScratch,
  onOpenFile,
  onOpenWorkspace,
  onDismiss,
}: Props) {
  return (
    <section className="cockpit-welcome" aria-labelledby="welcome-title">
      <button
        className="cockpit-welcome-dismiss"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss welcome"
      >
        ×
      </button>
      <p className="cockpit-eyebrow">LOCAL-FIRST DEVELOPER COCKPIT</p>
      <h1 id="welcome-title">What do you want to build?</h1>
      <p className="cockpit-intro">
        Capture an idea, inspect a file, or start inside a project. Everything
        stays on this machine.
      </p>
      <div className="cockpit-actions">
        <button type="button" onClick={onNewScratch}>
          <strong>New scratch</strong>
          <span>Start typing immediately</span>
          <kbd>Ctrl+N</kbd>
        </button>
        <button type="button" onClick={onOpenFile}>
          <strong>Open file</strong>
          <span>Edit a file by path</span>
          <kbd>open …</kbd>
        </button>
        <button type="button" onClick={onOpenWorkspace}>
          <strong>Open workspace</strong>
          <span>{cwd || "Choose a project folder"}</span>
          <kbd>cd …</kbd>
        </button>
      </div>
      <div className="cockpit-command-tip">
        <span aria-hidden="true">&gt;_</span>
        <code>new api experiment</code>
        <small>Try this below, or press Ctrl+K to search every action.</small>
      </div>
      <p className="cockpit-ai-tip">
        CLI home · <code>open</code> → Editor · <code>close</code> / Esc back ·{" "}
        <code>resume</code> tabs · <code>claude</code> / <code>codex</code> agents
      </p>
    </section>
  );
}
