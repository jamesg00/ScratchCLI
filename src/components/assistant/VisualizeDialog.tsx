import { useEffect, useMemo, useRef, useState } from "react";
import { useAiSettingsStore } from "../../stores/aiSettingsStore";
import { normalizeError } from "../../types/error";
import { coachChat } from "../../services/coachChat";
import {
  buildChatContextPayload,
  createChatContextCache,
} from "../../services/chatContext";
import { isLocalProvider } from "../../services/aiModels";
import { CodeVizPlayer } from "./CodeVizPlayer";
import type { VizKind, VizPlan } from "./vizPlan";
import {
  buildVizPrompt,
  extractVizPlanFromReply,
  VIZ_KIND_LABELS,
} from "./vizPrompt";
import {
  VIZ_CATEGORIES,
  categoryForKind,
  kindsForCategory,
  type VizCategoryId,
} from "./vizCatalog";
import { getLocalVizTemplate, listVizTemplates } from "./vizTemplates";
import { buildLocalVizPlan, simulateVizPlan } from "./vizSimulate";
import { extractVizInputs } from "./vizExtract";

type Props = {
  language: string;
  buffer: string;
  onClose: () => void;
  initialKind?: VizKind;
};

type Mode = "local" | "ai";

function introForLocal(
  source: "simulated" | "overlay" | "template",
  kind: VizKind,
  summary?: string,
): string {
  const label = VIZ_KIND_LABELS[kind];
  if (source === "simulated" || source === "overlay") {
    return summary
      ? `Using your ${summary} · free local (${label})`
      : `Using your file inputs · free local (${label})`;
  }
  return `Demo template · free local (${label})`;
}

