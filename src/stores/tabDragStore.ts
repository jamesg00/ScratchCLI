import { create } from "zustand";
import type { TabDropEdge } from "../stores/sessionStore";

type TabDragState = {
  tabId: string | null;
  title: string;
  x: number;
  y: number;
  edge: TabDropEdge | null;
  paneIndex: number | null;
  /** True only after the pointer moved enough to count as a drag. */
  active: boolean;
  /** Set when a drag completed so the following click is ignored. */
  suppressClick: boolean;
  originX: number;
  originY: number;
  begin: (tabId: string, title: string, x: number, y: number) => void;
  updatePointer: (x: number, y: number) => void;
  setTarget: (paneIndex: number | null, edge: TabDropEdge | null) => void;
  end: () => void;
  consumeSuppressClick: () => boolean;
};

const DRAG_THRESHOLD = 6;

export const useTabDragStore = create<TabDragState>((set, get) => ({
  tabId: null,
  title: "",
  x: 0,
  y: 0,
  edge: null,
  paneIndex: null,
  active: false,
  suppressClick: false,
  originX: 0,
  originY: 0,
  begin: (tabId, title, x, y) =>
    set({
      tabId,
      title,
      x,
      y,
      originX: x,
      originY: y,
      active: false,
      edge: null,
      paneIndex: null,
      suppressClick: false,
    }),
  updatePointer: (x, y) => {
    const state = get();
    if (!state.tabId) return;
    const moved =
      state.active ||
      Math.hypot(x - state.originX, y - state.originY) >= DRAG_THRESHOLD;
    set({
      x,
      y,
      active: moved,
    });
  },
  setTarget: (paneIndex, edge) => set({ paneIndex, edge }),
  end: () => {
    const wasActive = get().active;
    set({
      tabId: null,
      title: "",
      x: 0,
      y: 0,
      edge: null,
      paneIndex: null,
      active: false,
      originX: 0,
      originY: 0,
      suppressClick: wasActive,
    });
  },
  consumeSuppressClick: () => {
    if (!get().suppressClick) return false;
    set({ suppressClick: false });
    return true;
  },
}));
