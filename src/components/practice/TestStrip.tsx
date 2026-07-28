import type { TestRunSummary } from "./parseTestOutput";

type Props = {
  summary: TestRunSummary;
  onClear?: () => void;
};

export function TestStrip({ summary, onClear }: Props) {
  const ok = summary.passed === summary.total && summary.total > 0;
  const fails = summary.cases.filter((c) => !c.passed);

  return (
    <div className="test-strip" data-ok={ok ? "true" : "false"}>
      <span className="test-strip-score">
        {summary.passed}/{summary.total} passed
      </span>
      {fails.length > 0 ? (
        <span className="test-strip-fails">
          Fail:{" "}
          {fails
            .map((f) => f.label)
            .filter(Boolean)
            .slice(0, 4)
            .join(", ")}
        </span>
      ) : (
        <span className="test-strip-ok">All good</span>
      )}
      {onClear ? (
        <button type="button" className="test-strip-clear" onClick={onClear}>
          dismiss
        </button>
      ) : null}
    </div>
  );
}
