import type { ChatProviderId } from "./chat";

export const CLOUD_MODELS: Record<
  Exclude<ChatProviderId, "ollama" | "lmstudio">,
  string[]
> = {
  xai: ["grok-4-1-fast-non-reasoning", "grok-3-mini"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"],
};

export function providerNeedsApiKey(provider: ChatProviderId): boolean {
  return (
    provider === "xai" || provider === "openai" || provider === "anthropic"
  );
}

export function isLocalProvider(provider: ChatProviderId): boolean {
  return provider === "ollama" || provider === "lmstudio";
}

export function isProviderConfigured(
  provider: ChatProviderId,
  keys: Partial<Record<"xai" | "openai" | "anthropic", string>>,
): boolean {
  if (isLocalProvider(provider)) return true;
  if (provider === "xai") return Boolean(keys.xai?.trim());
  if (provider === "openai") return Boolean(keys.openai?.trim());
  if (provider === "anthropic") return Boolean(keys.anthropic?.trim());
  return false;
}

export function isAnyAiConfigured(options: {
  assistantProvider: ChatProviderId;
  coachProvider: ChatProviderId;
  keys: Partial<Record<"xai" | "openai" | "anthropic", string>>;
}): boolean {
  return (
    isProviderConfigured(options.assistantProvider, options.keys) ||
    isProviderConfigured(options.coachProvider, options.keys)
  );
}
