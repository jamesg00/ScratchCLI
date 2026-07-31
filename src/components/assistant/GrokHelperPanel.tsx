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
  useAiSettingsStore,
  baseUrlForProvider,
} from "../../stores/aiSettingsStore";
import { useInterviewStore } from "../../stores/interviewStore";
import { normalizeError } from "../../types/error";
import { coachChat, type CoachChatMessage } from "../../services/coachChat";
import { listLocalModels, type ChatProviderId } from "../../services/chat";
import { CLOUD_MODELS, isLocalProvider } from "../../services/aiModels";
import {
  buildChatContextPayload,
  clearChatContextCache,
  compactChatContextCache,
  createChatContextCache,
  type ChatContextPayload,
} from "../../services/chatContext";
import { parseGrokSegments } from "./grokSegments";
import { renderPythonCode } from "./pythonHighlight";
import { renderImportantProse } from "./renderImportantProse";
import { renderPythonCheatSheet } from "./pythonCheatSheet";
import { CodeVizPlaceholder, CodeVizPlayer } from "./CodeVizPlayer";
import {
  buildSubmitFailPrompt,
  expandPracticeCommand,
  extractPracticeFile,
  extractPracticeKey,
  ensurePracticeTrackingLines,
  inventCoachDisplay,
  PRACTICE_SEAL_RETRY_PROMPT,
} from "./practiceFile";
import { sealPracticeFile } from "./sealPracticeTests";
import { fetchAndBuildLcPractice } from "./leetcodeFlow";
import { useLeetCodeStore } from "../../stores/leetcodeStore";
import { leetcodeListCompanies } from "../../services/leetcode";
import {
  resolveGuideFromReply,
  stripFullFileFencesFromReply,
  stripHintComments,
  wrapFreeformCoachPrompt,
} from "./hintGuide";
import { executePython } from "../../services/python";
import {
  looksLikePracticeFile,
  parseTestOutput,
} from "../practice/parseTestOutput";
import { estimatePythonComplexity } from "../practice/complexityEstimate";
import {
  matchingSlashCommands,
  SlashCommandMenu,
  type SlashCommand,
} from "./SlashCommandMenu";
import { useSessionStore } from "../../stores/sessionStore";
import { useStudyStore } from "../../stores/studyStore";

type Line = {
  id: number;
  kind: "system" | "command" | "output" | "error" | "done-list";
  text: string;
  streaming?: boolean;
  doneSlugs?: string[];
};

type CompanyOption = {
  name: string;
  slug: string;
  questionCount: number;
};

type Props = {
  language: string;
  buffer: string;
  contextKey?: string;
  title?: string;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onInsert: (text: string) => void;
  /** Replace the open buffer (used for `# HINT:` annotations). */
  onApplyBuffer?: (content: string) => void;
  onOpenSubmittedFile?: (path: string) => void;
  /** Open a finished problem from the done list (by slug). */
  onOpenDoneProblem?: (slug: string) => Promise<void> | void;
  onCreatePracticeFile: (file: {
    content: string;
    fileName: string;
  }) => Promise<string>;
  onOpenVisualize?: () => void;
  onOpenStudy?: () => void;
};

function historyForLocalSpeed(
  provider: ChatProviderId,
  mode: "fast" | "balanced" | "full",
  history: CoachChatMessage[],
): CoachChatMessage[] {
  if (!isLocalProvider(provider)) return history;
  if (mode === "fast") return [];
  if (mode === "balanced") return history.slice(-4);
  return history.slice(-10);
}

let lineId = 0;
const COMPANY_ALIASES: Record<string, string> = {
  amazon: "amazon",
  meta: "facebook",
  facebook: "facebook",
  fb: "facebook",
  google: "google",
  microsoft: "microsoft",
  apple: "apple",
  bloomberg: "bloomberg",
  netflix: "netflix",
  uber: "uber",
  doordash: "doordash",
  linkedin: "linkedin",
  airbnb: "airbnb",
  oracle: "oracle",
  adobe: "adobe",
  paypal: "paypal",
  tiktok: "tiktok",
  walmart: "walmart-labs",
  walmartlabs: "walmart-labs",
  walmartlabscom: "walmart-labs",
  nvidia: "nvidia",
  salesforce: "salesforce",
  intuit: "intuit",
};

const COACH_SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "hint",
    label: "hint",
    description: "Insert guided hints into the file",
  },
  { id: "review", label: "review", description: "Review the current approach" },
  { id: "submit", label: "submit", description: "Run the local submit gate" },
  {
    id: "done list",
    label: "done list",
    description: "Show completed problems",
  },
  {
    id: "done reset",
    label: "done reset",
    description: "Clear completed problem history",
  },
  { id: "progress", label: "progress", description: "Show practice progress" },
  { id: "easy", label: "easy", description: "Fetch an Easy LeetCode problem" },
  {
    id: "medium",
    label: "medium",
    description: "Fetch a Medium LeetCode problem",
  },
  { id: "next", label: "next", description: "Fetch the next company problem" },
  { id: "companies", label: "companies", description: "List company filters" },
  { id: "study", label: "study", description: "Open the Study board" },
  {
    id: "assistant",
    label: "assistant",
    description: "Open the coding assistant",
  },
  {
    id: "invent",
    label: "invent",
    description: "Create an original practice problem",
  },
  { id: "hard", label: "hard", description: "Invent a Hard practice problem" },
  {
    id: "solution",
    label: "solution",
    description: "Show implementation code only",
  },
  {
    id: "insert",
    label: "insert",
    description: "Insert the last coach response",
  },
  { id: "viz", label: "viz", description: "Open a visualization" },
  { id: "settings", label: "settings", description: "Open AI settings" },
  { id: "clear", label: "clear", description: "Clear this conversation" },
  { id: "exit", label: "exit", description: "Close DSA coach" },
];

