import type { ChatProviderId } from "./chat";
import { secretsGet } from "./secrets";
import {
  baseUrlForProvider,
  type AiProviderPrefs,
} from "../stores/aiSettingsStore";
import { providerNeedsApiKey } from "./aiModels";

export type ResolvedAiChat = {
  provider: ChatProviderId;
  model: string | undefined;
  apiKey: string | null;
  baseUrl: string | null;
};

export async function resolveAiChat(options: {
  provider: ChatProviderId;
  model: string;
  settings: Pick<AiProviderPrefs, "ollamaBaseUrl" | "lmstudioBaseUrl">;
}): Promise<ResolvedAiChat> {
  const { provider, model, settings } = options;
  const needsKey = providerNeedsApiKey(provider);
  const apiKey = needsKey ? await secretsGet(provider) : null;
  if (needsKey && !apiKey?.trim()) {
    throw new Error(
      `Add a ${provider} API key in AI keys (Menu → AI keys, or type env).`,
    );
  }
  return {
    provider,
    model: model.trim() || undefined,
    apiKey,
    baseUrl: baseUrlForProvider(provider, settings),
  };
}
