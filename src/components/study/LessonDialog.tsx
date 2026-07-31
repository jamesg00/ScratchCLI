import { useEffect, useMemo, useState } from "react";
import { CodeVizPlayer } from "../assistant/CodeVizPlayer";
import { getLocalVizTemplate } from "../assistant/vizTemplates";
import {
  getExerciseById,
  getLessonById,
  type LessonCopyBlock,
  type LessonExercise,
  type LessonStep,
} from "../../data/lessons";
import { useStudyStore, type LessonId } from "../../stores/studyStore";
import type { PracticeFile } from "../assistant/practiceFile";

type Props = {
  lessonId: LessonId;
  onClose: () => void;
  onCreatePracticeFile: (file: PracticeFile) => Promise<string>;
};

const STEP_LABELS: Record<LessonStep["type"], string> = {
  concept: "Concept",
  worked_example: "Worked example",
  strategy: "Strategy",
  pitfall: "Pitfall",
  recap: "Recap",
  viz: "Visualization",
  checkpoint: "Checkpoint",
  exercise: "Exercise",
};

function CopyBlocks({ blocks }: { blocks: LessonCopyBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === "paragraph") {
          return <p key={index}>{block.text}</p>;
        }
        if (block.kind === "bullets") {
          return (
            <div key={index} className="lesson-copy-block">
              {block.title ? <strong>{block.title}</strong> : null}
              <ul className="lesson-bullets">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <div key={index} className="lesson-callout" data-tone={block.tone}>
            <strong>{block.title}</strong>
            <p>{block.text}</p>
          </div>
        );
      })}
    </>
  );
}

function CheckpointCard({
  step,
}: {
  step: Extract<LessonStep, { type: "checkpoint" }>;
}) {
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <div className="lesson-step-body">
      <h3>{step.title}</h3>
      <p>
        <strong>Checkpoint:</strong> {step.prompt}
      </p>
      {step.hint ? (
        <div className="lesson-inline-actions">
          <button
            type="button"
            onClick={() => setShowHint((v) => !v)}
            className="lesson-inline-btn"
          >
            {showHint ? "Hide hint" : "Reveal hint"}
          </button>
          {step.answer ? (
            <button
              type="button"
              onClick={() => setShowAnswer((v) => !v)}
              className="lesson-inline-btn"
            >
              {showAnswer ? "Hide reasoning" : "Reveal reasoning"}
            </button>
          ) : null}
        </div>
      ) : null}
      {showHint && step.hint ? <p>{step.hint}</p> : null}
      {showAnswer && step.answer ? (
        <div className="lesson-callout" data-tone="strategy">
          <strong>Reasoning</strong>
          <p>{step.answer}</p>
        </div>
      ) : null}
      {step.takeaway ? (
        <div className="lesson-callout" data-tone="signal">
          <strong>Takeaway</strong>
          <p>{step.takeaway}</p>
        </div>
      ) : null}
    </div>
  );
}

