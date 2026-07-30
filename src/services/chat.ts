import { Channel, invoke } from "@tauri-apps/api/core";

export type ChatProviderId =
  "ollama" | "lmstudio" | "xai" | "openai" | "anthropic";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResult = {
  reply: string;
  model: string;
  provider: string;
};

export type ChatModelInfo = {
  id: string;
  provider: string;
  label: string;
};

export type ChatTokenEvent = {
  text: string;
};

export async function chatCompletion(options: {
  provider: ChatProviderId | string;
  question: string;
  systemPrompt?: string;
  language?: string;
  buffer?: string;
  contextOverride?: string;
  includeContext?: boolean;
  model?: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  history?: ChatMessage[];
  onToken?: (text: string) => void;
}): Promise<ChatResult> {
  const onToken = new Channel<ChatTokenEvent>();
  onToken.onmessage = (event) => {
    if (event.text) options.onToken?.(event.text);
  };

  return invoke<ChatResult>("chat_completion", {
    provider: options.provider,
    question: options.question,
    systemPrompt: options.systemPrompt ?? null,
    language: options.language ?? null,
    buffer: options.buffer ?? null,
    contextOverride: options.contextOverride ?? null,
    includeContext: options.includeContext ?? true,
    model: options.model ?? null,
    apiKey: options.apiKey ?? null,
    baseUrl: options.baseUrl ?? null,
    history: options.history ?? null,
    onToken,
  });
}

export async function listLocalModels(
  provider: "ollama" | "lmstudio",
  baseUrl?: string | null,
): Promise<ChatModelInfo[]> {
  return invoke<ChatModelInfo[]>("list_local_models", {
    provider,
    baseUrl: baseUrl ?? null,
  });
}

export async function whichCommand(name: string): Promise<string | null> {
  return invoke<string | null>("which_command", { name });
}
