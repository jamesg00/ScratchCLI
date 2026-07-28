import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAppearanceStore } from "../../stores/appearanceStore";
import { useInterviewStore } from "../../stores/interviewStore";
import { normalizeError } from "../../types/error";
import { grokChat, type GrokChatMessage } from "../../services/grok";
import { parseGrokSegments } from "./grokSegments";
import { renderPythonCode } from "./pythonHighlight";
import { CodeVizPlaceholder, CodeVizPlayer } from "./CodeVizPlayer";
import {
  expandPracticeCommand,
  extractPracticeFile,
  PRACTICE_SEAL_RETRY_PROMPT,
} from "./practiceFile";
import { sealPracticeFile } from "./sealPracticeTests";
import { fetchAndBuildLcPractice } from "./leetcodeFlow";
import { extractLcSlug, useLeetCodeStore } from "../../stores/leetcodeStore";
import {
  resolveGuideFromReply,
  stripFullFileFencesFromReply,
  wrapFreeformCoachPrompt,
} from "./hintGuide";

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
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onInsert: (text: string) => void;
  /** Replace the open buffer (used for `# HINT:` annotations). */
  onApplyBuffer?: (content: string) => void;
  onCreatePracticeFile: (file: {
    content: string;
    fileName: string;
  }) => Promise<string>;
  onOpenVisualize?: () => void;
};

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
  title,
  width,
  onWidthChange,
  onClose,
  onOpenSettings,
  onInsert,
  onApplyBuffer,
  onCreatePracticeFile,
  onOpenVisualize,
}: Props) {
  const apiKey = useAppearanceStore((state) => state.grokApiKey) ?? "";
  const [history, setHistory] = useState<GrokChatMessage[]>([]);
  const [lines, setLines] = useState<Line[]>([
    {
      id: lineId++,
      kind: "system",
      text: "Amazon OA prep — easy / medium / oa pull real LeetCode. done marks complete. invent = AI problem. hint / review → # HINT: (no auto-solve). solution only when you ask.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const lastReply = useRef("");
  const streamLineId = useRef<number | null>(null);
  const streamTargetText = useRef("");
  const streamDisplayText = useRef("");
  const streamAnimRaf = useRef<number | null>(null);
  const streamTargetId = useRef<number | null>(null);
  const createFileAfterReply = useRef(false);
  const guideBufferAfterReply = useRef(false);
  const guideSourceBuffer = useRef("");
  const resize = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    liveWidth: number;
  } | null>(null);
  const onWidthChangeRef = useRef(onWidthChange);
  onWidthChangeRef.current = onWidthChange;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

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

  const askGrok = async (
    question: string,
    options?: {
      createFile?: boolean;
      guideBuffer?: boolean;
      sealRetry?: boolean;
    },
  ) => {
    if (!apiKey.trim()) {
      append(
        "error",
        'No API key. Open AI keys (Menu → AI keys) or type "settings" / "env".',
      );
      return;
    }
    createFileAfterReply.current = Boolean(options?.createFile);
    guideBufferAfterReply.current = Boolean(options?.guideBuffer);
    guideSourceBuffer.current = buffer;
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
      { id: outputId, kind: "output", text: "", streaming: true },
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

    const tickReveal = () => {
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
      streamTargetText.current += token;
      if (streamAnimRaf.current == null) {
        streamAnimRaf.current = requestAnimationFrame(tickReveal);
      }
    };

    try {
      const result = await grokChat({
        apiKey,
        question,
        language,
        buffer,
        includeContext: !options?.createFile,
        history: options?.createFile ? [] : history.slice(-10),
        onToken: queueToken,
      });
      // Finish revealing any remaining buffered text smoothly, then settle.
      streamTargetText.current = result.reply;
      await new Promise<void>((resolve) => {
        const finish = () => {
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
            streamAnimRaf.current = requestAnimationFrame(tickReveal);
          }
          requestAnimationFrame(finish);
        };
        finish();
      });

      lastReply.current = result.reply;
      let displayReply = result.reply;
      if (guideBufferAfterReply.current) {
        displayReply = stripFullFileFencesFromReply(
          result.reply,
          guideSourceBuffer.current,
        );
      }
      streamDisplayText.current = displayReply;
      setHistory((current) => [
        ...current,
        { role: "user", content: question },
        { role: "assistant", content: result.reply },
      ]);
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
                `Seal failed (${sealed.error}). Asking Grok to resend with CASES + working solution…`,
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
            "Grok replied but no runnable practice .py was found. Try easy / medium / hard again.",
          );
        }
      }
    } catch (err) {
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
      createFileAfterReply.current = false;
      guideBufferAfterReply.current = false;
      streamLineId.current = null;
      streamTargetId.current = null;
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const runLocal = async (raw: string) => {
    const value = raw.trim();
    if (!value || busy) return;
    append("command", `grok> ${value}`);
    setInput("");

    const lower = value.toLowerCase();
    if (lower === "exit" || lower === "close" || lower === "q") {
      onClose();
      return;
    }
    if (lower === "clear" || lower === "cls") {
      setLines([]);
      return;
    }
    if (lower === "help" || lower === "?") {
      append(
        "system",
        [
          "LeetCode (Amazon OA): easy | medium | oa | amazon | next | practice | leetcode <slug>",
          "Progress: done  → mark current # LC: slug complete | done reset",
          "AI invent: invent | original | hard",
          "Coach: hint | advice | review  → chat advice + # HINT: in your open file (no full-file dump)",
          "        solution | answer     → full answer (only when you ask)",
          "        viz                   → local visualize",
          "Other: clear | insert | settings | exit",
          "Local tests = official examples only — submit on LeetCode for the full judge.",
        ].join("\n"),
      );
      return;
    }
    if (lower === "settings" || lower === "key") {
      onOpenSettings();
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
          extractLcSlug(buffer) ?? useLeetCodeStore.getState().lastSlug;
        if (!slug) {
          append(
            "error",
            "No # LC: slug in the open file. Open a LeetCode practice file first.",
          );
          return;
        }
        useLeetCodeStore.getState().markDone(slug);
        append(
          "system",
          `Marked done: ${slug} (${useLeetCodeStore.getState().completedSlugs.length} completed). Type oa or easy for the next one.`,
        );
        return;
      }
      if (practice.kind === "done-reset") {
        useLeetCodeStore.getState().resetProgress();
        append("system", "Cleared LeetCode progress (completed/skipped).");
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
        <span className="grok-cli-title">dsa coach · {fileLabel}</span>
        <button type="button" onClick={onClose} title="Close DSA coach (Esc)">
          x
        </button>
      </header>
      <div className="grok-cli-output" ref={listRef} aria-live="polite">
        {lines.map((line) =>
          line.kind === "output" ? (
            <GrokOutputBody
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
          coach&gt;
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          aria-label="Ask DSA coach"
          placeholder={
            busy ? "Streaming…" : "hint · review · easy · medium · hard"
          }
        />
      </form>
    </section>
  );
}
