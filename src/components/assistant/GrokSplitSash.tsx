import { useEffect, useRef } from "react";

type Props = {
  width: number;
  onWidthChange: (width: number) => void;
};

const SASH = 6;
const MIN_GROK = 180;
const MIN_MAIN = 220;

type DragState = {
  pointerId: number;
  startX: number;
  startWidth: number;
  liveWidth: number;
};

/** Dedicated column sash between main workspace and Grok terminal. */
export function GrokSplitSash({ width, onWidthChange }: Props) {
  const onWidthChangeRef = useRef(onWidthChange);
  onWidthChangeRef.current = onWidthChange;
  const drag = useRef<DragState | null>(null);

  useEffect(() => {
    const hostEl = () =>
      document.querySelector(".grok-split") as HTMLElement | null;

    const clamp = (raw: number, hostW: number) => {
      const max = Math.max(
        MIN_GROK,
        Math.min(Math.floor(hostW * 0.55), hostW - MIN_MAIN - SASH),
      );
      return Math.min(max, Math.max(MIN_GROK, Math.round(raw)));
    };

    const onMove = (event: PointerEvent) => {
      const state = drag.current;
      if (!state || event.pointerId !== state.pointerId) return;
      event.preventDefault();
      const host = hostEl();
      const hostW = host?.clientWidth || window.innerWidth;
      // Drag sash left → wider Grok; right → narrower.
      const next = clamp(
        state.startWidth - (event.clientX - state.startX),
        hostW,
      );
      state.liveWidth = next;
      host?.style.setProperty("--grok-width", `${next}px`);
    };

    const onUp = (event: PointerEvent) => {
      const state = drag.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const finalWidth = state.liveWidth;
      drag.current = null;
      delete document.documentElement.dataset.grokResizing;
      hostEl()?.style.removeProperty("--grok-width");
      onWidthChangeRef.current(finalWidth);
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

  return (
    <div
      className="grok-split-sash"
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-label="Resize DSA coach"
      title="Drag to resize DSA coach"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        document.documentElement.dataset.grokResizing = "1";
        try {
          (event.target as HTMLElement).setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: width,
          liveWidth: width,
        };
      }}
    />
  );
}