export function VisualizeDialog({
  language,
  buffer,
  onClose,
  initialKind,
}: Props) {
  const ai = useAiSettingsStore();
  const contextCacheRef = useRef(createChatContextCache());
  const templates = useMemo(() => listVizTemplates(), []);
  const extracted = useMemo(() => extractVizInputs(buffer), [buffer]);
  const initial = useMemo(
    () => buildLocalVizPlan(buffer, initialKind),
    [buffer, initialKind],
  );
  const [kind, setKind] = useState<VizKind>(initial.kind);
  const [category, setCategory] = useState<VizCategoryId>(() =>
    categoryForKind(initial.kind),
  );
  const [mode, setMode] = useState<Mode>("local");
  const [plan, setPlan] = useState<VizPlan>(() => initial.plan);
  const [localSource, setLocalSource] = useState(initial.source);
  const [caseIndex, setCaseIndex] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [intro, setIntro] = useState(() =>
    introForLocal(initial.source, initial.kind, initial.summary),
  );
  const [view, setView] = useState<"topics" | "player">(
    initialKind ? "player" : "topics",
  );

  const patternsInCategory = useMemo(
    () => kindsForCategory(category),
    [category],
  );

  const cases = extracted?.arrays ?? [];

  useEffect(() => {
    const next = buildLocalVizPlan(buffer, initialKind);
    setKind(next.kind);
    setCategory(categoryForKind(next.kind));
    setPlan(next.plan);
    setLocalSource(next.source);
    setMode("local");
    setCaseIndex(0);
    setIntro(introForLocal(next.source, next.kind, next.summary));
    setAiError(null);
    setView(initialKind ? "player" : "topics");
  }, [buffer, initialKind]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (view === "player") {
          setView("topics");
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, view]);

  const applyTemplate = (next: VizKind) => {
    setKind(next);
    setCategory(categoryForKind(next));
    setMode("local");
    setLocalSource("template");
    setPlan(getLocalVizTemplate(next));
    setAiError(null);
    setIntro(introForLocal("template", next));
  };

  const openPattern = (next: VizKind) => {
    applyTemplate(next);
    setView("player");
  };

  const applyFromFile = (nextKind?: VizKind) => {
    const chosen = nextKind ?? kind;
    const next = buildLocalVizPlan(buffer, chosen);
    setKind(next.kind);
    setCategory(categoryForKind(next.kind));
    setPlan(next.plan);
    setLocalSource(next.source);
    setMode("local");
    setAiError(null);
    setIntro(introForLocal(next.source, next.kind, next.summary));
  };

  const applyCase = (index: number) => {
    if (!extracted || !cases[index]) return;
    setCaseIndex(index);
    const forced = {
      ...extracted,
      arrays: [cases[index]!, ...cases.filter((_, i) => i !== index)],
      summary: `${cases[index]!.name}=[${cases[index]!.values.slice(0, 10).join(",")}]`,
    };
    const simulated = simulateVizPlan(kind, forced);
    if (simulated) {
      setPlan(simulated);
      setLocalSource("simulated");
      setMode("local");
      setIntro(introForLocal("simulated", kind, forced.summary));
      return;
    }
    applyFromFile(kind);
  };

  const onCategoryChange = (nextCategory: VizCategoryId) => {
    setCategory(nextCategory);
    const kinds = kindsForCategory(nextCategory);
    const nextKind = kinds.includes(kind) ? kind : (kinds[0] ?? kind);
    applyTemplate(nextKind);
  };

  const runAi = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const question = buildVizPrompt({
        focus: `Prefer kind=${kind} if it fits; otherwise pick the best kind. Use asserts/examples from the buffer when present.`,
      });
      const context = buildChatContextPayload({
        cache: contextCacheRef.current,
        provider: ai.coachProvider,
        model: ai.coachModel,
        language,
        buffer,
        isLocal: isLocalProvider(ai.coachProvider),
        localMode: ai.localContextMode,
        question,
        history: [],
      });
      const result = await coachChat({
        provider: ai.coachProvider,
        model: ai.coachModel,
        settings: ai,
        question,
        language,
        buffer: context.buffer,
        contextOverride: context.contextOverride,
        includeContext: true,
        history: [],
      });
      const parsed = extractVizPlanFromReply(result.reply);
      if (!parsed) {
        setAiError(
          "Coach replied but no playable viz was found. Local template is still available.",
        );
        return;
      }
      setPlan(parsed);
      if (parsed.kind) {
        setKind(parsed.kind);
        setCategory(categoryForKind(parsed.kind));
      }
      setMode("ai");
      const firstLine = result.reply
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith("```"));
      setIntro(firstLine || "AI visualization (uses API credits).");
    } catch (err) {
      setAiError(normalizeError(err).message);
    } finally {
      setAiLoading(false);
    }
  };

  const kindLabel = plan.kind
    ? VIZ_KIND_LABELS[plan.kind]
    : VIZ_KIND_LABELS[kind];
  const title =
    view === "topics"
      ? "Visualize topics"
      : plan.title || kindLabel || "Visualize";
  const modeTag =
    view === "topics"
      ? " · pick a pattern"
      : mode === "ai"
        ? " · AI"
        : localSource === "template"
          ? " · free demo"
          : " · free from file";

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="visualize-dialog"
        data-view={view}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visualize-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div className="visualize-heading">
            <h2 id="visualize-title">{title}</h2>
            <span className="visualize-kind">
              {view === "topics" ? "All categories" : kindLabel}
              {modeTag}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            x
          </button>
        </header>

        {view === "topics" ? (
          <div className="visualize-body">
            <div className="visualize-topics">
              <p className="visualize-topics-lead">
                Pick a DSA pattern for a free local walkthrough. Esc closes.
              </p>
              {VIZ_CATEGORIES.map((item) => (
                <section key={item.id} className="visualize-topic-card">
                  <h3>{item.label}</h3>
                  <div className="visualize-topic-patterns">
                    {item.kinds.map((pattern) => (
                      <button
                        key={pattern}
                        type="button"
                        onClick={() => openPattern(pattern)}
                      >
                        {VIZ_KIND_LABELS[pattern]}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="visualize-toolbar">
              <button
                type="button"
                className="visualize-back-btn"
                onClick={() => setView("topics")}
                title="Back to topics"
              >
                ← Topics
              </button>
              <label className="visualize-select">
                <span>Category</span>
                <select
                  value={category}
                  onChange={(event) =>
                    onCategoryChange(event.target.value as VizCategoryId)
                  }
                >
                  {VIZ_CATEGORIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="visualize-select">
                <span>Pattern</span>
                <select
                  value={kind}
                  onChange={(event) =>
                    applyTemplate(event.target.value as VizKind)
                  }
                >
                  {(patternsInCategory.length > 0
                    ? patternsInCategory
                    : templates.map((t) => t.kind)
                  ).map((item) => (
                    <option key={item} value={item}>
                      {VIZ_KIND_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
              {cases.length > 0 ? (
                <label className="visualize-select">
                  <span>Case</span>
                  <select
                    value={caseIndex}
                    onChange={(event) => applyCase(Number(event.target.value))}
                  >
                    {cases.map((item, index) => (
                      <option key={`${item.name}-${index}`} value={index}>
                        {item.name}=[{item.values.slice(0, 6).join(",")}
                        {item.values.length > 6 ? ",…" : ""}]
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                className="visualize-local-btn"
                onClick={() => applyTemplate(kind)}
              >
                Use template
              </button>
              <button
                type="button"
                className="visualize-file-btn"
                onClick={() => applyFromFile(kind)}
                title="Seed steps from arrays/strings in the open editor (no credits)"
              >
                From my file
              </button>
              <button
                type="button"
                className="visualize-ai-btn"
                disabled={aiLoading}
                onClick={() => void runAi()}
                title="Optional — uses your coach AI provider (Menu → AI keys)"
              >
                {aiLoading ? "Asking coach…" : "Ask DSA coach (uses AI)"}
              </button>
            </div>

            <div className="visualize-body">
              {intro ? <p className="visualize-intro">{intro}</p> : null}
              {aiError ? (
                <div className="visualize-error">
                  <p>{aiError}</p>
                </div>
              ) : null}
              <CodeVizPlayer
                key={`${mode}-${kind}-${localSource}-${plan.title}`}
                plan={plan}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