function StepCard({ step }: { step: LessonStep }) {
  if (
    step.type === "concept" ||
    step.type === "worked_example" ||
    step.type === "strategy" ||
    step.type === "pitfall" ||
    step.type === "recap"
  ) {
    return (
      <div className="lesson-step-body">
        <h3>{step.title}</h3>
        <CopyBlocks blocks={step.blocks} />
      </div>
    );
  }

  if (step.type === "checkpoint") {
    return <CheckpointCard step={step} />;
  }

  if (step.type === "viz") {
    const plan = getLocalVizTemplate(step.vizKind);
    return (
      <div className="lesson-step-body">
        <h3>{step.title}</h3>
        {step.content ? <p>{step.content}</p> : null}
        <CodeVizPlayer plan={plan} />
      </div>
    );
  }

  if (step.type === "exercise") {
    return (
      <div className="lesson-step-body">
        <h3>{step.title}</h3>
        <p>{step.intro}</p>
        <div className="lesson-copy-block">
          <strong>Success criteria</strong>
          <ul className="lesson-bullets">
            {step.successCriteria.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return null;
}

function resolvePracticeFile(exercise: LessonExercise): PracticeFile | null {
  return exercise.practiceFile ?? null;
}

export function LessonDialog({
  lessonId,
  onClose,
  onCreatePracticeFile,
}: Props) {
  const lesson = useMemo(() => getLessonById(lessonId), [lessonId]);
  const stepIndexByLesson = useStudyStore((s) => s.stepIndexByLesson);
  const completedExerciseIds = useStudyStore((s) => s.completedExerciseIds);
  const setLessonStepIndex = useStudyStore((s) => s.setLessonStepIndex);
  const startLesson = useStudyStore((s) => s.startLesson);
  const completeLesson = useStudyStore((s) => s.completeLesson);
  const markLessonExerciseCompleted = useStudyStore(
    (s) => s.markLessonExerciseCompleted,
  );
  const currentLessonId = useStudyStore((s) => s.currentLessonId);

  const [busy, setBusy] = useState(false);
  const [revealExercise, setRevealExercise] = useState(false);

  const index = stepIndexByLesson[lessonId] ?? 0;
  const step = lesson?.steps[index];

  // Keep the lesson selection in the store, including when a stale id briefly
  // renders while the dialog is closing or switching lessons.
  useEffect(() => {
    if (lesson && currentLessonId !== lessonId) startLesson(lessonId);
  }, [currentLessonId, lesson, lessonId, startLesson]);

  if (!lesson || !step) {
    return (
      <div className="dialog-backdrop" role="presentation" onClick={onClose}>
        <section
          className="lesson-dialog"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <header>
            <h2>Lesson</h2>
            <button type="button" onClick={onClose} aria-label="Close">
              x
            </button>
          </header>
          <p>Lesson not found.</p>
        </section>
      </div>
    );
  }

  const isLast = index >= lesson.steps.length - 1;
  const exercise =
    step.type === "exercise" ? getExerciseById(step.exerciseId) : undefined;
  const exerciseDone =
    step.type === "exercise"
      ? completedExerciseIds.includes(step.exerciseId)
      : false;
  const stepLabel = STEP_LABELS[step.type];

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="lesson-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="lesson-title">{lesson.title}</h2>
            <p className="lesson-subtitle">{lesson.blurb}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            x
          </button>
        </header>

        <div className="lesson-body">
          <div className="lesson-summary">
            <div className="lesson-summary-grid">
              <section>
                <strong>Learning goals</strong>
                <ul className="lesson-bullets">
                  {lesson.learningGoals.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              </section>
              <section>
                <strong>Pattern signals</strong>
                <ul className="lesson-bullets">
                  {lesson.patternSignals.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
          <p className="lesson-step-meta">
            {stepLabel} · Step {index + 1}/{lesson.steps.length} · about{" "}
            {lesson.estimatedMinutes} min
          </p>

          <StepCard step={step} />

          {step.type === "exercise" && exercise ? (
            <div className="lesson-exercise-cta">
              <p>
                <strong>{exercise.title}.</strong> {exercise.description}
              </p>
              <div className="lesson-summary-grid">
                <section>
                  <strong>Common mistakes to avoid</strong>
                  <ul className="lesson-bullets">
                    {lesson.commonMistakes.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <strong>Complexity checklist</strong>
                  <ul className="lesson-bullets">
                    {lesson.complexityChecklist.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
              <p>
                Need help while solving? Open DSA coach and type{" "}
                <code>hint {exercise.title.toLowerCase()}</code>.
              </p>

              <button
                type="button"
                disabled={busy || exerciseDone}
                className="lesson-inline-btn"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const practice = resolvePracticeFile(exercise);
                    if (!practice) {
                      setRevealExercise(true);
                      return;
                    }
                    await onCreatePracticeFile(practice);
                    markLessonExerciseCompleted(exercise.id);
                    setLessonStepIndex(lessonId, index + 1);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {exerciseDone
                  ? "Exercise opened"
                  : busy
                    ? "Opening…"
                    : "Open practice file"}
              </button>

              {revealExercise && !resolvePracticeFile(exercise) ? (
                <p className="lesson-error">
                  This exercise is a placeholder right now. Complete
                  `lesson-mvp` to author the practice file content.
                </p>
              ) : null}
            </div>
          ) : null}

          {step.type !== "exercise" ? (
            <div className="lesson-navigation">
              <button
                type="button"
                disabled={index <= 0}
                onClick={() =>
                  setLessonStepIndex(lessonId, Math.max(0, index - 1))
                }
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLast) {
                    completeLesson(lessonId);
                    onClose();
                    return;
                  }
                  setLessonStepIndex(lessonId, index + 1);
                }}
              >
                {isLast ? "Finish" : "Next"}
              </button>
            </div>
          ) : (
            // For exercises, we only auto-advance after the practice file opens.
            <div className="lesson-navigation">
              <button
                type="button"
                disabled={index <= 0}
                onClick={() =>
                  setLessonStepIndex(lessonId, Math.max(0, index - 1))
                }
              >
                Prev
              </button>
              <button
                type="button"
                disabled={!exerciseDone}
                onClick={() => {
                  if (isLast) {
                    completeLesson(lessonId);
                    onClose();
                    return;
                  }
                  setLessonStepIndex(lessonId, index + 1);
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
