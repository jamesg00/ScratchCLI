import { useStudyStore } from "../../stores/studyStore";
import { VIZ_KIND_LABELS } from "../assistant/vizPrompt";
import type { VizKind } from "../assistant/vizPlan";
import {
  LESSON_TOPICS,
  getLessonById,
  lessonFeatureSummary,
} from "../../data/lessons";
import type { LessonId } from "../../stores/studyStore";

type Props = {
  onClose: () => void;
  onOpenViz?: (kind?: VizKind) => void;
  onOpenLesson?: (lessonId: LessonId) => void;
};

export function StudyBoardDialog({
  onClose,
  onOpenViz,
  onOpenLesson,
}: Props) {
  const streakDays = useStudyStore((s) => s.streakDays);
  const history = useStudyStore((s) => s.history);
  const pinned = useStudyStore((s) => s.pinnedPatterns);
  const completedLessonIds = useStudyStore((s) => s.completedLessonIds);
  const stepIndexByLesson = useStudyStore((s) => s.stepIndexByLesson);
  const currentLessonId = useStudyStore((s) => s.currentLessonId);

  const nextLessonId = (() => {
    for (const topic of LESSON_TOPICS) {
      for (const id of topic.lessonIds) {
        if (!completedLessonIds.includes(id)) return id;
      }
    }
    return LESSON_TOPICS[0]?.lessonIds[0] ?? null;
  })();

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
                {VIZ_KIND_LABELS[kind] ?? kind}
              </button>
            ))}
          </div>

          <h3>Guided lessons</h3>
          {nextLessonId ? (
            <p className="study-recommended">
              Recommended next:{" "}
              <strong>{getLessonById(nextLessonId)?.title ?? "—"}</strong>
            </p>
          ) : null}
          <div className="study-lessons">
            {LESSON_TOPICS.map((topic) => (
              <div key={topic.id} className="study-topic-group">
                <div className="study-topic-heading">{topic.title}</div>
                <div className="study-topic-desc">{topic.description}</div>
                {topic.lessonIds.map((lessonId) => {
                  const lesson = getLessonById(lessonId);
                  const totalSteps = lesson?.steps.length ?? 0;
                  const stepIndex = stepIndexByLesson[lessonId] ?? 0;
                  const completed = completedLessonIds.includes(lessonId);
                  const isCurrent = currentLessonId === lessonId;
                  const label = completed
                    ? "Review"
                    : isCurrent || stepIndex > 0
                      ? `Resume (Step ${Math.min(stepIndex + 1, Math.max(1, totalSteps))})`
                      : "Start";

                  return (
                    <div key={lessonId} className="study-lesson">
                      <div>
                        <div className="study-lesson-title">
                          {lesson?.title ?? lessonId}
                        </div>
                        <div className="study-lesson-desc">
                          {lesson?.blurb ?? topic.description}
                        </div>
                        {lesson ? (
                          <div className="study-lesson-meta">
                            {lessonFeatureSummary(lesson).join(" · ")}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenLesson?.(lessonId)}
                      >
                        {label}
                      </button>
                    </div>
                  );
                })}
              </div>
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
