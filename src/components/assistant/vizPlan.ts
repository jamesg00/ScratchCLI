export type VizArrayState = {
  values: Array<string | number | boolean | null>;
  highlights?: Record<string, string>;
};

export type VizStep = {
  line: number;
  vars?: Record<string, string | number | boolean | null>;
  arrays?: Record<string, VizArrayState>;
  note?: string;
};

export type VizKind =
  | "array"
  | "string"
  | "linked_list"
  | "tree"
  | "two_pointers"
  | "sliding_window"
  | "binary_search"
  | "stack"
  | "queue"
  | "hash_map"
  | "recursion"
  | "dp"
  | "graph_bfs"
  | "graph_dfs"
  | "sort"
  | "other";

export type VizPlan = {
  title?: string;
  kind?: VizKind;
  code: string[];
  steps: VizStep[];
};

const VIZ_KIND_SET = new Set<string>([
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
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseKind(value: unknown): VizKind | undefined {
  if (typeof value !== "string") return undefined;
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return VIZ_KIND_SET.has(key) ? (key as VizKind) : undefined;
}

function parseArrayState(value: unknown): VizArrayState | null {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.values)) return null;
  const highlightsRaw = asRecord(record.highlights) ?? {};
  const highlights: Record<string, string> = {};
  for (const [key, label] of Object.entries(highlightsRaw)) {
    if (typeof label === "string") highlights[key] = label;
  }
  return {
    values: record.values.map((item) => {
      if (
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
      ) {
        return item;
      }
      return String(item);
    }),
    highlights,
  };
}

function parseStep(value: unknown): VizStep | null {
  const record = asRecord(value);
  if (!record) return null;
  const line = Number(record.line);
  if (!Number.isFinite(line)) return null;

  const varsRaw = asRecord(record.vars) ?? {};
  const vars: VizStep["vars"] = {};
  for (const [key, item] of Object.entries(varsRaw)) {
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      vars[key] = item;
    } else {
      vars[key] = String(item);
    }
  }

  const arraysRaw = asRecord(record.arrays) ?? {};
  const arrays: NonNullable<VizStep["arrays"]> = {};
  for (const [key, item] of Object.entries(arraysRaw)) {
    const parsed = parseArrayState(item);
    if (parsed) arrays[key] = parsed;
  }

  return {
    line: Math.max(0, Math.floor(line)),
    vars: Object.keys(vars).length > 0 ? vars : undefined,
    arrays: Object.keys(arrays).length > 0 ? arrays : undefined,
    note: typeof record.note === "string" ? record.note : undefined,
  };
}

/** Parse a ```viz JSON fence into a playable plan. Returns null if invalid. */
export function parseVizPlan(source: string): VizPlan | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    // Tolerate trailing commas / prose wrappers lightly by extracting first {...}
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      raw = JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  const record = asRecord(raw);
  if (!record) return null;

  const codeRaw = record.code;
  const code = Array.isArray(codeRaw)
    ? codeRaw.map((line) => String(line))
    : typeof codeRaw === "string"
      ? codeRaw.split("\n")
      : null;
  if (!code || code.length === 0) return null;

  const stepsRaw = record.steps;
  if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) return null;
  const steps = stepsRaw
    .map(parseStep)
    .filter((step): step is VizStep => step !== null)
    .slice(0, 40);
  if (steps.length === 0) return null;

  return {
    title: typeof record.title === "string" ? record.title : undefined,
    kind: parseKind(record.kind),
    code,
    steps,
  };
}
