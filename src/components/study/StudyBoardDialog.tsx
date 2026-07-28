import { useStudyStore } from "../../stores/studyStore";
import { VIZ_KIND_LABELS } from "../assistant/vizPrompt";
import type { VizKind } from "../assistant/vizPlan";

type Props = {
  onClose: () => void;
  onOpenViz?: (kind?: VizKind) => void;
};

export function StudyBoardDialog({ onClose, onOpenViz }: Props) {
  const streakDays = useStudyStore((s) => s.streakDays);
  const history = useStudyStore((s) => s.history);
  const pinned = useStudyStore((s) => s.pinnedPatterns);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="study-board-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-board-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="study-board-title">Study board</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            x
          </button>
        </header>
        <div className="study-board-body">
          <p className="study-streak">
            Streak: <strong>{streakDays}</strong> day
            {streakDays === 1 ? "" : "s"}
          </p>
          <h3>Pinned patterns</h3>
          <div className="study-pins">
            {pinned.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  onClose();
                  onOpenViz?.(kind);
                }}
              >
                {VIZ_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
          <h3>Recent practice</h3>
          <ul className="study-history">
            {history.slice(0, 7).map((item, index) => (
              <li key={`${item.date}-${item.title}-${index}`}>
                <span>{item.date}</span> {item.title}
                {item.passed == null ? "" : item.passed ? " · pass" : " · fail"}
              </li>
            ))}
            {history.length === 0 ? <li>No practice logged yet.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
