import type { VizKind } from "../components/assistant/vizPlan";

type StudyStateSlice = {
  pinnedPatterns?: VizKind[];
  [key: string]: unknown;
};

/** Default Study board pinned visualize patterns. */
export const DEFAULT_STUDY_PINS: VizKind[] = [
  "two_pointers",
  "sliding_window",
  "binary_search",
  "hash_map",
  "stack",
  "heap",
  "recursion",
  "backtracking",
  "dp",
  "tree",
  "graph_bfs",
  "graph_dfs",
  "trie",
];

export function mergeStudyPins(existing: VizKind[] | undefined): VizKind[] {
  const current = Array.isArray(existing) ? existing : [];
  const merged = [...current];
  for (const kind of DEFAULT_STUDY_PINS) {
    if (!merged.includes(kind)) merged.push(kind);
  }
  return merged.slice(0, 20);
}

export function migrateStudyPins(state: StudyStateSlice): StudyStateSlice {
  return {
    ...state,
    pinnedPatterns: mergeStudyPins(state.pinnedPatterns),
  };
}
