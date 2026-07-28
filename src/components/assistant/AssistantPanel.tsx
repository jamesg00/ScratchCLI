import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  baseUrlForProvider,
  useAiSettingsStore,
} from "../../stores/aiSettingsStore";
import { normalizeError } from "../../types/error";
import {
  chatCompletion,
  listLocalModels,
  type ChatMessage,
  type ChatProviderId,
} from "../../services/chat";
import { secretsGet } from "../../services/secrets";
import { parseGrokSegments } from "./grokSegments";
import { renderPythonCode } from "./pythonHighlight";

type Line = {
  id: number;
  kind: "system" | "command" | "output" | "error";
  text: string;
  streaming?: boolean;
};

type Props = {
  language: string;
  buffer: string;
  title?: string;
  cwd?: string;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  onOpenSettings: () => void;
};

let lineId = 0;

const CLOUD_MODELS: Record<string, string[]> = {
  xai: ["grok-4-1-fast-non-reasoning", "grok-3-mini"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-sonnet-4-20250514", "claude-3-5-haiku-latest"],
};

function AssistantOutput({
  text,
  language,
  streaming,
}: {
  text: string;
  language: string;
  streaming?: boolean;
}) {
  const segments = parseGrokSegments(text, language || "python");
  return (
    <div
      className="grok-message"
      data-kind="output"
      data-streaming={streaming ? "true" : undefined}
    >
      {segments.map((segment, index) => {
        if (segment.kind === "text") {
          return (
            <pre key={`t-${index}`} className="grok-prose">
              {segment.text}
              {streaming && index === segments.length - 1 ? (
                <span className="grok-caret" aria-hidden="true">
                  ▍
                </span>
              ) : null}
            </pre>
          );
        }
        if (segment.kind === "viz") {
          return (
            <pre key={`v-${index}`} className="grok-prose">
              {segment.raw}
            </pre>
          );
        }
        const isPython =
          segment.lang === "python" ||
          segment.lang === "py" ||
          (!segment.lang && language === "python");
        return (
          <div key={`c-${index}`} className="grok-code-block">
            <div className="grok-code-toolbar">
              <span className="grok-code-label">{segment.lang || "code"}</span>
            </div>
            <pre className="grok-code">
              {isPython
                ? renderPythonCode(segment.code)
                : segment.code}
              {streaming && index === segments.length - 1 ? (
                <span className="grok-caret" aria-hidden="true">
                  ▍
                </span>
              ) : null}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

export function AssistantPanel({
  language,
  buffer,
  title,
  cwd,
  width,
  onWidthChange,
  onClose,
  onOpenSettings,
}: Props) {
  const ai = useAiSettingsStore();
  const [lines, setLines] = useState<Line[]>([
    {
      id: lineId++,
      kind: "system",
      text: "Assistant ready. Chat about code, files, or your workspace. Use coach for DSA practice.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [provider, setProvider] = useState<ChatProviderId>(ai.assistantProvider);
  const [model, setModel] = useState(ai.assistantModel);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const append = (kind: Line["kind"], text: string, streaming = false) => {
    const id = lineId++;
    setLines((current) => [...current.slice(-80), { id, kind, text, streaming }]);
    return id;
  };

  const patchLine = (id: number, patch: Partial<Line>) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  };

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (provider === "ollama" || provider === "lmstudio") {
        try {
          const baseUrl = baseUrlForProvider(provider, ai);
          const listed = await listLocalModels(provider, baseUrl);
          if (cancelled) return;
          const ids = listed.map((item) => item.id);
          setModels(ids);
          if (!model && ids[0]) setModel(ids[0]);
          if (model && ids.length && !ids.includes(model)) setModel(ids[0] ?? "");
        } catch {
          if (!cancelled) setModels([]);
        }
      } else {
        setModels(CLOUD_MODELS[provider] ?? []);
        if (!model) setModel(CLOUD_MODELS[provider]?.[0] ?? "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, ai.ollamaBaseUrl, ai.lmstudioBaseUrl]);

  const onResizeDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const host = paneRef.current?.parentElement;
    const hostW = host?.clientWidth ?? window.innerWidth;
    dragRef.current = { startX: event.clientX, startWidth: width };
    const onMove = (move: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.min(
        Math.floor(hostW * 0.55),
        Math.max(240, drag.startWidth + (drag.startX - move.clientX)),
      );
      onWidthChange(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.dataset.grokResizing = "0";
    };
    document.documentElement.dataset.grokResizing = "1";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    append("command", `you> ${trimmed}`);
    const outId = append("output", "", true);
    try {
      const needsKey = provider === "xai" || provider === "openai" || provider === "anthropic";
      const apiKey = needsKey ? await secretsGet(provider) : null;
      if (needsKey && !apiKey?.trim()) {
        throw new Error(
          `Add a ${provider} API key in AI keys (Menu → AI keys, or type env).`,
        );
      }
      const result = await chatCompletion({
        provider,
        question: trimmed,
        language,
        buffer,
        includeContext: true,
        model: model || undefined,
        apiKey,
        baseUrl: baseUrlForProvider(provider, ai),
        history,
        onToken: (text) => {
          setLines((current) =>
            current.map((line) =>
              line.id === outId ? { ...line, text: `${line.text}${text}` } : line,
            ),
          );
        },
      });
      patchLine(outId, { text: result.reply, streaming: false });
      setHistory((current) => [
        ...current.slice(-18),
        { role: "user", content: trimmed },
        { role: "assistant", content: result.reply },
      ]);
      ai.setAssistantProvider(provider);
      ai.setAssistantModel(result.model);
    } catch (error) {
      patchLine(outId, {
        kind: "error",
        text: normalizeError(error).message,
        streaming: false,
      });
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = input;
    setInput("");
    void ask(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const fileLabel = title?.trim() || "untitled";

  return (
    <section
      ref={paneRef}
      className="grok-cli-pane"
      aria-label="Assistant"
    >
      <div
        className="grok-resize-handle"
        title="Drag to resize Assistant"
        onPointerDown={onResizeDown}
      />
      <header className="grok-cli-header">
        <span className="grok-cli-title">assistant · {fileLabel}</span>
        <button type="button" onClick={onOpenSettings} title="AI environment">
          …
        </button>
        <button type="button" onClick={onClose} title="Close Assistant (Esc)">
          x
        </button>
      </header>
      <div className="assistant-model-bar">
        <label>
          <span className="sr-only">Provider</span>
          <select
            value={provider}
            onChange={(event) => {
              const next = event.target.value as ChatProviderId;
              setProvider(next);
              setModel("");
            }}
            disabled={busy}
          >
            <option value="ollama">Ollama (local)</option>
            <option value="lmstudio">LM Studio (local)</option>
            <option value="xai">xAI / Grok</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Model</span>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={busy || models.length === 0}
          >
            {models.length === 0 ? (
              <option value="">No models found</option>
            ) : (
              models.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))
            )}
          </select>
        </label>
        {cwd ? (
          <span className="assistant-cwd" title={cwd}>
            {cwd.replace(/^.*[\\/]/, "")}
          </span>
        ) : null}
      </div>
      <div className="grok-cli-output" ref={listRef} aria-live="polite">
        {lines.map((line) =>
          line.kind === "output" ? (
            <AssistantOutput
              key={line.id}
              text={line.text}
              language={language}
              streaming={line.streaming}
            />
          ) : (
            <pre key={line.id} data-kind={line.kind}>
              {line.text}
            </pre>
          ),
        )}
      </div>
      <form className="grok-cli-input" onSubmit={onSubmit}>
        <span className="grok-cli-prompt" aria-hidden="true">
          ai&gt;
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          aria-label="Ask Assistant"
          placeholder={busy ? "Streaming…" : "Ask anything about your code…"}
        />
      </form>
    </section>
  );
}
