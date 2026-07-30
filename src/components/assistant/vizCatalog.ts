import type { VizKind } from "./vizPlan";
import { VIZ_KIND_LABELS } from "./vizPrompt";

export type VizCategoryId =
  | "arrays_hashing"
  | "strings"
  | "two_pointers"
  | "sliding_window"
  | "binary_search"
  | "stack_queue"
  | "heaps"
  | "linked_list"
  | "trees"
  | "tries"
  | "graphs"
  | "dp"
  | "recursion"
  | "backtracking"
  | "sorting";

export type VizCategory = {
  id: VizCategoryId;
  label: string;
  kinds: VizKind[];
};

/** NeetCode-style groupings for the Visualize dialog. */
export const VIZ_CATEGORIES: VizCategory[] = [
  {
    id: "arrays_hashing",
    label: "Arrays / Hashing",
    kinds: ["array", "hash_map"],
  },
  { id: "strings", label: "Strings", kinds: ["string"] },
  {
    id: "two_pointers",
    label: "Two Pointers",
    kinds: ["two_pointers"],
  },
  {
    id: "sliding_window",
    label: "Sliding Window",
    kinds: ["sliding_window"],
  },
  {
    id: "binary_search",
    label: "Binary Search",
    kinds: ["binary_search"],
  },
  {
    id: "stack_queue",
    label: "Stack / Queue",
    kinds: ["stack", "queue"],
  },
  {
    id: "heaps",
    label: "Heaps",
    kinds: ["heap"],
  },
  {
    id: "linked_list",
    label: "Linked List",
    kinds: ["linked_list"],
  },
  { id: "trees", label: "Trees", kinds: ["tree"] },
  { id: "tries", label: "Tries", kinds: ["trie"] },
  {
    id: "graphs",
    label: "Graphs",
    kinds: ["graph_bfs", "graph_dfs"],
  },
  { id: "dp", label: "Dynamic Programming", kinds: ["dp"] },
  { id: "recursion", label: "Recursion", kinds: ["recursion"] },
  {
    id: "backtracking",
    label: "Backtracking",
    kinds: ["backtracking"],
  },
  { id: "sorting", label: "Sorting", kinds: ["sort"] },
];

const KIND_TO_CATEGORY = new Map<VizKind, VizCategoryId>();
for (const category of VIZ_CATEGORIES) {
  for (const kind of category.kinds) {
    KIND_TO_CATEGORY.set(kind, category.id);
  }
}

export function categoryForKind(kind: VizKind): VizCategoryId {
  return KIND_TO_CATEGORY.get(kind) ?? "two_pointers";
}

export function kindsForCategory(categoryId: VizCategoryId): VizKind[] {
  return (
    VIZ_CATEGORIES.find((category) => category.id === categoryId)?.kinds ?? []
  );
}

export function labelForKind(kind: VizKind): string {
  return VIZ_KIND_LABELS[kind] ?? kind;
}
