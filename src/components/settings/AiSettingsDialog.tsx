import { useEffect, useState } from "react";
import { useAppearanceStore } from "../../stores/appearanceStore";
import { useAiSettingsStore } from "../../stores/aiSettingsStore";
import type { ChatProviderId } from "../../services/chat";
import { listLocalModels } from "../../services/chat";
import { secretsGet, secretsSet } from "../../services/secrets";

type Props = {
  onClose: () => void;
};

export function AiSettingsDialog({ onClose }: Props) {
  const appearance = useAppearanceStore();
  const ai = useAiSettingsStore();
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [localStatus, setLocalStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setOpenaiKey((await secretsGet("openai")) ?? "");
        setAnthropicKey((await secretsGet("anthropic")) ?? "");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const refreshLocal = async () => {
    setBusy(true);
    setLocalStatus("Probing local models…");
    try {
      const ollama = await listLocalModels("ollama", ai.ollamaBaseUrl).catch(
        () => [],
      );
      const lm = await listLocalModels("lmstudio", ai.lmstudioBaseUrl).catch(
        () => [],
      );
      setLocalStatus(
        `Ollama: ${ollama.length} model(s) · LM Studio: ${lm.length} model(s)`,
      );
      if (!ai.assistantModel && ollama[0]) {
        ai.setAssistantProvider("ollama");
        ai.setAssistantModel(ollama[0].id);
      }
    } catch (error) {
      setLocalStatus(
        error instanceof Error ? error.message : "Could not reach local models.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="appearance-dialog ai-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="ai-settings-title">AI keys</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            x
          </button>
        </header>
        <div className="appearance-dialog-body">
          <div className="ai-providers">
            <p className="ai-providers-help">
              Local URLs and API keys. Stored in app data, not the workspace.
              Claude/Codex use their own CLI login.
            </p>
            <label>
              Ollama URL
              <input
                value={ai.ollamaBaseUrl}
                onChange={(event) => ai.setOllamaBaseUrl(event.target.value)}
                placeholder="http://127.0.0.1:11434"
                spellCheck={false}
              />
            </label>
            <label>
              LM Studio URL
              <input
                value={ai.lmstudioBaseUrl}
                onChange={(event) => ai.setLmstudioBaseUrl(event.target.value)}
                placeholder="http://127.0.0.1:1234"
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void refreshLocal()}
            >
              Refresh models
            </button>
            {localStatus ? (
              <p className="ai-providers-status">{localStatus}</p>
            ) : null}
            <label>
              Assistant provider
              <select
                value={ai.assistantProvider}
                onChange={(event) =>
                  ai.setAssistantProvider(event.target.value as ChatProviderId)
                }
              >
                <option value="ollama">Ollama</option>
                <option value="lmstudio">LM Studio</option>
                <option value="xai">xAI</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </label>
            <label>
              Assistant model
              <input
                value={ai.assistantModel}
                onChange={(event) => ai.setAssistantModel(event.target.value)}
                placeholder="llama3.2"
                spellCheck={false}
              />
            </label>
            <label>
              DSA coach key (xAI)
              <input
                type="password"
                value={appearance.grokApiKey ?? ""}
                onChange={(event) =>
                  appearance.setGrokApiKey(event.target.value)
                }
                placeholder="xai-…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label>
              OpenAI key
              <input
                type="password"
                value={openaiKey}
                onChange={(event) => {
                  setOpenaiKey(event.target.value);
                  void secretsSet("openai", event.target.value).catch(
                    () => undefined,
                  );
                }}
                placeholder="sk-…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label>
              Anthropic key
              <input
                type="password"
                value={anthropicKey}
                onChange={(event) => {
                  setAnthropicKey(event.target.value);
                  void secretsSet("anthropic", event.target.value).catch(
                    () => undefined,
                  );
                }}
                placeholder="sk-ant-…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
        </div>
        <footer>
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
