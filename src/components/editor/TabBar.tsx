import type { EditorTab } from "../../stores/sessionStore";
import { useTabDragStore } from "../../stores/tabDragStore";

type Props = {
  tabs: EditorTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onClone?: () => void;
  onUnsplit?: () => void;
};

export function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onNew,
  onClone,
  onUnsplit,
}: Props) {
  if (!tabs.length) return null;

  return (
    <div className="tab-bar">
      <div className="tab-list" role="tablist" aria-label="Open tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTabId}
            className="tab-item"
            data-active={tab.id === activeTabId}
            title={`${tab.path ?? tab.title} — drag onto the editor to split`}
            onClick={() => {
              if (useTabDragStore.getState().consumeSuppressClick()) return;
              onSelect(tab.id);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              const target = event.target;
              if (
                target instanceof HTMLElement &&
                target.closest(".tab-close")
              ) {
                return;
              }
              // Don't start a window drag; capture for tab docking.
              event.currentTarget.setPointerCapture(event.pointerId);
              useTabDragStore
                .getState()
                .begin(
                  tab.id,
                  tab.title || "Untitled",
                  event.clientX,
                  event.clientY,
                );
            }}
          >
            <span className="tab-title">
              {tab.dirty ? "• " : ""}
              {tab.title || "Untitled"}
            </span>
            <span
              className="tab-close"
              role="button"
              tabIndex={0}
              aria-label={`Close ${tab.title}`}
              title="Close tab"
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onClose(tab.id);
                }
              }}
            >
              ×
            </span>
          </button>
        ))}
        <button
          type="button"
          className="tab-new"
          onClick={onNew}
          aria-label="New tab"
          title="New tab"
        >
          +
        </button>
        {onClone && (
          <button
            type="button"
            className="tab-new"
            onClick={onClone}
            aria-label="Clone tab"
            title="Clone current tab"
          >
            ⧉
          </button>
        )}
      </div>
      <div className="tab-bar-spacer" data-tauri-drag-region />
      {onUnsplit && (
        <button
          type="button"
          className="tab-unsplit"
          onClick={onUnsplit}
          title="Unsplit panes"
        >
          Unsplit
        </button>
      )}
    </div>
  );
}
