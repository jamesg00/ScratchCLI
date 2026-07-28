import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VizKind } from "../components/assistant/vizPlan";

export type StudyHistoryItem = {
  date: string;
  title: string;
  difficulty?: string;
  path?: string;
  passed?: boolean;
};

type StudyState = {
  streakDays: number;
  lastPracticeDate: string | null;
  history: StudyHistoryItem[];
  pinnedPatterns: VizKind[];
  recordPractice: (
    item: Omit<StudyHistoryItem, "date"> & { date?: string },
  ) => void;
  pinPattern: (kind: VizKind) => void;
  unpinPattern: (kind: VizKind) => void;
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
      pinnedPatterns: ["two_pointers", "binary_search", "sliding_window"],
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
            : [...state.pinnedPatterns, kind].slice(0, 12),
        })),
      unpinPattern: (kind) =>
        set((state) => ({
          pinnedPatterns: state.pinnedPatterns.filter((k) => k !== kind),
        })),
    }),
    { name: "scratchcli-study" },
  ),
);
