import { invoke } from "@tauri-apps/api/core";

export type SecretProvider =
  | "ollama"
  | "lmstudio"
  | "xai"
  | "openai"
  | "anthropic";

export async function secretsGet(
  provider: SecretProvider | string,
): Promise<string | null> {
  return invoke<string | null>("secrets_get", { provider });
}

export async function secretsSet(
  provider: SecretProvider | string,
  value: string,
): Promise<void> {
  await invoke("secrets_set", { provider, value });
}

export async function secretsListProviders(): Promise<string[]> {
  return invoke<string[]>("secrets_list_providers");
}
