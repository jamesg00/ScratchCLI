import { useEffect } from "react";
import { useSessionStore, type TabDropEdge } from "../../stores/sessionStore";
import { useTabDragStore } from "../../stores/tabDragStore";

function edgeFromRect(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): TabDropEdge {
  const x = (clientX - rect.left) / Math.max(1, rect.width);
  const y = (clientY - rect.top) / Math.max(1, rect.height);
  const band = 0.25;
  if (x < band) return "left";
  if (x > 1 - band) return "right";
  if (y < band) return "top";
  if (y > 1 - band) return "bottom";
  return "center";
}

/** Global pointer listeners that dock a dragged tab onto editor drop targets. */
export function TabDragController() {
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = useTabDragStore.getState();
      if (!drag.tabId) return;
      drag.updatePointer(event.clientX, event.clientY);
      if (!useTabDragStore.getState().active) return;

      document.documentElement.dataset.tabDragging = "1";

      const top = document.elementFromPoint(event.clientX, event.clientY);
      const hit =
        top instanceof Element
          ? top.closest<HTMLElement>("[data-tab-drop-pane]")
          : null;

      if (!hit) {
        drag.setTarget(null, null);
        return;
      }
      const paneIndex = Number(hit.dataset.tabDropPane);
      if (!Number.isFinite(paneIndex)) {
        drag.setTarget(null, null);
        return;
      }
      drag.setTarget(
        paneIndex,
        edgeFromRect(hit.getBoundingClientRect(), event.clientX, event.clientY),
      );
    };

    const finish = () => {
      const drag = useTabDragStore.getState();
      if (!drag.tabId) return;
      const { tabId, active, edge, paneIndex } = drag;
      // Capture target before end() clears it.
      const shouldDock = active && edge !== null && paneIndex !== null;
      drag.end();
      delete document.documentElement.dataset.tabDragging;

      if (!shouldDock || edge === null || paneIndex === null) return;
      useSessionStore.getState().dockTabDrop(tabId, edge, paneIndex);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, []);

  const drag = useTabDragStore();
  if (!drag.tabId || !drag.active) return null;

  return (
    <div
      className="tab-drag-ghost"
      style={{ transform: `translate(${drag.x + 14}px, ${drag.y + 14}px)` }}
    >
      {drag.title || "tab"}
    </div>
  );
}
