import { useEffect, useState } from "react";
import type { VizPlan, VizStep } from "./vizPlan";
import { StructureViz } from "./StructureViz";

type Props = {
  plan: VizPlan;
};

function formatValue(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  return String(value);
}

function StepArrays({ step }: { step: VizStep }) {
  if (!step.arrays) return null;
  return (
    <div className="viz-arrays">
      {Object.entries(step.arrays).map(([name, array]) => (
        <div key={name} className="viz-array">
          <div className="viz-array-name">{name}</div>
          <div className="viz-array-cells">
            {array.values.map((value, index) => {
              const label = array.highlights?.[String(index)];
              return (
                <div
                  key={index}
                  className="viz-cell"
                  data-active={label ? "true" : undefined}
                  title={label ? `${label} → index ${index}` : `index ${index}`}
                >
                  <span className="viz-cell-index">{index}</span>
                  <span className="viz-cell-value">{formatValue(value)}</span>
                  {label ? <span className="viz-cell-ptr">{label}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepVars({ step }: { step: VizStep }) {
  if (!step.vars || Object.keys(step.vars).length === 0) return null;
  return (
    <div className="viz-vars">
      {Object.entries(step.vars).map(([name, value]) => (
        <span key={name} className="viz-var">
          <span className="viz-var-name">{name}</span>
          <span className="viz-var-value">{formatValue(value)}</span>
        </span>
      ))}
    </div>
  );
}

export function CodeVizPlayer({ plan }: Props) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const step = plan.steps[index] ?? plan.steps[0]!;
  const lineIndex = Math.max(0, Math.min(plan.code.length - 1, step.line));

  useEffect(() => {
    if (!playing) return;
    if (index >= plan.steps.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setIndex((current) => Math.min(plan.steps.length - 1, current + 1));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [playing, index, plan.steps.length]);

  const go = (next: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(plan.steps.length - 1, next)));
  };

  return (
    <section
      className="code-viz"
      aria-label={plan.title || "Code visualization"}
    >
      <header className="code-viz-header">
        <span className="code-viz-title">{plan.title || "visualization"}</span>
        <span className="code-viz-step">
          {index + 1}/{plan.steps.length}
        </span>
      </header>

      <pre className="code-viz-code">
        {plan.code.map((line, i) => (
          <span
            key={i}
            className={
              i === lineIndex ? "code-viz-line is-current" : "code-viz-line"
            }
          >
            <span className="code-viz-lineno">{i}</span>
            <span className="code-viz-text">{line || " "}</span>
          </span>
        ))}
      </pre>

      {step.structure ? <StructureViz structure={step.structure} /> : null}
      <StepArrays step={step} />
      <StepVars step={step} />
      {step.note ? <p className="code-viz-note">{step.note}</p> : null}

      <div className="code-viz-controls">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index <= 0}
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => {
            if (index >= plan.steps.length - 1) {
              setIndex(0);
              setPlaying(true);
              return;
            }
            setPlaying((value) => !value);
          }}
        >
          {playing
            ? "Pause"
            : index >= plan.steps.length - 1
              ? "Replay"
              : "Play"}
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index >= plan.steps.length - 1}
        >
          Next
        </button>
      </div>
    </section>
  );
}

export function CodeVizPlaceholder() {
  return (
    <div className="code-viz is-loading" aria-live="polite">
      Building visualization…
    </div>
  );
}
