import { create } from "zustand";
import { persist } from "zustand/middleware";

type LeetCodeState = {
  completedSlugs: string[];
  skippedSlugs: string[];
  lastSlug: string | null;
  preferredCompanySlug: string;
  submittedFiles: Record<string, string>;
  submittedPaths: Record<string, string>;
  markDone: (slug: string) => void;
  saveSubmittedFile: (slug: string, content: string, path?: string) => void;
  markSkipped: (slug: string) => void;
  setLastSlug: (slug: string | null) => void;
  setPreferredCompanySlug: (slug: string) => void;
  isDone: (slug: string) => boolean;
  resetProgress: () => void;
};

export const useLeetCodeStore = create<LeetCodeState>()(
  persist(
    (set, get) => ({
      completedSlugs: [],
      skippedSlugs: [],
      lastSlug: null,
      preferredCompanySlug: "amazon",
      submittedFiles: {},
      submittedPaths: {},
      markDone: (slug) => {
        const key = slug.trim().toLowerCase();
        if (!key) return;
        set((state) => ({
          completedSlugs: state.completedSlugs.includes(key)
            ? state.completedSlugs
            : [...state.completedSlugs, key],
          lastSlug: key,
        }));
      },
      saveSubmittedFile: (slug, content, path) => {
        const key = slug.trim().toLowerCase();
        if (!key || !content.trim()) return;
        set((state) => ({
          submittedFiles: { ...state.submittedFiles, [key]: content },
          ...(path
            ? { submittedPaths: { ...state.submittedPaths, [key]: path } }
            : {}),
        }));
      },
      markSkipped: (slug) => {
        const key = slug.trim().toLowerCase();
        if (!key) return;
        set((state) => ({
          skippedSlugs: state.skippedSlugs.includes(key)
            ? state.skippedSlugs
            : [...state.skippedSlugs, key],
        }));
      },
      setLastSlug: (slug) => set({ lastSlug: slug }),
      setPreferredCompanySlug: (slug) =>
        set({ preferredCompanySlug: slug.trim().toLowerCase() || "amazon" }),
      isDone: (slug) =>
        get().completedSlugs.includes(slug.trim().toLowerCase()),
      resetProgress: () =>
        set({
          completedSlugs: [],
          skippedSlugs: [],
          submittedFiles: {},
          submittedPaths: {},
          lastSlug: null,
          preferredCompanySlug: "amazon",
        }),
    }),
    { name: "scratchcli-leetcode" },
  ),
);

/** Extract `# LC: title-slug` from a practice buffer. */
export function extractLcSlug(buffer: string): string | null {
  const match = buffer.match(/^\s*#\s*LC:\s*([a-z0-9-]+)\s*$/im);
  return match?.[1]?.toLowerCase() ?? null;
}
