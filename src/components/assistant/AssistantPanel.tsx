import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
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
import {
  buildChatContextPayload,
  clearChatContextCache,
  compactChatContextCache,
  createChatContextCache,
  type ChatContextPayload,
} from "../../services/chatContext";
import { CLOUD_MODELS, isLocalProvider } from "../../services/aiModels";
import { secretsGet } from "../../services/secrets";
import { parseGrokSegments } from "./grokSegments";
import { renderPythonCode } from "./pythonHighlight";
import { renderImportantProse } from "./renderImportantProse";
import {
  matchingSlashCommands,
  SlashCommandMenu,
  type SlashCommand,
} from "./SlashCommandMenu";

type Line = {
  id: number;
  kind: "system" | "command" | "output" | "error";
  text: string;
  streaming?: boolean;
};

type Props = {
  language: string;
  buffer: string;
  contextKey?: string;
  title?: string;
  cwd?: string;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  onOpenSettings: () => void;
};

const ASSISTANT_SLASH_COMMANDS: SlashCommand[] = [
  { id: "clear", label: "clear", description: "Clear this conversation" },
  { id: "context", label: "context", description: "Clear file/chat context memory only" },
  { id: "settings", label: "settings", description: "Open AI settings" },
  { id: "close", label: "close", description: "Close Assistant" },
];

const ASSISTANT_WELCOME =
  "Assistant ready. Chat about code, files, or your workspace. Use coach for DSA practice.";

function historyForLocalSpeed(
  provider: ChatProviderId,
  mode: "fast" | "balanced" | "full",
  history: ChatMessage[],
): ChatMessage[] {
  if (!isLocalProvider(provider)) return history;
  if (mode === "fast") return [];
  if (mode === "balanced") return history.slice(-4);
  return history.slice(-10);
}

function revealStepForMode(
  mode: "fast" | "smooth" | "silky",
  backlog: number,
): number {
  if (mode === "fast") {
    return backlog > 120 ? Math.ceil(backlog / 10) : backlog > 36 ? 2 : 1;
  }
  if (mode === "silky") {
    return backlog > 140 ? Math.ceil(backlog / 20) : backlog > 56 ? 2 : 1;
  }
  return backlog > 120 ? Math.ceil(backlog / 14) : backlog > 40 ? 2 : 1;
}

