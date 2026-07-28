import { parseVizPlan, type VizKind, type VizPlan } from "./vizPlan";

export const VIZ_KINDS: VizKind[] = [
  "array",
  "string",
  "linked_list",
  "tree",
  "two_pointers",
  "sliding_window",
  "binary_search",
  "stack",
  "queue",
  "hash_map",
  "recursion",
  "dp",
  "graph_bfs",
  "graph_dfs",
  "sort",
  "other",
];

export const VIZ_KIND_LABELS: Record<VizKind, string> = {
  array: "Array",
  string: "String",
  linked_list: "Linked list",
  tree: "Tree",
  two_pointers: "Two pointers",
  sliding_window: "Sliding window",
  binary_search: "Binary search",
  stack: "Stack",
  queue: "Queue",
  hash_map: "Hash map",
  recursion: "Recursion",
  dp: "Dynamic programming",
  graph_bfs: "Graph BFS",
  graph_dfs: "Graph DFS",
  sort: "Sorting",
  other: "Algorithm",
};

const KIND_SCHEMA =
  "array|string|linked_list|tree|two_pointers|sliding_window|binary_search|stack|queue|hash_map|recursion|dp|graph_bfs|graph_dfs|sort|other";

/** Focused prompt: classify problem + emit one playable ```viz plan. */
export function buildVizPrompt(options?: { focus?: string }): string {
  const focus = options?.focus?.trim();
  return [
    "Create a step-through visualization for the code / problem in the editor buffer.",
    focus ? `User focus: ${focus}` : "",
    "Prefer the algorithm lines from the buffer when present.",
    "Prefer sample inputs from asserts, docstring examples, or literal assignments in the buffer (nums=, target=, k=, quoted strings).",
    "Reply with a short one-line intro naming the pattern, then ONE ```viz fence containing JSON only.",
    "JSON schema:",
    `{"kind":"${KIND_SCHEMA}","title":"...","code":["line0","line1"],"steps":[{"line":0,"vars":{"i":0},"arrays":{"a":{"values":[1,2],"highlights":{"0":"i"}}},"note":"..."}]}`,
    "Rules:",
    "- Pick the best `kind` for this problem.",
    "- `code` should be the algorithm lines to highlight (from the buffer if present, else a short correct sketch).",
    "- 0-based `line` indexes into `code`. Keep steps ≤ 40.",
    "- Prefer arrays + pointer highlights + vars so the UI can animate clearly.",
    "- Linked lists / trees: represent node values as 1D arrays with pointer highlights (no special graph JSON).",
    "- Do not dump a full unrelated solution essay. No second code fence required.",
    "- If the buffer is empty or not an algorithm, invent a tiny illustrative example for a common DSA pattern.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Pull the largest ```viz fence from a model reply and parse it. */
export function extractVizPlanFromReply(reply: string): VizPlan | null {
  const re = /```(?:viz|visualize)\s*\n([\s\S]*?)```/gi;
  let best: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(reply)) !== null) {
    const body = match[1]?.trim() ?? "";
    if (!best || body.length > best.length) best = body;
  }
  if (best) {
    const plan = parseVizPlan(best);
    if (plan) return plan;
  }
  // Fallback: whole reply might be raw JSON.
  return parseVizPlan(reply);
}
