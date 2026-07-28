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
};

type AiSettingsState = AiProviderPrefs & {
  setOllamaBaseUrl: (url: string) => void;
  setLmstudioBaseUrl: (url: string) => void;
  setAssistantProvider: (provider: ChatProviderId) => void;
  setAssistantModel: (model: string) => void;
  setCoachProvider: (provider: ChatProviderId) => void;
  setCoachModel: (model: string) => void;
};

export const useAiSettingsStore = create<AiSettingsState>()(
  persist(
    (set) => ({
      ollamaBaseUrl: "http://127.0.0.1:11434",
      lmstudioBaseUrl: "http://127.0.0.1:1234",
      assistantProvider: "ollama",
      assistantModel: "",
      coachProvider: "xai",
      coachModel: "grok-4-1-fast-non-reasoning",
      setOllamaBaseUrl: (ollamaBaseUrl) => set({ ollamaBaseUrl }),
      setLmstudioBaseUrl: (lmstudioBaseUrl) => set({ lmstudioBaseUrl }),
      setAssistantProvider: (assistantProvider) => set({ assistantProvider }),
      setAssistantModel: (assistantModel) => set({ assistantModel }),
      setCoachProvider: (coachProvider) => set({ coachProvider }),
      setCoachModel: (coachModel) => set({ coachModel }),
    }),
    {
      name: "scratchcli-ai-settings",
      version: 1,
      // Never persist API keys here — only non-secret preferences.
      partialize: (state) => ({
        ollamaBaseUrl: state.ollamaBaseUrl,
        lmstudioBaseUrl: state.lmstudioBaseUrl,
        assistantProvider: state.assistantProvider,
        assistantModel: state.assistantModel,
        coachProvider: state.coachProvider,
        coachModel: state.coachModel,
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
