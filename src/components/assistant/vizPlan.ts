export type VizArrayState = {
  values: Array<string | number | boolean | null>;
  highlights?: Record<string, string>;
};

export type VizStep = {
  line: number;
  vars?: Record<string, string | number | boolean | null>;
  arrays?: Record<string, VizArrayState>;
  /**
   * Optional structural payload for trees/graphs/linked-lists.
   * Kept optional for backward compatibility with array-only plans.
   */
  structure?: VizStructurePayload;
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
  | "heap"
  | "recursion"
  | "backtracking"
  | "dp"
  | "graph_bfs"
  | "graph_dfs"
  | "trie"
  | "sort"
  | "other";

export type VizPlan = {
  title?: string;
  kind?: VizKind;
  code: string[];
  steps: VizStep[];
};

export type VizStructureKind = "tree" | "graph" | "linked_list";

export type VizStructureNode = {
  id: string;
  label?: string;
  /**
   * Visual state for rendering (e.g. active/visited/frontier/dimmed).
   * We keep this permissive because the AI may emit new state labels.
   */
  state?: string;
  x?: number;
  y?: number;
};

export type VizStructureEdge = {
  from: string;
  to: string;
  state?: string;
};

export type VizStructurePayload = {
  kind: VizStructureKind;
  nodes: VizStructureNode[];
  edges?: VizStructureEdge[];

  rootId?: string;
  currentNodeId?: string;

  queue?: string[];
  stack?: string[];
  visitedOrder?: string[];
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
  "heap",
  "recursion",
  "backtracking",
  "dp",
  "graph_bfs",
  "graph_dfs",
  "trie",
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

  const structure = parseStructurePayload(record.structure);

  return {
    line: Math.max(0, Math.floor(line)),
    vars: Object.keys(vars).length > 0 ? vars : undefined,
    arrays: Object.keys(arrays).length > 0 ? arrays : undefined,
    structure,
    note: typeof record.note === "string" ? record.note : undefined,
  };
}

function parseStructurePayload(
  value: unknown,
): VizStructurePayload | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const kindRaw = record.kind;
  if (typeof kindRaw !== "string") return undefined;
  const kind = kindRaw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const allowed: Record<string, VizStructureKind> = {
    tree: "tree",
    graph: "graph",
    linked_list: "linked_list",
    linkedlist: "linked_list",
    linked_list_node: "linked_list",
    linked_list_nodes: "linked_list",
  };
  const structureKind = allowed[kind];
  if (!structureKind) return undefined;

  const nodesRaw = record.nodes;
  if (!Array.isArray(nodesRaw) || nodesRaw.length === 0) return undefined;
  const nodes: VizStructureNode[] = [];
  for (const n of nodesRaw) {
    const nr = asRecord(n);
    if (!nr) continue;
    const idRaw = nr.id ?? nr.nodeId ?? nr.key ?? nr.value;
    if (idRaw === undefined || idRaw === null) continue;
    const id = String(idRaw);

    const labelRaw = nr.label ?? nr.text ?? nr.value;
    const label =
      labelRaw === undefined
        ? undefined
        : labelRaw === null
          ? "null"
          : String(labelRaw);

    const stateRaw = nr.state ?? nr.status;
    const state = typeof stateRaw === "string" ? stateRaw : undefined;

    const xRaw = nr.x ?? nr.cx;
    const yRaw = nr.y ?? nr.cy;
    const x =
      typeof xRaw === "number" && Number.isFinite(xRaw) ? xRaw : undefined;
    const y =
      typeof yRaw === "number" && Number.isFinite(yRaw) ? yRaw : undefined;

    nodes.push({
      id,
      ...(label !== undefined ? { label } : {}),
      ...(state !== undefined ? { state } : {}),
      ...(x !== undefined ? { x } : {}),
      ...(y !== undefined ? { y } : {}),
    });
  }
  if (nodes.length === 0) return undefined;

  const edgesRaw = record.edges;
  let edges: VizStructureEdge[] | undefined;
  if (Array.isArray(edgesRaw) && edgesRaw.length > 0) {
    edges = [];
    for (const e of edgesRaw) {
      const er = asRecord(e);
      if (!er) continue;
      const fromRaw = er.from ?? er.source ?? er.u;
      const toRaw = er.to ?? er.target ?? er.v;
      if (fromRaw === undefined || toRaw === undefined) continue;
      const from = String(fromRaw);
      const to = String(toRaw);
      const stateRaw = er.state ?? er.status;
      const state = typeof stateRaw === "string" ? stateRaw : undefined;
      edges.push({ from, to, ...(state !== undefined ? { state } : {}) });
    }
    if (edges.length === 0) edges = undefined;
  }

  const rootId = typeof record.rootId === "string" ? record.rootId : undefined;
  const currentNodeId =
    typeof record.currentNodeId === "string" ? record.currentNodeId : undefined;

  const queue = parseStringArray(record.queue);
  const stack = parseStringArray(record.stack);
  const visitedOrder = parseStringArray(record.visitedOrder);

  return {
    kind: structureKind,
    nodes,
    ...(edges ? { edges } : {}),
    ...(rootId !== undefined ? { rootId } : {}),
    ...(currentNodeId !== undefined ? { currentNodeId } : {}),
    ...(queue ? { queue } : {}),
    ...(stack ? { stack } : {}),
    ...(visitedOrder ? { visitedOrder } : {}),
  };
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (item === null || item === undefined) continue;
    if (typeof item === "string") out.push(item);
    else out.push(String(item));
  }
  return out.length > 0 ? out : undefined;
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
