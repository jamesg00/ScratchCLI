import { COACH_SYSTEM_PROMPT } from "../components/assistant/coachSystemPrompt";
import type { ChatMessage, ChatResult } from "./chat";
import { chatCompletion } from "./chat";
import type { ChatProviderId } from "./chat";
import { resolveAiChat } from "./aiResolve";
import type { AiProviderPrefs } from "../stores/aiSettingsStore";

export type CoachChatMessage = ChatMessage;

export async function coachChat(options: {
  provider: ChatProviderId;
  model: string;
  settings: Pick<AiProviderPrefs, "ollamaBaseUrl" | "lmstudioBaseUrl">;
  question: string;
  language?: string;
  buffer?: string;
  contextOverride?: string;
  includeContext?: boolean;
  history?: CoachChatMessage[];
  onToken?: (text: string) => void;
}): Promise<ChatResult> {
  const resolved = await resolveAiChat({
    provider: options.provider,
    model: options.model,
    settings: options.settings,
  });

  return chatCompletion({
    provider: resolved.provider,
    question: options.question,
    systemPrompt: COACH_SYSTEM_PROMPT,
    language: options.language,
    buffer: options.buffer,
    contextOverride: options.contextOverride,
    includeContext: options.includeContext,
    model: resolved.model,
    apiKey: resolved.apiKey,
    baseUrl: resolved.baseUrl,
    history: options.history,
    onToken: options.onToken,
  });
}
