import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatProviderId } from "../services/chat";

export type AiProviderPrefs = {
  ollamaBaseUrl: string;
  lmstudioBaseUrl: string;
  assistantProvider: ChatProviderId;
  assistantModel: string;
  coachProvider: ChatProviderId;
  coachModel: string;
  localContextSource: "chat" | "file";
  localContextMode: "fast" | "balanced" | "full";
  localStreamMode: "fast" | "smooth" | "silky";
};

type AiSettingsState = AiProviderPrefs & {
  setOllamaBaseUrl: (url: string) => void;
  setLmstudioBaseUrl: (url: string) => void;
  setAssistantProvider: (provider: ChatProviderId) => void;
  setAssistantModel: (model: string) => void;
  setCoachProvider: (provider: ChatProviderId) => void;
  setCoachModel: (model: string) => void;
  setLocalContextSource: (
    source: AiProviderPrefs["localContextSource"],
  ) => void;
  setLocalContextMode: (mode: AiProviderPrefs["localContextMode"]) => void;
  setLocalStreamMode: (mode: AiProviderPrefs["localStreamMode"]) => void;
};

export const useAiSettingsStore = create<AiSettingsState>()(
  persist(
    (set) => ({
      ollamaBaseUrl: "http://127.0.0.1:11434",
      lmstudioBaseUrl: "http://127.0.0.1:1234",
      assistantProvider: "ollama",
      assistantModel: "",
      coachProvider: "ollama",
      coachModel: "",
      localContextSource: "file",
      localContextMode: "balanced",
      localStreamMode: "smooth",
      setOllamaBaseUrl: (ollamaBaseUrl) => set({ ollamaBaseUrl }),
      setLmstudioBaseUrl: (lmstudioBaseUrl) => set({ lmstudioBaseUrl }),
      setAssistantProvider: (assistantProvider) => set({ assistantProvider }),
      setAssistantModel: (assistantModel) => set({ assistantModel }),
      setCoachProvider: (coachProvider) => set({ coachProvider }),
      setCoachModel: (coachModel) => set({ coachModel }),
      setLocalContextSource: (localContextSource) =>
        set({ localContextSource }),
      setLocalContextMode: (localContextMode) => set({ localContextMode }),
      setLocalStreamMode: (localStreamMode) => set({ localStreamMode }),
    }),
    {
      name: "scratchcli-ai-settings",
      version: 7,
      migrate: (persisted, fromVersion) => {
        const state = persisted as Partial<AiProviderPrefs>;
        if (fromVersion < 2) {
          return {
            ...state,
            coachProvider: state.coachProvider ?? "ollama",
            coachModel:
              state.coachProvider === "xai" ? (state.coachModel ?? "") : "",
            localContextSource: "file",
            localContextMode: "fast",
            localStreamMode: "smooth",
          };
        }
        if (fromVersion < 3) {
          return {
            ...state,
            localContextSource: state.localContextSource ?? "file",
            localContextMode: state.localContextMode ?? "fast",
            localStreamMode: state.localStreamMode ?? "smooth",
          };
        }
        if (fromVersion < 4) {
          return {
            ...state,
            localContextSource: state.localContextSource ?? "file",
            localContextMode: state.localContextMode ?? "fast",
            localStreamMode: state.localStreamMode ?? "smooth",
          };
        }
        if (fromVersion < 5) {
          return {
            ...state,
            localContextSource: state.localContextSource ?? "file",
            localStreamMode: state.localStreamMode ?? "smooth",
          };
        }
        if (fromVersion < 6) {
          return {
            ...state,
            localContextSource: state.localContextSource ?? "file",
          };
        }
        if (fromVersion < 7) {
          return {
            ...state,
            localContextMode:
              state.localContextMode === "full" ? "full" : "balanced",
          };
        }
        return state as AiProviderPrefs;
      },
      // Never persist API keys here — only non-secret preferences.
      partialize: (state) => ({
        ollamaBaseUrl: state.ollamaBaseUrl,
        lmstudioBaseUrl: state.lmstudioBaseUrl,
        assistantProvider: state.assistantProvider,
        assistantModel: state.assistantModel,
        coachProvider: state.coachProvider,
        coachModel: state.coachModel,
        localContextSource: state.localContextSource,
        localContextMode: state.localContextMode,
        localStreamMode: state.localStreamMode,
      }),
    },
  ),
);

export function baseUrlForProvider(
  provider: ChatProviderId,
  settings: Pick<AiProviderPrefs, "ollamaBaseUrl" | "lmstudioBaseUrl">,
): string | null {
  if (provider === "ollama") return settings.ollamaBaseUrl;
  if (provider === "lmstudio") return settings.lmstudioBaseUrl;
  return null;
}
