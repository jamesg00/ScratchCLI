import {
  useCallback,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  NoteEditor,
  type EditorActions,
  type EditorDocument,
} from "./NoteEditor";
import type {
  EditorTab,
  SplitAxis,
  SplitCount,
} from "../../stores/sessionStore";
import { useTabDragStore } from "../../stores/tabDragStore";

type Props = {
  tabs: EditorTab[];
  splitCount: SplitCount;
  splitAxis: SplitAxis;
  paneTabIds: (string | null)[];
  paneSizes: number[];
  focusedPaneIndex: number;
  dark: boolean;
  fontFamily: string;
  fontSize: number;
  onFocusPane: (index: number) => void;
  onSelectTabInPane: (paneIndex: number, tabId: string) => void;
  onCloseTab?: (tabId: string) => void;
  onPaneSizesChange: (sizes: number[]) => void;
  onPatchTab: (
    tabId: string,
    patch: Partial<Pick<EditorTab, "content" | "language" | "title">>,
  ) => void;
  onActionsReady: (actions: EditorActions) => void;
  onSlashCommand: (command: string, content: string) => void;
  onNanoExit: () => void;
  onActivateCommand?: (seed?: string) => void;
};

function tabDocument(tab: EditorTab): EditorDocument {
  return {
    content: tab.content,
    language: tab.language,
    title: tab.title,
    color: tab.kind === "file" ? "gray" : (tab.color ?? "yellow"),
  };
}

function DropTarget({
  paneIndex,
  children,
  className,
}: {
  paneIndex: number;
  children: React.ReactNode;
  className?: string;
}) {
  const edge = useTabDragStore((state) =>
    state.active && state.paneIndex === paneIndex ? state.edge : null,
  );
  const dragging = useTabDragStore((state) => state.active);

  return (
    <div
      className={className ?? "split-pane-body"}
      data-tab-drop-pane={paneIndex}
      data-drop-edge={edge ?? undefined}
      data-tab-drop-active={dragging ? "true" : undefined}
    >
      {children}
      <div className="split-drop-overlay" aria-hidden="true">
        <div className="split-drop-zone" data-side="left" />
        <div className="split-drop-zone" data-side="right" />
        <div className="split-drop-zone" data-side="top" />
        <div className="split-drop-zone" data-side="bottom" />
        <div className="split-drop-zone" data-side="center" />
      </div>
    </div>
  );
}

