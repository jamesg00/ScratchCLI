import { create } from "zustand";

export type InterviewDifficulty = "easy" | "medium" | "hard";

type InterviewState = {
  active: boolean;
  endsAt: number | null;
  difficulty: InterviewDifficulty;
  revealUnlocked: boolean;
  durationMinutes: number;
  start: (difficulty: InterviewDifficulty, minutes?: number) => void;
  stop: () => void;
  unlockReveal: () => void;
  isHintLocked: () => boolean;
};

export const useInterviewStore = create<InterviewState>()((set, get) => ({
  active: false,
  endsAt: null,
  difficulty: "medium",
  revealUnlocked: false,
  durationMinutes: 25,
  start: (difficulty, minutes = 25) =>
    set({
      active: true,
      difficulty,
      durationMinutes: minutes,
      endsAt: Date.now() + minutes * 60_000,
      revealUnlocked: false,
    }),
  stop: () =>
    set({
      active: false,
      endsAt: null,
      revealUnlocked: false,
    }),
  unlockReveal: () => set({ revealUnlocked: true }),
  isHintLocked: () => {
    const state = get();
    if (!state.active || state.revealUnlocked) return false;
    if (state.endsAt != null && Date.now() >= state.endsAt) return false;
    return true;
  },
}));
