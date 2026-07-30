import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VizKind } from "../components/assistant/vizPlan";
import { DEFAULT_STUDY_PINS, mergeStudyPins } from "../data/studyPins";

export type StudyHistoryItem = {
  date: string;
  title: string;
  difficulty?: string;
  path?: string;
  passed?: boolean;
};

export type LessonId = string;
export type LessonExerciseId = string;

type StudyState = {
  streakDays: number;
  lastPracticeDate: string | null;
  history: StudyHistoryItem[];
  pinnedPatterns: VizKind[];

  currentLessonId: LessonId | null;
  completedLessonIds: LessonId[];
  stepIndexByLesson: Record<LessonId, number>;
  completedExerciseIds: LessonExerciseId[];
  lessonLastOpenedAtById: Record<LessonId, string | undefined>;

  recordPractice: (
    item: Omit<StudyHistoryItem, "date"> & { date?: string },
  ) => void;
  pinPattern: (kind: VizKind) => void;
  unpinPattern: (kind: VizKind) => void;

  startLesson: (lessonId: LessonId) => void;
  setLessonStepIndex: (lessonId: LessonId, stepIndex: number) => void;
  completeLesson: (lessonId: LessonId) => void;
  markLessonExerciseCompleted: (exerciseId: LessonExerciseId) => void;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      streakDays: 0,
      lastPracticeDate: null,
      history: [],
      pinnedPatterns: [...DEFAULT_STUDY_PINS],
      currentLessonId: null,
      completedLessonIds: [],
      stepIndexByLesson: {},
      completedExerciseIds: [],
      lessonLastOpenedAtById: {},
      recordPractice: (item) => {
        const date = item.date ?? today();
        const prev = get().lastPracticeDate;
        let streak = get().streakDays;
        if (prev === date) {
          // same day — keep streak
        } else if (prev && prev === yesterdayOf(date)) {
          streak += 1;
        } else {
          streak = 1;
        }
        set({
          streakDays: streak,
          lastPracticeDate: date,
          history: [
            {
              date,
              title: item.title,
              difficulty: item.difficulty,
              path: item.path,
              passed: item.passed,
            },
            ...get().history,
          ].slice(0, 100),
        });
      },
      pinPattern: (kind) =>
        set((state) => ({
          pinnedPatterns: state.pinnedPatterns.includes(kind)
            ? state.pinnedPatterns
            : [...state.pinnedPatterns, kind].slice(0, 20),
        })),
      unpinPattern: (kind) =>
        set((state) => ({
          pinnedPatterns: state.pinnedPatterns.filter((k) => k !== kind),
        })),

      startLesson: (lessonId) =>
        set((state) => ({
          currentLessonId: lessonId,
          stepIndexByLesson: {
            ...state.stepIndexByLesson,
            [lessonId]: state.stepIndexByLesson[lessonId] ?? 0,
          },
          lessonLastOpenedAtById: {
            ...state.lessonLastOpenedAtById,
            [lessonId]: today(),
          },
        })),

      setLessonStepIndex: (lessonId, stepIndex) =>
        set((state) => ({
          stepIndexByLesson: {
            ...state.stepIndexByLesson,
            [lessonId]: stepIndex,
          },
          lessonLastOpenedAtById: {
            ...state.lessonLastOpenedAtById,
            [lessonId]: today(),
          },
        })),

      completeLesson: (lessonId) =>
        set((state) => ({
          currentLessonId:
            state.currentLessonId === lessonId ? null : state.currentLessonId,
          completedLessonIds: state.completedLessonIds.includes(lessonId)
            ? state.completedLessonIds
            : [...state.completedLessonIds, lessonId],
          stepIndexByLesson: { ...state.stepIndexByLesson, [lessonId]: 0 },
          lessonLastOpenedAtById: {
            ...state.lessonLastOpenedAtById,
            [lessonId]: state.lessonLastOpenedAtById[lessonId] ?? today(),
          },
        })),

      markLessonExerciseCompleted: (exerciseId) =>
        set((state) => ({
          completedExerciseIds: state.completedExerciseIds.includes(exerciseId)
            ? state.completedExerciseIds
            : [...state.completedExerciseIds, exerciseId],
        })),
    }),
    {
      name: "scratchcli-study",
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as {
          pinnedPatterns?: VizKind[];
          [key: string]: unknown;
        };
        return {
          ...state,
          pinnedPatterns: mergeStudyPins(state.pinnedPatterns),
        };
      },
    },
  ),
);
