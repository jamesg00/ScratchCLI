import { Channel, invoke } from "@tauri-apps/api/core";

export type GrokChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GrokChatResult = {
  reply: string;
  model: string;
};

export type GrokTokenEvent = {
  text: string;
};

export async function grokChat(options: {
  apiKey: string;
  question: string;
  language?: string;
  buffer?: string;
  includeContext?: boolean;
  model?: string;
  history?: GrokChatMessage[];
  onToken?: (text: string) => void;
}): Promise<GrokChatResult> {
  const onToken = new Channel<GrokTokenEvent>();
  onToken.onmessage = (event) => {
    if (event.text) options.onToken?.(event.text);
  };

  return invoke<GrokChatResult>("grok_chat", {
    apiKey: options.apiKey,
    question: options.question,
    language: options.language ?? null,
    buffer: options.buffer ?? null,
    includeContext: options.includeContext ?? true,
    model: options.model ?? null,
    history: options.history ?? null,
    onToken,
  });
}