export function SplitWorkspace({
  tabs,
  splitCount,
  splitAxis,
  paneTabIds,
  paneSizes,
  focusedPaneIndex,
  dark,
  fontFamily,
  fontSize,
  onFocusPane,
  onSelectTabInPane,
  onCloseTab,
  onPaneSizesChange,
  onPatchTab,
  onActionsReady,
  onSlashCommand,
  onNanoExit,
  onActivateCommand,
}: Props) {
  const drag = useRef<{
    kind: "col" | "row" | "grid-col-top" | "grid-col-bottom";
    index: number;
    start: number;
    snapshot: number[];
  } | null>(null);

  const sizes = paneSizes.slice(0, 4);
  const activeSum = sizes.slice(0, splitCount).reduce((a, b) => a + b, 0) || 1;
  const norm = sizes.map((size, index) =>
    index < splitCount ? size / activeSum : 0,
  );

  const beginDrag = (
    kind: "col" | "row" | "grid-col-top" | "grid-col-bottom",
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = {
      kind,
      index,
      start: kind === "row" ? event.clientY : event.clientX,
      snapshot: [...norm],
    };
  };

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = drag.current;
      if (!state) return;
      const root = event.currentTarget.closest(".split-workspace");
      if (!(root instanceof HTMLElement)) return;

      if (state.kind === "col") {
        const delta = (event.clientX - state.start) / root.clientWidth;
        const next = [...state.snapshot];
        const pair = next[state.index]! + next[state.index + 1]!;
        next[state.index] = Math.max(
          0.15,
          Math.min(pair - 0.15, next[state.index]! + delta),
        );
        next[state.index + 1] = pair - next[state.index]!;
        onPaneSizesChange(next);
        return;
      }

      if (state.kind === "row") {
        const delta = (event.clientY - state.start) / root.clientHeight;
        if (splitCount === 2) {
          const next = [...state.snapshot];
          const pair = next[0]! + next[1]!;
          next[0] = Math.max(0.15, Math.min(pair - 0.15, next[0]! + delta));
          next[1] = pair - next[0]!;
          onPaneSizesChange(next);
          return;
        }
        const top = state.snapshot[0]! + state.snapshot[1]!;
        const bottom = state.snapshot[2]! + state.snapshot[3]!;
        const total = top + bottom || 1;
        const topRatio = Math.max(0.2, Math.min(0.8, top / total + delta));
        const bottomRatio = 1 - topRatio;
        const topLeft = top ? state.snapshot[0]! / top : 0.5;
        const bottomLeft = bottom ? state.snapshot[2]! / bottom : 0.5;
        onPaneSizesChange([
          topRatio * topLeft,
          topRatio * (1 - topLeft),
          bottomRatio * bottomLeft,
          bottomRatio * (1 - bottomLeft),
        ]);
        return;
      }

      const delta = (event.clientX - state.start) / root.clientWidth;
      const next = [...state.snapshot];
      if (state.kind === "grid-col-top") {
        const pair = next[0]! + next[1]!;
        next[0] = Math.max(0.08, Math.min(pair - 0.08, next[0]! + delta));
        next[1] = pair - next[0]!;
      } else {
        const pair = next[2]! + next[3]!;
        next[2] = Math.max(0.08, Math.min(pair - 0.08, next[2]! + delta));
        next[3] = pair - next[2]!;
      }
      onPaneSizesChange(next);
    },
    [onPaneSizesChange, splitCount],
  );

  const endDrag = () => {
    drag.current = null;
  };

  const renderEditor = (index: number, tab: EditorTab | null) => {
    if (!tab) {
      return (
        <div className="split-pane-empty">
          Open a tab or drag one here to fill this pane.
        </div>
      );
    }
    return (
      <NoteEditor
        document={tabDocument(tab)}
        dark={dark}
        fontFamily={fontFamily}
        fontSize={fontSize}
        onChange={(patch) => onPatchTab(tab.id, patch)}
        onActionsReady={
          focusedPaneIndex === index ? onActionsReady : () => undefined
        }
        onSlashCommand={onSlashCommand}
        onNanoExit={onNanoExit}
        onActivateCommand={onActivateCommand}
      />
    );
  };

  const pane = (index: number, style?: CSSProperties) => {
    const tabId = paneTabIds[index];
    const tab = tabs.find((item) => item.id === tabId) ?? null;
    return (
      <section
        className="split-pane"
        data-focused={focusedPaneIndex === index}
        style={style}
        onMouseDown={() => onFocusPane(index)}
      >
        <header className="split-pane-header">
          <select
            value={tabId ?? ""}
            onChange={(event) => onSelectTabInPane(index, event.target.value)}
            aria-label={`Pane ${index + 1} tab`}
          >
            <option value="">(empty)</option>
            {tabs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.dirty ? "• " : ""}
                {item.title}
              </option>
            ))}
          </select>
          {tabId && onCloseTab && tabs.length > 1 && (
            <button
              type="button"
              className="split-pane-close"
              title={`Close ${tab?.title || "tab"}`}
              aria-label={`Close ${tab?.title || "tab"}`}
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(tabId);
              }}
            >
              ×
            </button>
          )}
        </header>
        <DropTarget paneIndex={index}>{renderEditor(index, tab)}</DropTarget>
      </section>
    );
  };

  if (splitCount === 1) {
    const tabId = paneTabIds[0];
    const tab = tabs.find((item) => item.id === tabId) ?? tabs[0] ?? null;
    return (
      <div className="split-workspace split-1" data-single="true">
        <DropTarget paneIndex={0} className="split-pane-body is-single">
          {renderEditor(0, tab)}
        </DropTarget>
      </div>
    );
  }

  if (splitCount === 4) {
    const top = (norm[0] ?? 0) + (norm[1] ?? 0) || 0.5;
    const bottom = (norm[2] ?? 0) + (norm[3] ?? 0) || 0.5;
    const rowSum = top + bottom;
    return (
      <div
        className="split-workspace split-4"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        <div className="split-row" style={{ flex: top / rowSum }}>
          {pane(0, { flex: norm[0] })}
          <div
            className="split-handle vertical"
            onPointerDown={(event) => beginDrag("grid-col-top", 0, event)}
          />
          {pane(1, { flex: norm[1] })}
        </div>
        <div
          className="split-handle horizontal"
          onPointerDown={(event) => beginDrag("row", 0, event)}
        />
        <div className="split-row" style={{ flex: bottom / rowSum }}>
          {pane(2, { flex: norm[2] })}
          <div
            className="split-handle vertical"
            onPointerDown={(event) => beginDrag("grid-col-bottom", 2, event)}
          />
          {pane(3, { flex: norm[3] })}
        </div>
      </div>
    );
  }

  const stacked = splitCount === 2 && splitAxis === "vertical";

  return (
    <div
      className={`split-workspace split-row-wrap split-${splitCount}${
        stacked ? " is-stacked" : ""
      }`}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
    >
      {Array.from({ length: splitCount }, (_, index) => (
        <div
          key={index}
          className="split-pane-with-handle"
          style={{ flex: norm[index] }}
        >
          {pane(index)}
          {index < splitCount - 1 && (
            <div
              className={`split-handle ${stacked ? "horizontal" : "vertical"}`}
              onPointerDown={(event) =>
                beginDrag(stacked ? "row" : "col", index, event)
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
