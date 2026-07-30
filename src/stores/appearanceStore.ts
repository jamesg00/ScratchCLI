import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FONT } from "../fonts/catalog";

export type ThemeName = "light" | "dark" | "pro" | "comet";

type AppearanceState = {
  theme: ThemeName;
  fontFamily: string;
  fontSize: number;
  backgroundColor: string | null;
  foregroundColor: string | null;
  opacity: number;
  /** Last transparent opacity used before `opacity off` (fully opaque). */
  opacitySaved: number;
  grokApiKey: string;
  matrixRain: boolean;
  prettySymbols: boolean;
  setTheme: (theme: ThemeName) => void;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setBackgroundColor: (backgroundColor: string | null) => void;
  setForegroundColor: (foregroundColor: string | null) => void;
  setOpacity: (opacity: number) => void;
  setOpacityOn: () => void;
  setOpacityOff: () => void;
  setGrokApiKey: (grokApiKey: string) => void;
  setMatrixRain: (matrixRain: boolean) => void;
  setPrettySymbols: (prettySymbols: boolean) => void;
};

import { secretsGet, secretsSet } from "../services/secrets";

function clampOpacity(opacity: number): number {
  if (!Number.isFinite(opacity)) return 1;
  return Math.min(1, Math.max(0, opacity));
}

/** Hydrate xAI key from app-data secrets into memory (never Zustand-persisted). */
export async function hydrateGrokApiKeyFromSecrets(): Promise<void> {
  try {
    const key = await secretsGet("xai");
    if (key?.trim()) {
      useAppearanceStore.setState({ grokApiKey: key });
    }
  } catch {
    /* ignore when backend unavailable (vite-only) */
  }
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set, get) => ({
      theme: "light",
      fontFamily: DEFAULT_FONT.value,
      fontSize: 14,
      backgroundColor: null,
      foregroundColor: null,
      opacity: 0.92,
      opacitySaved: 0.85,
      grokApiKey: "",
      matrixRain: false,
      prettySymbols: true,
      setTheme: (theme) =>
        set({
          theme,
          backgroundColor: null,
          foregroundColor: null,
          opacity: theme === "pro" || theme === "comet" ? 0.78 : 0.96,
        }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) =>
        set({
          fontSize: Math.min(30, Math.max(10, Math.round(fontSize))),
        }),
      setBackgroundColor: (backgroundColor) => set({ backgroundColor }),
      setForegroundColor: (foregroundColor) => set({ foregroundColor }),
      setOpacity: (opacity) => {
        const next = clampOpacity(opacity);
        set({
          opacity: next,
          ...(next < 1 ? { opacitySaved: next } : {}),
        });
      },
      setOpacityOn: () => {
        const saved = clampOpacity(get().opacitySaved || 0.85);
        const next = saved >= 1 ? 0.85 : saved;
        set({ opacity: next, opacitySaved: next });
      },
      setOpacityOff: () => {
        const current = get().opacity;
        set({
          opacity: 1,
          ...(current < 1 ? { opacitySaved: current } : {}),
        });
      },
      setGrokApiKey: (grokApiKey) => {
        set({ grokApiKey });
        void secretsSet("xai", grokApiKey).catch(() => undefined);
      },
      setMatrixRain: (matrixRain) => set({ matrixRain }),
      setPrettySymbols: (prettySymbols) => set({ prettySymbols }),
    }),
    {
      name: "scratchcli-appearance",
      version: 1,
      partialize: (state) => ({
        theme: state.theme,
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        backgroundColor: state.backgroundColor,
        foregroundColor: state.foregroundColor,
        opacity: state.opacity,
        opacitySaved: state.opacitySaved,
        matrixRain: state.matrixRain,
        prettySymbols: state.prettySymbols,
      }),
      migrate: (persisted) => {
        const safe = { ...(persisted as Partial<AppearanceState>) };
        delete safe.grokApiKey;
        return safe as AppearanceState;
      },
    },
  ),
);
