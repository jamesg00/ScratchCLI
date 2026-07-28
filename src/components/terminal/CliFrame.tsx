import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { CliDock } from "../../stores/sessionStore";

type Props = {
  dock: CliDock;
  size: number;
  onDockChange: (dock: CliDock) => void;
  onSizeChange: (size: number) => void;
  children: ReactNode;
};

const EDGE = 56;

function clampSize(size: number, dock: CliDock, host: HTMLElement) {
  const max =
    dock === "bottom"
      ? Math.max(148, Math.floor(host.clientHeight * 0.35))
      : Math.max(160, Math.floor(host.clientWidth * 0.45));
  return Math.max(72, Math.min(max, Math.round(size)));
}

export function CliFrame({
  dock,
  size,
  onDockChange,
  onSizeChange,
  children,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef(dock);
  const onSizeChangeRef = useRef(onSizeChange);
  dockRef.current = dock;
  onSizeChangeRef.current = onSizeChange;

  const [snapTarget, setSnapTarget] = useState<CliDock | null>(null);
  const [draggingDock, setDraggingDock] = useState(false);
  const resize = useRef<{
    pointerId: number;
    start: number;
    size: number;
    liveSize: number;
  } | null>(null);
  const dockDrag = useRef(false);

  const hostEl = () =>
    rootRef.current?.closest(".sticky-workspace") as HTMLElement | null;

  useEffect(() => {
    const applyLiveSize = (px: number) => {
      const value = `${px}px`;
      const host = hostEl();
      rootRef.current?.style.setProperty("--cli-size", value);
      host?.style.setProperty("--cli-size", value);
      const shell = host?.closest(".app-shell") as HTMLElement | null;
      shell?.style.setProperty("--cli-size", value);
    };

    const clearLiveOverrides = () => {
      const host = hostEl();
      rootRef.current?.style.removeProperty("--cli-size");
      host?.style.removeProperty("--cli-size");
      // app-shell keeps the live value until React commits onSizeChange
    };

    const onMove = (event: PointerEvent) => {
      const state = resize.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const host = hostEl();
      if (!host || !rootRef.current) return;
      event.preventDefault();
      const currentDock = dockRef.current;
      const delta =
        currentDock === "bottom"
          ? state.start - event.clientY
          : currentDock === "left"
            ? event.clientX - state.start
            : state.start - event.clientX;
      const next = clampSize(state.size + delta, currentDock, host);
      state.liveSize = next;
      applyLiveSize(next);
    };
    const onUp = (event: PointerEvent) => {
      const state = resize.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const finalSize = state.liveSize;
      clearLiveOverrides();
      resize.current = null;
      delete document.documentElement.dataset.cliResizing;
      onSizeChangeRef.current(finalSize);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const onResizeDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    document.documentElement.dataset.cliResizing = "1";
    const measured =
      dock === "bottom"
        ? rootRef.current?.getBoundingClientRect().height
        : rootRef.current?.getBoundingClientRect().width;
    const startSize = Math.round(measured || size);
    resize.current = {
      pointerId: event.pointerId,
      start: dock === "bottom" ? event.clientY : event.clientX,
      size: startSize,
      liveSize: startSize,
    };
  };

  const resolveSnap = useCallback((clientX: number, clientY: number) => {
    const host = hostEl();
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    const nearLeft = clientX - rect.left < EDGE;
    const nearRight = rect.right - clientX < EDGE;
    const nearBottom = rect.bottom - clientY < EDGE;
    if (nearLeft && !nearRight) return "left" as const;
    if (nearRight && !nearLeft) return "right" as const;
    if (nearBottom) return "bottom" as const;
    return null;
  }, []);

  const onDockPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    dockDrag.current = true;
    setDraggingDock(true);
    setSnapTarget(resolveSnap(event.clientX, event.clientY));
  };

  const onDockPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dockDrag.current) return;
    setSnapTarget(resolveSnap(event.clientX, event.clientY));
  };

  const endDockDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dockDrag.current) return;
    dockDrag.current = false;
    setDraggingDock(false);
    const target = resolveSnap(event.clientX, event.clientY);
    setSnapTarget(null);
    if (target && target !== dock) {
      onDockChange(target);
    }
  };

  useEffect(() => {
    if (!draggingDock) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dockDrag.current = false;
        setDraggingDock(false);
        setSnapTarget(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draggingDock]);

  return (
    <div
      ref={rootRef}
      className="cli-frame"
      data-dock={dock}
      style={{ "--cli-size": `${size}px` } as React.CSSProperties}
    >
      <div
        className="cli-resize-handle"
        onPointerDown={onResizeDown}
        title="Drag to resize terminal"
        aria-label="Resize terminal"
      />
      <div
        className="cli-dock-grip"
        onPointerDown={onDockPointerDown}
        onPointerMove={onDockPointerMove}
        onPointerUp={endDockDrag}
        onPointerCancel={endDockDrag}
        title="Drag to an edge to dock the terminal (like Windows snap)"
        aria-label="Dock terminal"
      >
        <span />
      </div>
      <div className="cli-frame-body">{children}</div>
      {draggingDock && (
        <div className="cli-snap-layer" aria-live="polite">
          {snapTarget && (
            <>
              <div className={`cli-snap-zone cli-snap-${snapTarget}`} />
              <div className="cli-snap-toast">
                Release to dock terminal {snapTarget}
              </div>
            </>
          )}
          {!snapTarget && (
            <div className="cli-snap-toast">
              Drag to a side or bottom edge to split the terminal
            </div>
          )}
        </div>
      )}
    </div>
  );
}