const COACH_WELCOME =
  "DSA coach helps you practice interview problems, visualize patterns, and generate guided hints. Use easy/medium, submit (run tests + mark done if pass), done list, hint/review, or solution.";

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

function GrokOutputBody({
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
          if (!segment.complete) {
            return <CodeVizPlaceholder key={`v-${index}`} />;
          }
          if (segment.plan) {
            return <CodeVizPlayer key={`v-${index}`} plan={segment.plan} />;
          }
          return (
            <pre key={`v-${index}`} className="grok-prose" data-kind="error">
              Could not parse visualization JSON.
            </pre>
          );
        }
        const isPython =
          segment.lang === "python" ||
          segment.lang === "py" ||
          (!segment.lang && language === "python");
        return (
          <div
            key={`c-${index}`}
            className="grok-code-block"
            data-lang={segment.lang || "python"}
            data-incomplete={segment.complete ? undefined : "true"}
            data-important={segment.important ? "true" : undefined}
          >
            <div className="grok-code-toolbar">
              <span className="grok-code-label">
                {segment.lang || "python"}
              </span>
              {segment.complete ? <CopyCodeButton code={segment.code} /> : null}
            </div>
            <pre className="grok-code">
              {isPython
                ? renderPythonCode(segment.code, {
                    blockImportant: segment.important,
                    trailing:
                      streaming && !segment.complete ? (
                        <span className="grok-caret" aria-hidden="true">
                          ▍
                        </span>
                      ) : null,
                  })
                : segment.code}
              {!isPython && streaming && !segment.complete ? (
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

export function GrokHelperPanel({
  language,
  buffer,
  contextKey,
  title,
  width,
  onWidthChange,
  onClose,
  onOpenSettings,
  onInsert,
  onApplyBuffer,
  onOpenSubmittedFile,
  onOpenDoneProblem,
  onCreatePracticeFile,
  onOpenVisualize,
  onOpenStudy,
}: Props) {
  const ai = useAiSettingsStore();
  const [provider, setProvider] = useState<ChatProviderId>(ai.coachProvider);
  const [model, setModel] = useState(ai.coachModel);
  const [contextMeta, setContextMeta] = useState<ChatContextPayload["meta"]>();
  const [modelBarOpen, setModelBarOpen] = useState(true);
  const [models, setModels] = useState<string[]>([]);
  const [history, setHistory] = useState<CoachChatMessage[]>([]);
  const [lines, setLines] = useState<Line[]>([
    {
      id: lineId++,
      kind: "system",
      text: COACH_WELCOME,
    },
  ]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companySlug, setCompanySlug] = useState(
    useLeetCodeStore.getState().preferredCompanySlug,
  );
  const [input, setInput] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const followOutputRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const lastReply = useRef("");
  const streamLineId = useRef<number | null>(null);
  const streamTargetText = useRef("");
  const streamDisplayText = useRef("");
  const streamAnimRaf = useRef<number | null>(null);
  const streamTargetId = useRef<number | null>(null);
  const activeRequestIdRef = useRef(0);
  const createFileAfterReply = useRef(false);
  const guideBufferAfterReply = useRef(false);
  const guideSourceBuffer = useRef("");
  const contextCacheRef = useRef(createChatContextCache());
  const historyRef = useRef<CoachChatMessage[]>([]);
  const resize = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    liveWidth: number;
  } | null>(null);
  const onWidthChangeRef = useRef(onWidthChange);
  onWidthChangeRef.current = onWidthChange;

  const setCompany = async (rawCompany: string) => {
    const wanted = rawCompany.trim().toLowerCase();
    if (!wanted) {
      append(
        "system",
        `Current company: ${useLeetCodeStore.getState().preferredCompanySlug}. Type companies to browse, or company <name> to switch.`,
      );
      return;
    }
    const companies = await leetcodeListCompanies();
    const normalized = COMPANY_ALIASES[wanted] ?? wanted.replace(/\s+/g, "-");
    const hit =
      companies.find((item) => item.slug === normalized) ??
      companies.find((item) => item.name.toLowerCase() === wanted) ??
      companies.find((item) => item.slug.includes(normalized)) ??
      companies.find((item) => item.name.toLowerCase().includes(wanted));
    if (!hit) {
      throw new Error(
        `Unknown company: ${rawCompany}. Type companies to see available options.`,
      );
    }
    useLeetCodeStore.getState().setPreferredCompanySlug(hit.slug);
    setCompanySlug(hit.slug);
    append(
      "system",
      `Company prep set to ${hit.name} (${hit.questionCount} free problems in the patterns list). Type next, easy, or medium.`,
    );
  };

  const showCompanies = async () => {
    const companies = await leetcodeListCompanies();
    append(
      "system",
      [
        "Top company filters:",
        ...companies
          .slice(0, 18)
          .map(
            (item) =>
              `- ${item.name}  (${item.slug})  ${item.questionCount} problems`,
          ),
        'Use "company meta" or "company google" to switch.',
      ].join("\n"),
    );
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await leetcodeListCompanies();
        if (cancelled) return;
        setCompanies(list);
        const preferred = useLeetCodeStore.getState().preferredCompanySlug;
        if (preferred) setCompanySlug(preferred);
      } catch {
        if (!cancelled) setCompanies([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setProvider(ai.coachProvider);
    setModel(ai.coachModel);
  }, [ai.coachProvider, ai.coachModel]);

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
        } catch {
          if (!cancelled) setModels([]);
        }
        return;
      }
      const cloud = CLOUD_MODELS[provider] ?? [];
      if (!cancelled) {
        setModels(cloud);
        if (!model && cloud[0]) setModel(cloud[0]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, model, ai.ollamaBaseUrl, ai.lmstudioBaseUrl]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !followOutputRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  const onOutputScroll = () => {
    const output = listRef.current;
    if (!output) return;
    followOutputRef.current =
      output.scrollHeight - output.scrollTop - output.clientHeight < 24;
  };

  useEffect(() => {
    const applyLiveWidth = (px: number) => {
      const host = paneRef.current?.closest(
        ".sticky-workspace",
      ) as HTMLElement | null;
      const shell = paneRef.current?.closest(
        ".app-shell",
      ) as HTMLElement | null;
      const value = `${px}px`;
      host?.style.setProperty("--grok-width", value);
      shell?.style.setProperty("--grok-width", value);
    };

    const onMove = (event: PointerEvent) => {
      const state = resize.current;
      if (!state || event.pointerId !== state.pointerId) return;
      event.preventDefault();
      const host = paneRef.current?.closest(
        ".sticky-workspace",
      ) as HTMLElement | null;
      const hostWidth = host?.clientWidth || window.innerWidth;
      const max = Math.max(
        160,
        Math.min(Math.floor(hostWidth * 0.42), Math.floor(hostWidth - 200)),
      );
      const next = Math.min(
        max,
        Math.max(
          160,
          Math.round(state.startWidth - (event.clientX - state.startX)),
        ),
      );
      state.liveWidth = next;
      applyLiveWidth(next);
    };

    const onUp = (event: PointerEvent) => {
      const state = resize.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const finalWidth = state.liveWidth;
      resize.current = null;
      delete document.documentElement.dataset.grokResizing;
      const host = paneRef.current?.closest(
        ".sticky-workspace",
      ) as HTMLElement | null;
      host?.style.removeProperty("--grok-width");
      onWidthChangeRef.current(finalWidth);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const append = (kind: Line["kind"], text: string) => {
    setLines((current) => [
      ...current.slice(-120),
      { id: lineId++, kind, text },
    ]);
  };

  const usingLocalCompactContext =
    isLocalProvider(provider) && ai.localContextSource === "file";

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Reset coach memory when the open file/tab changes so help stays on-problem.
  useEffect(() => {
    setHistory([]);
    historyRef.current = [];
    setContextMeta(undefined);
  }, [contextKey]);

  const stopStreaming = () => {
    if (!busy) return;
    activeRequestIdRef.current += 1;
    if (streamAnimRaf.current != null) {
      cancelAnimationFrame(streamAnimRaf.current);
      streamAnimRaf.current = null;
    }
    const outputId = streamTargetId.current;
    if (outputId != null) {
      const partial = streamDisplayText.current;
      setLines((current) =>
        current.map((line) =>
          line.id === outputId
            ? { ...line, text: partial, streaming: false }
            : line,
        ),
      );
    }
    streamLineId.current = null;
    streamTargetId.current = null;
    createFileAfterReply.current = false;
    guideBufferAfterReply.current = false;
    setBusy(false);
    append("system", "Stopped response.");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const clearConversation = () => {
    clearChatContextCache(contextCacheRef.current, contextKey);
    historyRef.current = [];
    setHistory([]);
    setContextMeta(undefined);
    lastReply.current = "";
    setLines([
      {
        id: lineId++,
        kind: "system",
        text:
          ai.localContextSource === "file"
            ? "Conversation cleared. File mode still uses your open editor file on the next question."
            : "Conversation cleared. Ask a new question, or type easy / invent for a practice problem.",
      },
    ]);
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
        ? "Compacted local file context and trimmed recent coach memory."
        : "Compacted local coach memory to the most recent turns.",
    );
  };

  const askGrok = async (
    question: string,
    options?: {
      createFile?: boolean;
      guideBuffer?: boolean;
      sealRetry?: boolean;
    },
  ) => {
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    createFileAfterReply.current = Boolean(options?.createFile);
    guideBufferAfterReply.current = Boolean(options?.guideBuffer);
    // Strip previous `# HINT:` lines so the model gets stable line numbers
    // and the next inject replaces old hints instead of stacking them.
    const sourceBuffer = options?.guideBuffer
      ? stripHintComments(buffer)
      : buffer;
    guideSourceBuffer.current = sourceBuffer;
    setBusy(true);
    const outputId = lineId++;
    streamLineId.current = outputId;
    streamTargetId.current = outputId;
    streamTargetText.current = "";
    streamDisplayText.current = "";
    if (streamAnimRaf.current != null) {
      cancelAnimationFrame(streamAnimRaf.current);
      streamAnimRaf.current = null;
    }
    setLines((current) => [
      ...current.slice(-120),
      {
        id: outputId,
        kind: "output",
        text: options?.createFile
          ? "Inventing practice problem (solution stays hidden)…"
          : "",
        streaming: true,
      },
    ]);

    const paintDisplay = () => {
      const id = streamTargetId.current;
      if (id == null) return;
      const text = streamDisplayText.current;
      setLines((current) =>
        current.map((line) =>
          line.id === id ? { ...line, text, streaming: true } : line,
        ),
      );
    };

    if (options?.createFile) {
      streamTargetText.current =
        "Inventing practice problem (solution stays hidden)…";
      streamDisplayText.current = streamTargetText.current;
    }

    const tickReveal = () => {
      if (activeRequestIdRef.current !== requestId) {
        streamAnimRaf.current = null;
        return;
      }
      const target = streamTargetText.current;
      const shown = streamDisplayText.current;
      if (shown.length >= target.length) {
        streamAnimRaf.current = null;
        paintDisplay();
        return;
      }
      // Ease: small steady steps, speed up if we're behind so it never stalls.
      const backlog = target.length - shown.length;
      const step =
        backlog > 80
          ? Math.ceil(backlog / 8)
          : backlog > 24
            ? Math.ceil(backlog / 10)
            : Math.min(backlog, 3);
      streamDisplayText.current = target.slice(0, shown.length + step);
      paintDisplay();
      streamAnimRaf.current = requestAnimationFrame(tickReveal);
    };

    const queueToken = (token: string) => {
      if (activeRequestIdRef.current !== requestId) return;
      // Invent/createFile: never stream the reference solution into chat.
      if (options?.createFile) return;
      streamTargetText.current += token;
      if (streamAnimRaf.current == null) {
        streamAnimRaf.current = requestAnimationFrame(tickReveal);
      }
    };

    try {
      // File mode attaches the open buffer; Chat mode is conversation-only.
      const includeFileContext =
        ai.localContextSource === "file" &&
        Boolean(sourceBuffer.trim()) &&
        !options?.createFile;
      const activeHistory = historyRef.current;
      const context =
        includeFileContext && usingLocalCompactContext
          ? buildChatContextPayload({
              cache: contextCacheRef.current,
              provider,
              model,
              language,
              buffer: sourceBuffer,
              isLocal: true,
              fileKey: contextKey,
              localMode: ai.localContextMode,
              question,
              history: activeHistory,
            })
          : {
              buffer: includeFileContext ? sourceBuffer : "",
              contextOverride: undefined,
              meta: undefined,
            };
      setContextMeta(context.meta);
      const result = await coachChat({
        provider,
        model,
        settings: ai,
        question,
        language,
        buffer: context.buffer,
        contextOverride: context.contextOverride,
        includeContext: includeFileContext,
        history: options?.createFile
          ? []
          : historyForLocalSpeed(provider, ai.localContextMode, activeHistory),
        onToken: queueToken,
      });
      if (activeRequestIdRef.current !== requestId) return;
      // Finish revealing any remaining buffered text smoothly, then settle.
      // Invent replies: snap to a spoiler-free summary (never animate the solution fence).
      const hideInventSolution = Boolean(options?.createFile);
      let displayReply = result.reply;
      if (guideBufferAfterReply.current) {
        displayReply = stripFullFileFencesFromReply(
          result.reply,
          guideSourceBuffer.current,
        );
      } else if (hideInventSolution) {
        displayReply = inventCoachDisplay(result.reply);
      }
      lastReply.current = displayReply;
      streamTargetText.current = displayReply;
      streamDisplayText.current = hideInventSolution
        ? displayReply
        : streamDisplayText.current;
      if (!hideInventSolution) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            if (activeRequestIdRef.current !== requestId) {
              resolve();
              return;
            }
            if (
              streamDisplayText.current.length >=
              streamTargetText.current.length
            ) {
              if (streamAnimRaf.current != null) {
                cancelAnimationFrame(streamAnimRaf.current);
                streamAnimRaf.current = null;
              }
              resolve();
              return;
            }
            if (streamAnimRaf.current == null) {
              streamAnimRaf.current = requestAnimationFrame(tickReveal);
            }
            requestAnimationFrame(finish);
          };
          finish();
        });
        if (activeRequestIdRef.current !== requestId) return;
      }

      streamDisplayText.current = displayReply;
      setHistory((current) => {
        const next = [
          ...current,
          { role: "user" as const, content: question },
          // Keep invent solutions out of coach memory so later turns don't spoil them.
          {
            role: "assistant" as const,
            content: hideInventSolution ? displayReply : result.reply,
          },
        ];
        historyRef.current = next;
        return next;
      });
      ai.setCoachProvider(provider);
      ai.setCoachModel(result.model);
      setLines((current) =>
        current.map((line) =>
          line.id === outputId
            ? { ...line, text: displayReply, streaming: false }
            : line,
        ),
      );

      if (guideBufferAfterReply.current) {
        const guide = resolveGuideFromReply(
          result.reply,
          guideSourceBuffer.current,
        );
        if (guide && onApplyBuffer) {
          onApplyBuffer(guide.annotated);
          append(
            "system",
            `Inserted ${guide.hintCount} # HINT: comment(s) into your open file (code unchanged). Advice is above — run tests, then hint again.`,
          );
        } else {
          append(
            "system",
            "Advice kept in chat. No L#: hints to insert — ask hint again with a focus, or type solution for the full answer.",
          );
        }
      } else {
        const practice = extractPracticeFile(result.reply);
        if (practice) {
          const shouldSeal =
            createFileAfterReply.current ||
            /\bCASES\s*=/.test(practice.content);
          let toWrite = practice;
          if (shouldSeal) {
            append("system", "Sealing practice tests from reference solution…");
            const sealed = await sealPracticeFile(practice);
            if (
              !sealed.ok &&
              createFileAfterReply.current &&
              !options?.sealRetry
            ) {
              append(
                "system",
                `Seal failed (${sealed.error}). Asking coach to resend with CASES + working solution…`,
              );
              await askGrok(PRACTICE_SEAL_RETRY_PROMPT, {
                createFile: true,
                sealRetry: true,
              });
              return;
            }
            if (!sealed.ok) {
              append(
                "error",
                `Could not seal practice tests: ${sealed.error}. File was not created.`,
              );
              return;
            }
            toWrite = sealed.file;
            if (!/\n\s+pass\s*\n/.test(toWrite.content)) {
              append(
                "error",
                "Sealed practice file still contains a solution body — not opening it. Try easy / invent again.",
              );
              return;
            }
          } else if (createFileAfterReply.current) {
            // Never open an invent file that skipped sealing (would leak the reference solution).
            append(
              "error",
              "Invent reply was missing CASES to seal — file not created. Try easy / invent again.",
            );
            return;
          }
          toWrite = ensurePracticeTrackingLines(toWrite);
          const practiceKey = extractPracticeKey(toWrite.content);
          if (practiceKey) {
            useLeetCodeStore.getState().setLastSlug(practiceKey);
          }
          try {
            const path = await onCreatePracticeFile(toWrite);
            append(
              "system",
              `Created practice file ${path} — replace pass, then run to see PASS/FAIL.`,
            );
          } catch (err) {
            append("error", normalizeError(err).message);
          }
        } else if (createFileAfterReply.current) {
          append(
            "error",
            "Coach replied but no runnable practice .py was found. Try easy / medium / hard again.",
          );
        }
      }
    } catch (err) {
      if (activeRequestIdRef.current !== requestId) return;
      if (streamAnimRaf.current != null) {
        cancelAnimationFrame(streamAnimRaf.current);
        streamAnimRaf.current = null;
      }
      setLines((current) =>
        current.flatMap((line) => {
          if (line.id !== outputId) return [line];
          if (line.text.trim()) {
            return [
              { ...line, streaming: false },
              {
                id: lineId++,
                kind: "error" as const,
                text: normalizeError(err).message,
              },
            ];
          }
          return [
            {
              id: lineId++,
              kind: "error" as const,
              text: normalizeError(err).message,
            },
          ];
        }),
      );
    } finally {
      if (activeRequestIdRef.current === requestId) {
        createFileAfterReply.current = false;
        guideBufferAfterReply.current = false;
        streamLineId.current = null;
        streamTargetId.current = null;
        setBusy(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
  };

  const runLocal = async (raw: string) => {
    const value = raw.trim();
    if (!value || busy) return;
    append("command", `coach> ${value}`);
    setInput("");

    const lower = value.toLowerCase();
    const word = lower.split(/\s+/)[0] ?? "";
    const rest = value.slice(word.length).trim();
    if (lower === "exit" || lower === "close" || lower === "q") {
      onClose();
      return;
    }
    if (lower === "clear" || lower === "cls") {
      clearConversation();
      return;
    }
    if (
      lower === "help" ||
      lower === "?" ||
      lower === "/" ||
      lower === "/help"
    ) {
      append(
        "system",
        [
          "DSA coach commands",
          "  / or help          Show this command list",
          "  next               Pull next company problem (same as oa)",
          "  easy | medium      Pull real LeetCode by difficulty",
          "  invent | original  Invent an original problem with sealed tests",
          "  hard               Invent a Hard practice problem",
          "  leetcode <slug>    Pull a specific real LeetCode problem",
          "  company <name>     Switch company filter (or use dropdown)",
          "  companies          List available companies",
          "  study | lessons    Open guided lessons / Study board",
          "  assistant          Open the general coding assistant",
          "  theme comet        Set the comet theme from main CLI",
          "  done               Mark current practice complete (saves for done list)",
          "  submit             Run all cases + consistency gate; reports complexity",
          "  done list          Show finished problems (click to reopen)",
          "  progress           Same as done list",
          "  done reset         Reset completed/skipped progress",
          "  clear | cls        Clear this conversation",
          "  hint | advice      Give guidance without full solve",
          "  cheat [topic]      Show Python DSA syntax/reference help",
          "  review             Review your current approach/file",
          "  solution | answer  Give the full solution when explicitly asked",
          "  viz                Open local Visualize mode",
          "  insert             Insert the last coach reply into editor",
          "  settings           Open AI keys/settings",
          "  exit               Close DSA coach",
          "Local submit accepts when every explicit case in the file passes (LeetCode example counts vary).",
        ].join("\n"),
      );
      return;
    }
    if (lower === "companies" || lower === "company list") {
      try {
        await showCompanies();
      } catch (err) {
        append("error", normalizeError(err).message);
      }
      return;
    }
    if (word === "company") {
      try {
        await setCompany(rest);
      } catch (err) {
        append("error", normalizeError(err).message);
      }
      return;
    }
    if (word in COMPANY_ALIASES) {
      try {
        await setCompany(word);
      } catch (err) {
        append("error", normalizeError(err).message);
      }
      return;
    }
    if (lower === "settings" || lower === "key") {
      onOpenSettings();
      return;
    }
    if (word === "cheat" || word === "python" || word === "syntax") {
      append("system", renderPythonCheatSheet(rest));
      return;
    }
    if (lower === "study" || lower === "lesson" || lower === "lessons") {
      onOpenStudy?.();
      append("system", "Opened Study board.");
      return;
    }
    if (lower === "assistant" || lower === "ai") {
      append(
        "system",
        "Use Ctrl+Shift+A (or `assistant` in main CLI) to open Assistant.",
      );
      return;
    }
    if (lower === "insert") {
      if (!lastReply.current) {
        append("error", "Nothing to insert yet.");
        return;
      }
      onInsert(lastReply.current);
      append("system", "Inserted last reply into the editor.");
      return;
    }
    const vizWord = lower.split(/\s+/)[0] ?? "";
    if (vizWord === "viz" || vizWord === "visualize") {
      if (onOpenVisualize) {
        append(
          "system",
          "Opening Visualize — local templates are free (no API credits). Use Ask DSA coach only if you want a custom plan.",
        );
        onOpenVisualize();
        return;
      }
    }

    const practice = expandPracticeCommand(lower, value, buffer);
    if (practice) {
      if (practice.kind === "done") {
        const slug =
          extractPracticeKey(buffer) ?? useLeetCodeStore.getState().lastSlug;
        if (!slug) {
          append(
            "error",
            "No # LC: / # FILE: id in the open file. Open a practice file first.",
          );
          return;
        }
        useLeetCodeStore
          .getState()
          .saveSubmittedFile(
            slug,
            buffer,
            useSessionStore.getState().getActiveTab()?.path,
          );
        useLeetCodeStore.getState().markDone(slug);
        append(
          "system",
          `Marked done: ${slug} (${useLeetCodeStore.getState().completedSlugs.length} completed). Type done list to review, or next / easy / medium for another invented practice problem.`,
        );
        return;
      }
      if (practice.kind === "done-list") {
        const { completedSlugs, skippedSlugs } = useLeetCodeStore.getState();
        if (completedSlugs.length === 0 && skippedSlugs.length === 0) {
          append(
            "system",
            "No finished problems yet. Solve a practice file, then type done or submit.",
          );
          return;
        }
        const formatSlug = (slug: string) => {
          const title = slug
            .split("-")
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
          return title;
        };
        const lines = [
          `Finished problems (${completedSlugs.length}):`,
          ...(completedSlugs.length
            ? completedSlugs.map(formatSlug)
            : ["  (none)"]),
        ];
        if (skippedSlugs.length) {
          lines.push(
            "",
            `Skipped (${skippedSlugs.length}):`,
            ...skippedSlugs.map(formatSlug),
          );
        }
        lines.push("", "Tip: done reset clears this list.");
        setLines((current) => [
          ...current.slice(-120),
          {
            id: lineId++,
            kind: "done-list",
            text: lines.join("\n"),
            doneSlugs: completedSlugs,
          },
        ]);
        return;
      }
      if (practice.kind === "done-reset") {
        useLeetCodeStore.getState().resetProgress();
        append("system", "Cleared LeetCode progress (completed/skipped).");
        return;
      }
      if (practice.kind === "submit") {
        if (!buffer.trim()) {
          append("error", "Open a practice file first, then type submit.");
          return;
        }
        if (!looksLikePracticeFile(buffer)) {
          append(
            "system",
            "This buffer doesn't look like a runnable practice harness. Submit still runs it — prefer files with PASS/FAIL tests.",
          );
        }
        append(
          "system",
          "Running the local submit gate (all cases in the file must pass, then consistency reruns)…",
        );
        try {
          const cwd = useSessionStore.getState().cwd || null;
          const result = await executePython(buffer, "run", cwd);
          const combined =
            `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
          if (result.stdout?.trim()) append("output", result.stdout.trimEnd());
          if (result.stderr?.trim()) append("error", result.stderr.trimEnd());

          const summary = parseTestOutput(combined);
          const failedLabels =
            summary?.cases
              .filter((item) => !item.passed)
              .map((item) => item.label) ?? [];
          const hasFailLine = /\bFAIL\b/i.test(combined);
          // LeetCode official example counts vary (often 2–3). Accept whatever
          // explicit cases are in the file as long as all of them pass.
          const hasEnoughCases = Boolean(summary && summary.total >= 1);
          const allPassed =
            result.exitCode === 0 &&
            !hasFailLine &&
            hasEnoughCases &&
            summary!.passed === summary!.total;

          if (allPassed) {
            const reruns = await Promise.all([
              executePython(buffer, "run", cwd),
              executePython(buffer, "run", cwd),
            ]);
            const rerunsPassed = reruns.every((run) => {
              const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
              const rerunSummary = parseTestOutput(output);
              return (
                run.exitCode === 0 &&
                !/\bFAIL\b/i.test(output) &&
                rerunSummary?.total === summary!.total &&
                rerunSummary.passed === rerunSummary.total
              );
            });
            if (!rerunsPassed) {
              append(
                "system",
                "Submit rejected — the test suite was not stable across verification reruns. Not marked done.",
              );
              return;
            }

            const complexity = estimatePythonComplexity(buffer);
            const slug =
              extractPracticeKey(buffer) ??
              useLeetCodeStore.getState().lastSlug;
            useStudyStore.getState().recordPractice({
              title: title?.trim() || slug || "practice submit",
              path: undefined,
              passed: true,
            });
            if (slug) {
              useLeetCodeStore
                .getState()
                .saveSubmittedFile(
                  slug,
                  buffer,
                  useSessionStore.getState().getActiveTab()?.path,
                );
              useLeetCodeStore.getState().markDone(slug);
              append(
                "system",
                `Local submit accepted — ${summary!.passed}/${summary!.total} cases passed across 3 runs. Marked done: ${slug} (${useLeetCodeStore.getState().completedSlugs.length} completed).\nComplexity estimate: Time ${complexity.time}, Space ${complexity.space}. ${complexity.note} Type done list to review.`,
              );
            } else {
              append(
                "system",
                `Local submit accepted — ${summary!.passed}/${summary!.total} cases passed across 3 runs. No # LC: / # FILE: id to mark done.\nComplexity estimate: Time ${complexity.time}, Space ${complexity.space}. ${complexity.note}`,
              );
            }
            return;
          }

          const summaryText = !hasEnoughCases
            ? `${summary?.total ?? 0} test case(s); need at least one PASS/FAIL case in the file`
            : summary
              ? `${summary.passed}/${summary.total} passed`
              : result.exitCode === 0
                ? "no PASS/FAIL summary parsed"
                : `process exited with code ${result.exitCode ?? "unknown"}`;
          if (failedLabels.length > 0) {
            append(
              "error",
              [
                "Failed test cases:",
                ...failedLabels.map((label) => `- ${label}`),
              ].join("\n"),
            );
          }
          append(
            "system",
            `Submit rejected — ${summaryText}. Not marked done. Asking coach what to fix…`,
          );
          useStudyStore.getState().recordPractice({
            title:
              title?.trim() || extractPracticeKey(buffer) || "practice submit",
            passed: false,
          });
          await askGrok(
            buildSubmitFailPrompt({
              summaryText,
              failedLabels,
              output: combined,
              exitCode: result.exitCode ?? null,
            }),
            { guideBuffer: true },
          );
        } catch (err) {
          append("error", normalizeError(err).message);
          append(
            "system",
            "Submit rejected — could not run tests. Not marked done.",
          );
        }
        return;
      }
      if (practice.kind === "leetcode") {
        append("system", "Fetching real LeetCode problem…");
        try {
          const result = await fetchAndBuildLcPractice(practice);
          const path = await onCreatePracticeFile(result.file);
          for (const w of result.warnings) {
            append("system", w);
          }
          append(
            "system",
            `Opened ${result.problem.frontendId}. ${result.problem.title} (${result.problem.difficulty}) → ${path}\n${result.problem.url}\nReplace pass, run local examples, then submit on LeetCode. Type done when finished.`,
          );
        } catch (err) {
          append("error", normalizeError(err).message);
        }
        return;
      }

      if (practice.kind !== "grok") return;

      const word = lower.split(/\s+/)[0] ?? "";
      if (
        (word === "hint" ||
          word === "hints" ||
          word === "advice" ||
          word === "guide" ||
          word === "solution" ||
          word === "answer" ||
          word === "review") &&
        useInterviewStore.getState().isHintLocked()
      ) {
        append(
          "error",
          "Interview mode: hints/solutions locked until the timer ends (or unlock Reveal from the palette).",
        );
        return;
      }
      await askGrok(practice.prompt, {
        createFile: practice.createFile,
        guideBuffer: practice.guideBuffer,
      });
      return;
    }
    // Free-form questions: coach without dumping a full solution unless asked.
    const wrapped = wrapFreeformCoachPrompt(value);
    await askGrok(wrapped.prompt, { guideBuffer: wrapped.guideBuffer });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runLocal(input);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const slashMatches = matchingSlashCommands(
      COACH_SLASH_COMMANDS,
      input.slice(1),
    );
    if (input.startsWith("/") && slashMatches.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setSlashIndex(
          (current) =>
            (current + step + slashMatches.length) % slashMatches.length,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void runLocal(
          slashMatches[Math.min(slashIndex, slashMatches.length - 1)]!.id,
        );
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

  const onResizeDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    document.documentElement.dataset.grokResizing = "1";
    const host = paneRef.current?.closest(
      ".sticky-workspace",
    ) as HTMLElement | null;
    const measured =
      host?.querySelector(".grok-cli-pane")?.getBoundingClientRect().width ??
      width;
    resize.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: Math.round(measured),
      liveWidth: Math.round(measured),
    };
  };

  const fileLabel = title?.trim() || "untitled";

  return (
    <section ref={paneRef} className="grok-cli-pane" aria-label="DSA coach">
      <div
        className="grok-resize-handle"
        title="Drag to resize DSA coach"
        onPointerDown={onResizeDown}
      />
      <header className="grok-cli-header">
        <div className="grok-cli-header-left">
          <span className="grok-cli-title">dsa coach · {fileLabel}</span>
          <button
            type="button"
            className="assistant-model-toggle"
            aria-expanded={modelBarOpen}
            aria-controls="coach-model-bar"
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
          <button type="button" onClick={onOpenSettings} title="AI keys">
            …
          </button>
          <button type="button" onClick={onClose} title="Close DSA coach (Esc)">
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
            id="coach-model-bar"
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
                    ai.setCoachProvider(next);
                    ai.setCoachModel("");
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
                  onChange={(event) => {
                    setModel(event.target.value);
                    ai.setCoachModel(event.target.value);
                  }}
                  disabled={busy || models.length === 0}
                >
                  {models.length === 0 ? (
                    <option value="">No models found</option>
                  ) : (
                    models.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))
                  )}
                </select>
              </label>
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
                <span className="sr-only">Company</span>
                <select
                  value={companySlug}
                  onChange={(event) => {
                    const next = event.target.value;
                    setCompanySlug(next);
                    useLeetCodeStore.getState().setPreferredCompanySlug(next);
                    const hit = companies.find((item) => item.slug === next);
                    if (hit) {
                      append(
                        "system",
                        `Company prep set to ${hit.name} (${hit.questionCount} free problems in the patterns list).`,
                      );
                    }
                  }}
                  disabled={busy || companies.length === 0}
                >
                  {companies.length === 0 ? (
                    <option value={companySlug || ""}>
                      No companies found
                    </option>
                  ) : (
                    companies.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.name}
                      </option>
                    ))
                  )}
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
            <GrokOutputBody
              key={line.id}
              text={line.text}
              language={language}
              streaming={line.streaming}
            />
          ) : line.kind === "done-list" ? (
            <div key={line.id} className="done-list-output">
              <strong>Finished problems</strong>
              <span className="done-list-hint">
                Click a problem to reopen it
              </span>
              {(line.doneSlugs ?? []).map((slug) => {
                const item = slug
                  .split("-")
                  .filter(Boolean)
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(" ");
                return (
                  <button
                    key={`${line.id}-${slug}`}
                    type="button"
                    className="done-list-item"
                    title="Open this practice file"
                    onClick={() => {
                      void (async () => {
                        try {
                          if (onOpenDoneProblem) {
                            await onOpenDoneProblem(slug);
                            append("system", `Opened ${item}.`);
                            return;
                          }
                          const store = useLeetCodeStore.getState();
                          const path = store.submittedPaths[slug];
                          const code = store.submittedFiles[slug];
                          if (path && onOpenSubmittedFile) {
                            onOpenSubmittedFile(path);
                            append("system", `Opened ${item}.`);
                            return;
                          }
                          if (code && onApplyBuffer) {
                            onApplyBuffer(code);
                            append(
                              "system",
                              `Restored ${item} into the editor.`,
                            );
                            return;
                          }
                          append(
                            "error",
                            `Couldn't open ${item}. Open the file manually, then type done again.`,
                          );
                        } catch (err) {
                          append("error", normalizeError(err).message);
                        }
                      })();
                    }}
                  >
                    <span aria-hidden>✅</span>
                    <span className="done-list-item-label">{item}</span>
                  </button>
                );
              })}
            </div>
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
            commands={COACH_SLASH_COMMANDS}
            query={input.slice(1)}
            activeIndex={slashIndex}
            onChoose={(command) => void runLocal(command.id)}
          />
        )}
        <span className="grok-cli-prompt" aria-hidden="true">
          coach&gt;
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
          aria-label="Ask DSA coach"
          placeholder={busy ? "Streaming…" : "/ for Commands"}
        />
      </form>
    </section>
  );
}