let lineId = 0;

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="grok-code-copy"
      onClick={() => {
        void navigator.clipboard.writeText(code).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? "Copied" : "Copy all"}
    </button>
  );
}

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
              {renderImportantProse(segment.text)}
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
              {renderImportantProse(segment.raw)}
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
              {segment.code.trim() ? <CopyCodeButton code={segment.code} /> : null}
            </div>
            <pre className="grok-code">
              {isPython ? renderPythonCode(segment.code) : segment.code}
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
  contextKey,
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
      text: ASSISTANT_WELCOME,
    },
  ]);
  const [input, setInput] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [provider, setProvider] = useState<ChatProviderId>(
    ai.assistantProvider,
  );
  const [model, setModel] = useState(ai.assistantModel);
  const [contextMeta, setContextMeta] = useState<ChatContextPayload["meta"]>();
  const [modelBarOpen, setModelBarOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const followOutputRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const contextCacheRef = useRef(createChatContextCache());
  const historyRef = useRef<ChatMessage[]>([]);
  const streamTargetText = useRef("");
  const streamDisplayText = useRef("");
  const streamAnimRaf = useRef<number | null>(null);
  const activeRequestIdRef = useRef(0);
  const activeOutputIdRef = useRef<number | null>(null);

  const paintStream = (id: number) => {
    const text = streamDisplayText.current;
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, text, streaming: true } : line,
      ),
    );
  };

  const tickReveal = (id: number, requestId: number) => {
    if (activeRequestIdRef.current !== requestId) {
      streamAnimRaf.current = null;
      return;
    }
    const target = streamTargetText.current;
    const shown = streamDisplayText.current;
    if (shown.length >= target.length) {
      streamAnimRaf.current = null;
      paintStream(id);
      return;
    }
    const backlog = target.length - shown.length;
    const step = revealStepForMode(ai.localStreamMode, backlog);
    streamDisplayText.current = target.slice(0, shown.length + step);
    paintStream(id);
    streamAnimRaf.current = requestAnimationFrame(() =>
      tickReveal(id, requestId),
    );
  };

  const queueToken = (id: number, requestId: number, token: string) => {
    if (activeRequestIdRef.current !== requestId) return;
    streamTargetText.current += token;
    if (streamAnimRaf.current == null) {
      streamAnimRaf.current = requestAnimationFrame(() =>
        tickReveal(id, requestId),
      );
    }
  };

  const stopStreaming = () => {
    if (!busy) return;
    activeRequestIdRef.current += 1;
    if (streamAnimRaf.current != null) {
      cancelAnimationFrame(streamAnimRaf.current);
      streamAnimRaf.current = null;
    }
    const outId = activeOutputIdRef.current;
    if (outId != null) {
      patchLine(outId, { text: streamDisplayText.current, streaming: false });
    }
    activeOutputIdRef.current = null;
    setBusy(false);
    append("system", "Stopped response.");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const usingLocalCompactContext =
    isLocalProvider(provider) && ai.localContextSource === "file";

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    setHistory([]);
    historyRef.current = [];
    setContextMeta(undefined);
  }, [contextKey]);

  const clearConversation = () => {
    clearChatContextCache(contextCacheRef.current, contextKey);
    historyRef.current = [];
    setHistory([]);
    setContextMeta(undefined);
    setLines([
      {
        id: lineId++,
        kind: "system",
        text:
          ai.localContextSource === "file"
            ? "Conversation cleared. File mode still uses your open editor file on the next question."
            : "Conversation cleared. Ask a new question anytime.",
      },
    ]);
  };

  const clearLocalSession = () => {
    clearChatContextCache(contextCacheRef.current, contextKey);
    historyRef.current = [];
    setHistory([]);
    setContextMeta(undefined);
    append(
      "system",
      ai.localContextSource === "file"
        ? "Cleared chat history. File mode still attaches your open editor file."
        : "Cleared local chat history.",
    );
  };

  const compactLocalSession = () => {
    if (usingLocalCompactContext) {
      compactChatContextCache(contextCacheRef.current, contextKey);
    }
    setHistory((current) => {
      const next = current.slice(-2);
      historyRef.current = next;
      return next;
    });
    setContextMeta(undefined);
    append(
      "system",
      usingLocalCompactContext
        ? "Compacted local context for this file and trimmed recent chat memory."
        : "Compacted local chat memory to the most recent turns.",
    );
  };

  const append = (kind: Line["kind"], text: string, streaming = false) => {
    const id = lineId++;
    setLines((current) => [
      ...current.slice(-80),
      { id, kind, text, streaming },
    ]);
    return id;
  };

  const patchLine = (id: number, patch: Partial<Line>) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  };

  useEffect(() => {
    const output = listRef.current;
    if (!output || !followOutputRef.current) return;
    output.scrollTop = output.scrollHeight;
  }, [lines]);

  const onOutputScroll = () => {
    const output = listRef.current;
    if (!output) return;
    followOutputRef.current =
      output.scrollHeight - output.scrollTop - output.clientHeight < 24;
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(
    () => () => {
      if (streamAnimRaf.current != null) {
        cancelAnimationFrame(streamAnimRaf.current);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (provider === "ollama" || provider === "lmstudio") {
        try {
          const baseUrl = baseUrlForProvider(provider, {
            ollamaBaseUrl: ai.ollamaBaseUrl,
            lmstudioBaseUrl: ai.lmstudioBaseUrl,
          });
          const listed = await listLocalModels(provider, baseUrl);
          if (cancelled) return;
          const ids = listed.map((item) => item.id);
          setModels(ids);
          if (!model && ids[0]) setModel(ids[0]);
          if (model && ids.length && !ids.includes(model))
            setModel(ids[0] ?? "");
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
  }, [provider, model, ai.ollamaBaseUrl, ai.lmstudioBaseUrl]);

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
    if (/^(clear|cls|\/clear)$/i.test(trimmed)) {
      clearConversation();
      return;
    }
    setBusy(true);
    append("command", `you> ${trimmed}`);
    const outId = append("output", "", true);
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    activeOutputIdRef.current = outId;
    streamTargetText.current = "";
    streamDisplayText.current = "";
    try {
      const needsKey =
        provider === "xai" || provider === "openai" || provider === "anthropic";
      const apiKey = needsKey ? await secretsGet(provider) : null;
      if (needsKey && !apiKey?.trim()) {
        throw new Error(
          `Add a ${provider} API key in AI keys (Menu → AI keys, or type env).`,
        );
      }
      // File mode attaches the open buffer; Chat mode is conversation-only.
      const includeFileContext =
        ai.localContextSource === "file" && Boolean(buffer.trim());
      const activeHistory = historyRef.current;
      const context =
        includeFileContext && usingLocalCompactContext
          ? buildChatContextPayload({
              cache: contextCacheRef.current,
              provider,
              model: model || "",
              language,
              buffer,
              isLocal: true,
              fileKey: contextKey,
              localMode: ai.localContextMode,
              question: trimmed,
              history: activeHistory,
            })
          : {
              buffer: includeFileContext ? buffer : "",
              contextOverride: undefined,
              meta: undefined,
            };
      setContextMeta(context.meta);
      const result = await chatCompletion({
        provider,
        question: trimmed,
        language,
        buffer: context.buffer,
        contextOverride: context.contextOverride,
        includeContext: includeFileContext,
        model: model || undefined,
        apiKey,
        baseUrl: baseUrlForProvider(provider, ai),
        history: historyForLocalSpeed(
          provider,
          ai.localContextMode,
          activeHistory,
        ),
        onToken: (text) => queueToken(outId, requestId, text),
      });
      if (activeRequestIdRef.current !== requestId) return;
      streamTargetText.current = result.reply;
      await new Promise<void>((resolve) => {
        const finish = () => {
          if (activeRequestIdRef.current !== requestId) {
            resolve();
            return;
          }
          if (
            streamDisplayText.current.length >= streamTargetText.current.length
          ) {
            if (streamAnimRaf.current != null) {
              cancelAnimationFrame(streamAnimRaf.current);
              streamAnimRaf.current = null;
            }
            resolve();
            return;
          }
          if (streamAnimRaf.current == null) {
            streamAnimRaf.current = requestAnimationFrame(() =>
              tickReveal(outId, requestId),
            );
          }
          requestAnimationFrame(finish);
        };
        finish();
      });
      if (activeRequestIdRef.current !== requestId) return;
      patchLine(outId, { text: result.reply, streaming: false });
      activeOutputIdRef.current = null;
      setHistory((current) => {
        const next = [
          ...current.slice(-18),
          { role: "user" as const, content: trimmed },
          { role: "assistant" as const, content: result.reply },
        ];
        historyRef.current = next;
        return next;
      });
      ai.setAssistantProvider(provider);
      ai.setAssistantModel(result.model);
    } catch (error) {
      if (activeRequestIdRef.current !== requestId) return;
      if (streamAnimRaf.current != null) {
        cancelAnimationFrame(streamAnimRaf.current);
        streamAnimRaf.current = null;
      }
      activeOutputIdRef.current = null;
      patchLine(outId, {
        kind: "error",
        text: normalizeError(error).message,
        streaming: false,
      });
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setBusy(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = input;
    setInput("");
    void ask(value);
  };

  const runSlashCommand = (command: SlashCommand) => {
    setInput("");
    setSlashIndex(0);
    if (command.id === "clear") {
      clearConversation();
      return;
    }
    if (command.id === "context") {
      clearLocalSession();
      return;
    }
    if (command.id === "settings") {
      onOpenSettings();
      return;
    }
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const slashMatches = matchingSlashCommands(
      ASSISTANT_SLASH_COMMANDS,
      input.slice(1),
    );
    if (input.startsWith("/") && slashMatches.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setSlashIndex((current) =>
          (current + step + slashMatches.length) % slashMatches.length,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        runSlashCommand(slashMatches[Math.min(slashIndex, slashMatches.length - 1)]!);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setInput("");
        setSlashIndex(0);
        return;
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const fileLabel = title?.trim() || "untitled";

  return (
    <section ref={paneRef} className="grok-cli-pane" aria-label="Assistant">
      <div
        className="grok-resize-handle"
        title="Drag to resize Assistant"
        onPointerDown={onResizeDown}
      />
      <header className="grok-cli-header">
        <div className="grok-cli-header-left">
          <span className="grok-cli-title">assistant · {fileLabel}</span>
          <button
            type="button"
            className="assistant-model-toggle"
            aria-expanded={modelBarOpen}
            aria-controls="assistant-model-bar"
            title={modelBarOpen ? "Hide model settings" : "Show model settings"}
            onClick={() => setModelBarOpen((open) => !open)}
          >
            ▾
          </button>
        </div>
        <div className="grok-cli-header-actions">
          {busy ? (
            <button type="button" onClick={stopStreaming} title="Stop response">
              stop
            </button>
          ) : null}
          <button type="button" onClick={onOpenSettings} title="AI environment">
            …
          </button>
          <button type="button" onClick={onClose} title="Close Assistant (Esc)">
            x
          </button>
        </div>
      </header>
      <div
        className="assistant-model-bar-shell"
        data-open={modelBarOpen ? "1" : "0"}
      >
        <div className="assistant-model-bar-clip">
          <div
            id="assistant-model-bar"
            className="assistant-model-bar"
            aria-hidden={!modelBarOpen}
          >
        <div className="assistant-model-bar-row">
          <label className="assistant-model-primary">
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
              <option value="xai">xAI</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
          <label className="assistant-model-primary">
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
        <div className="assistant-model-bar-row">
          <label className="assistant-model-compact">
            <span className="sr-only">Context source</span>
            <select
              value={ai.localContextSource}
              onChange={(event) =>
                ai.setLocalContextSource(
                  event.target.value as typeof ai.localContextSource,
                )
              }
              disabled={busy}
              title="File = attach open editor buffer; Chat = conversation only"
            >
              <option value="file">File</option>
              <option value="chat">Chat</option>
            </select>
          </label>
          <label className="assistant-model-compact">
            <span className="sr-only">Speed</span>
            <select
              value={ai.localContextMode}
              onChange={(event) =>
                ai.setLocalContextMode(
                  event.target.value as typeof ai.localContextMode,
                )
              }
              disabled={busy}
              title="Local model speed mode"
            >
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="full">Full</option>
            </select>
          </label>
          <label className="assistant-model-compact">
            <span className="sr-only">Stream</span>
            <select
              value={ai.localStreamMode}
              onChange={(event) =>
                ai.setLocalStreamMode(
                  event.target.value as typeof ai.localStreamMode,
                )
              }
              disabled={busy}
              title="Local stream style"
            >
              <option value="fast">Fast</option>
              <option value="smooth">Smooth</option>
              <option value="silky">Silky</option>
            </select>
          </label>
          {isLocalProvider(provider) ? (
            <div className="assistant-model-actions">
              {usingLocalCompactContext && contextMeta ? (
                <div
                  className="context-meter"
                  title={`Local context ${contextMeta.usedChars}/${contextMeta.budgetChars}${contextMeta.compacted ? " (compacted)" : ""}`}
                >
                  <span
                    className="context-meter-ring"
                    style={
                      {
                        "--context-ratio": String(contextMeta.ratio),
                      } as CSSProperties
                    }
                  />
                </div>
              ) : null}
              <button
                type="button"
                className="context-action-btn"
                onClick={clearConversation}
                disabled={busy}
                title="Clear this conversation (all chat text + memory)"
              >
                Clear
              </button>
              <button
                type="button"
                className="context-action-btn"
                onClick={compactLocalSession}
                disabled={busy}
                title="Compact local session context"
              >
                Compact
              </button>
            </div>
          ) : null}
        </div>
          </div>
        </div>
      </div>
      <div
        className="grok-cli-output"
        ref={listRef}
        onScroll={onOutputScroll}
        aria-live="polite"
      >
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
        {input.startsWith("/") && (
          <SlashCommandMenu
            commands={ASSISTANT_SLASH_COMMANDS}
            query={input.slice(1)}
            activeIndex={slashIndex}
            onChoose={runSlashCommand}
          />
        )}
        <span className="grok-cli-prompt" aria-hidden="true">
          ai&gt;
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setSlashIndex(0);
          }}
          onKeyDown={onKeyDown}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          aria-label="Ask Assistant"
          placeholder={busy ? "Streaming…" : "/ for Commands"}
        />
      </form>
    </section>
  );
}
