import type { VizKind, VizPlan, VizStep, VizStructurePayload } from "./vizPlan";
import {
  extractVizInputs,
  primaryArray,
  primaryString,
  type VizExtractedInputs,
  type VizScalar,
} from "./vizExtract";
import { VIZ_KIND_LABELS } from "./vizPrompt";
import { detectVizKind, getLocalVizTemplate } from "./vizTemplates";

const MAX_STEPS = 40;

function codeLines(source: string): string[] {
  return source
    .trim()
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, "  "));
}

function step(
  line: number,
  opts: {
    vars?: VizStep["vars"];
    arrays?: VizStep["arrays"];
    structure?: VizStep["structure"];
    note?: string;
  } = {},
): VizStep {
  return { line, ...opts };
}

function asNumbers(values: VizScalar[]): number[] | null {
  const nums: number[] = [];
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
    else if (
      typeof v === "string" &&
      v.trim() !== "" &&
      Number.isFinite(Number(v))
    ) {
      nums.push(Number(v));
    } else {
      return null;
    }
  }
  return nums;
}

function clampHighlights(
  values: VizScalar[],
  highlights: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, label] of Object.entries(highlights)) {
    const idx = Number(key);
    if (Number.isInteger(idx) && idx >= 0 && idx < values.length) {
      next[key] = label;
    }
  }
  return next;
}

/** Overlay extracted primary array values onto a canned template when lengths fit. */
export function overlayInputsOnTemplate(
  plan: VizPlan,
  inputs: VizExtractedInputs,
): VizPlan | null {
  const arr = primaryArray(inputs);
  if (!arr || arr.values.length === 0) return null;

  const steps = plan.steps.map((s) => {
    if (!s.arrays) return s;
    const arrays: NonNullable<VizStep["arrays"]> = {};
    let touched = false;
    for (const [key, state] of Object.entries(s.arrays)) {
      if (state.values.length === arr.values.length) {
        arrays[key] = {
          values: [...arr.values],
          highlights: clampHighlights(arr.values, state.highlights ?? {}),
        };
        touched = true;
      } else if (
        key === "nums" ||
        key === "arr" ||
        key === arr.name ||
        Object.keys(s.arrays).length === 1
      ) {
        // Length mismatch on primary-looking key: skip overlay for this step's array
        arrays[key] = state;
      } else {
        arrays[key] = state;
      }
    }
    if (!touched) return s;
    return { ...s, arrays };
  });

  // Require at least one step changed
  const changed = steps.some((s, i) => s !== plan.steps[i]);
  if (!changed) return null;

  return {
    ...plan,
    title: plan.title
      ? `${plan.title} (your data)`
      : `${VIZ_KIND_LABELS[plan.kind ?? "other"]} (your data)`,
    steps,
  };
}

function simTwoPointers(inputs: VizExtractedInputs): VizPlan | null {
  const arr = primaryArray(inputs);
  if (!arr) return null;
  const nums = asNumbers(arr.values);
  if (!nums || nums.length < 2) return null;
  const target = inputs.target ?? nums[0]! + nums[nums.length - 1]!;
  const sorted = [...nums].sort((a, b) => a - b);
  const name = arr.name || "nums";

  const code = codeLines(`
def two_sum_sorted(${name}, target):
    left, right = 0, len(${name}) - 1
    while left < right:
        total = ${name}[left] + ${name}[right]
        if total == target:
            return [left, right]
        if total < target:
            left += 1
        else:
            right -= 1
    return []
`);

  const steps: VizStep[] = [];
  let left = 0;
  let right = sorted.length - 1;
  steps.push(
    step(1, {
      vars: { left, right, target },
      arrays: {
        [name]: {
          values: sorted,
          highlights: { [String(left)]: "L", [String(right)]: "R" },
        },
      },
      note: `Your ${name}; hunt for sum ${target}.`,
    }),
  );

  while (left < right && steps.length < MAX_STEPS - 1) {
    const total = sorted[left]! + sorted[right]!;
    steps.push(
      step(3, {
        vars: { left, right, total, target },
        arrays: {
          [name]: {
            values: sorted,
            highlights: { [String(left)]: "L", [String(right)]: "R" },
          },
        },
        note: `${sorted[left]} + ${sorted[right]} = ${total}`,
      }),
    );
    if (total === target) {
      steps.push(
        step(4, {
          vars: { left, right },
          arrays: {
            [name]: {
              values: sorted,
              highlights: { [String(left)]: "L", [String(right)]: "R" },
            },
          },
          note: "Pair found.",
        }),
      );
      break;
    }
    if (total < target) left += 1;
    else right -= 1;
  }

  return {
    kind: "two_pointers",
    title: "Two pointers — your array",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

function simSlidingWindow(inputs: VizExtractedInputs): VizPlan | null {
  const arr = primaryArray(inputs);
  if (!arr) return null;
  const nums = asNumbers(arr.values);
  if (!nums || nums.length < 2) return null;
  const k = Math.max(
    1,
    Math.min(inputs.k ?? Math.min(3, nums.length), nums.length),
  );
  const name = arr.name || "nums";
  const code = codeLines(`
def max_sum(${name}, k):
    window = sum(${name}[:k])
    best = window
    for right in range(k, len(${name})):
        window += ${name}[right] - ${name}[right - k]
        best = max(best, window)
    return best
`);

  const steps: VizStep[] = [];
  let window = nums.slice(0, k).reduce((a, b) => a + b, 0);
  let best = window;
  const highlights = (L: number, R: number) => {
    const h: Record<string, string> = { [String(L)]: "L", [String(R)]: "R" };
    for (let i = L + 1; i < R; i += 1) h[String(i)] = "";
    return h;
  };
  steps.push(
    step(1, {
      vars: { k, window, best },
      arrays: { [name]: { values: nums, highlights: highlights(0, k - 1) } },
      note: `First window of k=${k} sums to ${window}.`,
    }),
  );
  for (
    let right = k;
    right < nums.length && steps.length < MAX_STEPS - 1;
    right += 1
  ) {
    window += nums[right]! - nums[right - k]!;
    best = Math.max(best, window);
    const left = right - k + 1;
    steps.push(
      step(3, {
        vars: { right, window, best },
        arrays: {
          [name]: { values: nums, highlights: highlights(left, right) },
        },
        note: `Window sum ${window}; best ${best}.`,
      }),
    );
  }
  steps.push(
    step(5, {
      vars: { best },
      arrays: { [name]: { values: nums, highlights: {} } },
      note: `Best window sum is ${best}.`,
    }),
  );
  return {
    kind: "sliding_window",
    title: "Sliding window — your array",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

function simBinarySearch(inputs: VizExtractedInputs): VizPlan | null {
  const arr = primaryArray(inputs);
  if (!arr) return null;
  const nums = asNumbers(arr.values);
  if (!nums || nums.length < 1) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const target =
    inputs.target ?? sorted[Math.floor(sorted.length / 2)] ?? sorted[0]!;
  const name = arr.name || "nums";
  const code = codeLines(`
def binary_search(${name}, target):
    lo, hi = 0, len(${name}) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if ${name}[mid] == target:
            return mid
        if ${name}[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`);
  const steps: VizStep[] = [];
  let lo = 0;
  let hi = sorted.length - 1;
  steps.push(
    step(1, {
      vars: { lo, hi, target },
      arrays: {
        [name]: {
          values: sorted,
          highlights: { "0": "lo", [String(hi)]: "hi" },
        },
      },
      note: `Search ${target} in your sorted ${name}.`,
    }),
  );
  while (lo <= hi && steps.length < MAX_STEPS - 1) {
    const mid = Math.floor((lo + hi) / 2);
    const midVal = sorted[mid]!;
    steps.push(
      step(3, {
        vars: { lo, hi, mid, midVal, target },
        arrays: {
          [name]: {
            values: sorted,
            highlights: {
              [String(lo)]: "lo",
              [String(mid)]: "mid",
              [String(hi)]: "hi",
            },
          },
        },
        note: `mid=${mid} → ${midVal}`,
      }),
    );
    if (midVal === target) {
      steps.push(
        step(4, {
          vars: { mid },
          arrays: {
            [name]: {
              values: sorted,
              highlights: { [String(mid)]: "found" },
            },
          },
          note: "Found.",
        }),
      );
      break;
    }
    if (midVal < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return {
    kind: "binary_search",
    title: "Binary search — your array",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

function simStack(inputs: VizExtractedInputs): VizPlan | null {
  const s = primaryString(inputs);
  if (!s || s.length === 0 || s.length > 24) return null;
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const code = codeLines(`
def is_valid(s):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif not stack or stack.pop() != pairs[ch]:
            return False
    return not stack
`);
  const steps: VizStep[] = [
    step(1, {
      vars: { s },
      arrays: { stack: { values: [], highlights: {} } },
      note: `Validate ${JSON.stringify(s)}.`,
    }),
  ];
  const stack: string[] = [];
  let ok = true;
  for (const ch of s) {
    if (steps.length >= MAX_STEPS - 1) break;
    if ("([{".includes(ch)) {
      stack.push(ch);
      steps.push(
        step(4, {
          vars: { ch },
          arrays: {
            stack: {
              values: [...stack],
              highlights: { [String(stack.length - 1)]: "top" },
            },
          },
          note: `Push '${ch}'.`,
        }),
      );
    } else if (ch in pairs) {
      const top = stack.pop();
      const expect = pairs[ch];
      steps.push(
        step(6, {
          vars: { ch },
          arrays: {
            stack: {
              values: [...stack],
              highlights:
                stack.length > 0 ? { [String(stack.length - 1)]: "top" } : {},
            },
          },
          note:
            top === expect
              ? `'${ch}' matches '${expect}'.`
              : `Mismatch on '${ch}'.`,
        }),
      );
      if (top !== expect) {
        ok = false;
        break;
      }
    }
  }
  steps.push(
    step(7, {
      vars: { valid: ok && stack.length === 0 },
      arrays: { stack: { values: [...stack], highlights: {} } },
      note: ok && stack.length === 0 ? "Valid." : "Invalid.",
    }),
  );
  return {
    kind: "stack",
    title: "Stack — your string",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

function simHashMap(inputs: VizExtractedInputs): VizPlan | null {
  const arr = primaryArray(inputs);
  if (!arr) return null;
  const nums = asNumbers(arr.values);
  if (!nums || nums.length < 2) return null;
  const target = inputs.target ?? nums[0]! + nums[1]!;
  const name = arr.name || "nums";
  const code = codeLines(`
def two_sum(${name}, target):
    seen = {}
    for i, x in enumerate(${name}):
        need = target - x
        if need in seen:
            return [seen[need], i]
        seen[x] = i
    return []
`);
  const steps: VizStep[] = [
    step(1, {
      vars: { target },
      arrays: {
        [name]: { values: nums, highlights: {} },
        seen_keys: { values: [], highlights: {} },
      },
      note: `Two-sum target ${target} on your ${name}.`,
    }),
  ];
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length && steps.length < MAX_STEPS - 1; i += 1) {
    const x = nums[i]!;
    const need = target - x;
    if (seen.has(need)) {
      const j = seen.get(need)!;
      steps.push(
        step(3, {
          vars: { i, x, need },
          arrays: {
            [name]: {
              values: nums,
              highlights: { [String(j)]: "a", [String(i)]: "b" },
            },
            seen_keys: {
              values: [...seen.keys()],
              highlights: { "0": "hit" },
            },
          },
          note: `need=${need} already seen — pair [${j}, ${i}].`,
        }),
      );
      break;
    }
    seen.set(x, i);
    steps.push(
      step(5, {
        vars: { i, x, need },
        arrays: {
          [name]: { values: nums, highlights: { [String(i)]: "i" } },
          seen_keys: {
            values: [...seen.keys()],
            highlights: { [String(seen.size - 1)]: "store" },
          },
        },
        note: `Store ${x} → index ${i}.`,
      }),
    );
  }
  return {
    kind: "hash_map",
    title: "Hash map — your array",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

function simArrayWalk(inputs: VizExtractedInputs): VizPlan | null {
  const arr = primaryArray(inputs);
  if (!arr || arr.values.length === 0) return null;
  const name = arr.name || "nums";
  const values = arr.values.slice(0, 16);
  const code = codeLines(`
def walk(${name}):
    for i, x in enumerate(${name}):
        # process x
        pass
    return ${name}
`);
  const steps: VizStep[] = [
    step(1, {
      arrays: { [name]: { values, highlights: {} } },
      note: `Scan your ${name}.`,
    }),
  ];
  for (let i = 0; i < values.length && steps.length < MAX_STEPS - 1; i += 1) {
    steps.push(
      step(1, {
        vars: { i, x: values[i] as string | number | boolean | null },
        arrays: {
          [name]: { values, highlights: { [String(i)]: "i" } },
        },
        note: `Visit index ${i} → ${JSON.stringify(values[i])}.`,
      }),
    );
  }
  return {
    kind: "array",
    title: "Array — your data",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

function simStringWalk(inputs: VizExtractedInputs): VizPlan | null {
  const s = primaryString(inputs);
  if (!s) return null;
  const chars = s.split("");
  const code = codeLines(`
def walk(s):
    for i, ch in enumerate(s):
        # process ch
        pass
    return s
`);
  const steps: VizStep[] = [
    step(1, {
      vars: { s },
      arrays: { chars: { values: chars, highlights: {} } },
      note: `Scan ${JSON.stringify(s)}.`,
    }),
  ];
  for (let i = 0; i < chars.length && steps.length < MAX_STEPS - 1; i += 1) {
    steps.push(
      step(1, {
        vars: { i, ch: chars[i]! },
        arrays: {
          chars: { values: chars, highlights: { [String(i)]: "i" } },
        },
        note: `chars[${i}] = '${chars[i]}'`,
      }),
    );
  }
  return {
    kind: "string",
    title: "String — your data",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

function simSort(inputs: VizExtractedInputs): VizPlan | null {
  const arr = primaryArray(inputs);
  if (!arr) return null;
  const nums = asNumbers(arr.values);
  if (!nums || nums.length < 2) return null;
  const name = arr.name || "nums";
  const working = [...nums];
  const code = codeLines(`
def bubble_pass(${name}):
    n = len(${name})
    for i in range(n - 1):
        if ${name}[i] > ${name}[i + 1]:
            ${name}[i], ${name}[i + 1] = ${name}[i + 1], ${name}[i]
    return ${name}
`);
  const steps: VizStep[] = [];
  for (
    let i = 0;
    i < working.length - 1 && steps.length < MAX_STEPS - 1;
    i += 1
  ) {
    const swapped = working[i]! > working[i + 1]!;
    if (swapped) {
      const tmp = working[i]!;
      working[i] = working[i + 1]!;
      working[i + 1] = tmp;
    }
    steps.push(
      step(2, {
        vars: { i },
        arrays: {
          [name]: {
            values: [...working],
            highlights: { [String(i)]: "i", [String(i + 1)]: "i+1" },
          },
        },
        note: swapped ? "Swap." : "Already ordered.",
      }),
    );
  }
  steps.push(
    step(5, {
      arrays: {
        [name]: {
          values: [...working],
          highlights: { [String(working.length - 1)]: "done" },
        },
      },
      note: "One bubble pass on your data.",
    }),
  );
  return {
    kind: "sort",
    title: "Sort — your array",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

function simTreeBfs(inputs: VizExtractedInputs): VizPlan | null {
  const arr = primaryArray(inputs);
  if (!arr || arr.values.length === 0) return null;

  const values = arr.values.slice(0, 15);
  const nodes = values.map((v, i) => ({
    id: String(i),
    label: String(v),
  }));

  const edges: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < values.length; i += 1) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left < values.length) edges.push({ from: String(i), to: String(left) });
    if (right < values.length) edges.push({ from: String(i), to: String(right) });
  }

  const code = codeLines(`
from collections import deque
def level_order(root):
    if not root:
        return []
    q = deque([root])
    out = []
    while q:
        node = q.popleft()
        out.append(node)
        left_i = 2*idx+1
        right_i = 2*idx+2
    return out
`);

  const structureFor = (stateById: Record<string, string>): VizStructurePayload => {
    return {
      kind: "tree",
      rootId: "0",
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.label,
        state: stateById[n.id],
      })),
      edges: edges.map((e) => ({ from: e.from, to: e.to })),
      visitedOrder: [],
    };
  };

  const steps: VizStep[] = [];

  const queue: number[] = [0];
  const visited: number[] = [];

  // Step 1: initial queue.
  const initialState: Record<string, string> = {};
  for (let i = 0; i < values.length; i += 1) {
    initialState[String(i)] = queue.includes(i) ? "frontier" : "dimmed";
  }
  steps.push(
    step(1, {
      vars: { node: values[0] ?? null },
      arrays: {
        q: {
          values: queue.map((i) => values[i]),
          highlights: { "0": "front" },
        },
        out: { values: [], highlights: {} },
        level: {
          values,
          highlights: { "0": "root" },
        },
      },
      structure: structureFor(initialState),
      note: "Start BFS from the tree root.",
    }),
  );

  while (queue.length > 0 && steps.length < MAX_STEPS - 1) {
    const idx = queue.shift()!;

    // Visit + enqueue children.
    visited.push(idx);
    const left = 2 * idx + 1;
    const right = 2 * idx + 2;
    if (left < values.length) queue.push(left);
    if (right < values.length) queue.push(right);

    const outValues = visited.map((i) => values[i]);
    const qValues = queue.map((i) => values[i]);

    const stateById: Record<string, string> = {};
    for (let i = 0; i < values.length; i += 1) {
      const id = String(i);
      if (i === idx) stateById[id] = "active";
      else if (visited.includes(i)) stateById[id] = "visited";
      else if (queue.includes(i)) stateById[id] = "frontier";
      else stateById[id] = "dimmed";
    }

    const curHighlights: Record<string, string> = {};
    visited.forEach((vIdx, pos) => {
      if (vIdx === idx) curHighlights[String(pos)] = "cur";
    });

    const qHighlights: Record<string, string> = {};
    if (queue.length > 0) qHighlights["0"] = "front";

    steps.push(
      step(6, {
        vars: { node: values[idx] ?? null },
        arrays: {
          q: { values: qValues, highlights: qHighlights },
          out: { values: outValues, highlights: curHighlights },
          level: {
            values,
            highlights: {
              [String(idx)]: "cur",
            },
          },
        },
        structure: {
          ...structureFor(stateById),
          visitedOrder: visited.map((i) => String(i)),
        },
        note: `Visit ${String(values[idx])}; enqueue children (if any).`,
      }),
    );
  }

  return {
    kind: "tree",
    title: "Tree — BFS (structure)",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

function simGraphBfs(inputs: VizExtractedInputs): VizPlan | null {
  const adj = inputs.graphAdj;
  if (!adj || Object.keys(adj).length === 0) return null;

  const allNodesSet = new Set<string>();
  for (const [k, neighbors] of Object.entries(adj)) {
    allNodesSet.add(k);
    for (const n of neighbors) allNodesSet.add(String(n));
  }
  const allNodes = Array.from(allNodesSet);

  const edges: Array<{ from: string; to: string }> = [];
  for (const [from, neighbors] of Object.entries(adj)) {
    for (const n of neighbors) {
      edges.push({ from, to: String(n) });
    }
  }

  const start =
    allNodes.find((n) => n.toLowerCase() === "a") ?? allNodes[0] ?? null;
  if (!start) return null;

  const code = codeLines(`
from collections import deque
def bfs(graph, start):
    seen = {start}
    q = deque([start])
    while q:
        node = q.popleft()
        for nxt in graph[node]:
            if nxt not in seen:
                seen.add(nxt)
                q.append(nxt)
    return seen
`);

  const structureFor = (
    stateById: Record<string, string>,
  ): VizStructurePayload => {
    return {
      kind: "graph",
      nodes: allNodes.map((id) => ({
        id,
        label: id,
        state: stateById[id],
      })),
      edges: edges.map((e) => ({ from: e.from, to: e.to })),
      visitedOrder: [],
    };
  };

  const queue: string[] = [start];
  const seenOrder: string[] = [start];
  const seen = new Set<string>(seenOrder);

  const steps: VizStep[] = [];

  // Initial step: frontier contains start.
  const initialState: Record<string, string> = {};
  for (const id of allNodes) {
    initialState[id] = id === start ? "active" : "dimmed";
  }
  steps.push(
    step(2, {
      vars: { node: start },
      arrays: {
        q: { values: [start], highlights: { "0": "front" } },
        seen: { values: [start], highlights: { "0": "cur" } },
      },
      structure: structureFor(initialState),
      note: "Start BFS from the chosen node.",
    }),
  );

  while (queue.length > 0 && steps.length < MAX_STEPS - 1) {
    const node = queue.shift()!;
    const neighbors = adj[node] ?? [];

    for (const nxtRaw of neighbors) {
      const nxt = String(nxtRaw);
      if (!seen.has(nxt)) {
        seen.add(nxt);
        seenOrder.push(nxt);
        queue.push(nxt);
      }
    }

    const stateById: Record<string, string> = {};
    for (const id of allNodes) {
      if (id === node) stateById[id] = "active";
      else if (queue.includes(id)) stateById[id] = "frontier";
      else if (seen.has(id)) stateById[id] = "visited";
      else stateById[id] = "dimmed";
    }

    const seenHighlights: Record<string, string> = {};
    const curPos = seenOrder.indexOf(node);
    if (curPos >= 0) seenHighlights[String(curPos)] = "cur";
    const qHighlights: Record<string, string> = {};
    if (queue.length > 0) qHighlights["0"] = "front";

    steps.push(
      step(5, {
        vars: { node },
        arrays: {
          q: { values: [...queue], highlights: qHighlights },
          seen: { values: [...seenOrder], highlights: seenHighlights },
        },
        structure: {
          ...structureFor(stateById),
          visitedOrder: [...seenOrder],
        },
        note: `Dequeue ${node} → discover more neighbors into the queue.`,
      }),
    );
  }

  return {
    kind: "graph_bfs",
    title: "Graph BFS — structure",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

function simGraphDfs(inputs: VizExtractedInputs): VizPlan | null {
  const adj = inputs.graphAdj;
  if (!adj || Object.keys(adj).length === 0) return null;

  const allNodesSet = new Set<string>();
  for (const [k, neighbors] of Object.entries(adj)) {
    allNodesSet.add(k);
    for (const n of neighbors) allNodesSet.add(String(n));
  }
  const allNodes = Array.from(allNodesSet);

  const edges: Array<{ from: string; to: string }> = [];
  for (const [from, neighbors] of Object.entries(adj)) {
    for (const n of neighbors) edges.push({ from, to: String(n) });
  }

  const start =
    allNodes.find((n) => n.toLowerCase() === "a") ?? allNodes[0] ?? null;
  if (!start) return null;

  const code = codeLines(`
def dfs(graph, node, seen=None):
    if seen is None:
        seen = set()
    seen.add(node)
    for nxt in graph[node]:
        if nxt not in seen:
            dfs(graph, nxt, seen)
    return seen
`);

  const structureFor = (
    stateById: Record<string, string>,
  ): VizStructurePayload => {
    return {
      kind: "graph",
      nodes: allNodes.map((id) => ({
        id,
        label: id,
        state: stateById[id],
      })),
      edges: edges.map((e) => ({ from: e.from, to: e.to })),
      visitedOrder: [],
    };
  };

  const seen = new Set<string>();
  const seenOrder: string[] = [];

  const steps: VizStep[] = [];

  const stack: string[] = [start];
  while (stack.length > 0 && steps.length < MAX_STEPS - 1) {
    const node = stack.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);
    seenOrder.push(node);

    // Push neighbors (reverse so the first neighbor is explored first-ish).
    const neighbors = (adj[node] ?? []).map(String).reverse();
    for (const nxt of neighbors) {
      if (!seen.has(nxt)) stack.push(nxt);
    }

    const stateById: Record<string, string> = {};
    for (const id of allNodes) {
      if (id === node) stateById[id] = "active";
      else if (seen.has(id)) stateById[id] = "visited";
      else stateById[id] = "dimmed";
    }

    const seenHighlights: Record<string, string> = {};
    const curPos = seenOrder.indexOf(node);
    if (curPos >= 0) seenHighlights[String(curPos)] = "cur";

    steps.push(
      step(3, {
        vars: { node },
        arrays: {
          seen: { values: [...seenOrder], highlights: seenHighlights },
        },
        structure: {
          ...structureFor(stateById),
          visitedOrder: [...seenOrder],
        },
        note: `DFS visit ${node}.`,
      }),
    );
  }

  return {
    kind: "graph_dfs",
    title: "Graph DFS — structure",
    code,
    steps: steps.slice(0, MAX_STEPS),
  };
}

/** Build a free local plan from extracted inputs for a pattern, or null. */
export function simulateVizPlan(
  kind: VizKind,
  inputs: VizExtractedInputs,
): VizPlan | null {
  switch (kind) {
    case "two_pointers":
      return simTwoPointers(inputs);
    case "sliding_window":
      return simSlidingWindow(inputs);
    case "binary_search":
      return simBinarySearch(inputs);
    case "stack":
      return simStack(inputs) ?? simStringWalk(inputs);
    case "hash_map":
      return simHashMap(inputs);
    case "array":
      return simArrayWalk(inputs);
    case "string":
      return simStringWalk(inputs) ?? simStack(inputs);
    case "sort":
      return simSort(inputs);
    case "tree":
      return simTreeBfs(inputs);
    case "graph_bfs":
      return simGraphBfs(inputs);
    case "graph_dfs":
      return simGraphDfs(inputs);
    default:
      return null;
  }
}

export type LocalVizResult = {
  plan: VizPlan;
  kind: VizKind;
  source: "simulated" | "overlay" | "template";
  summary?: string;
};

/**
 * Free local VizPlan: detect kind, extract buffer inputs, simulate or fall back to demo.
 */
export function buildLocalVizPlan(
  buffer: string,
  kind?: VizKind,
): LocalVizResult {
  const chosen = kind ?? detectVizKind(buffer);
  const inputs = extractVizInputs(buffer);

  if (inputs) {
    const simulated = simulateVizPlan(chosen, inputs);
    if (simulated) {
      return {
        plan: simulated,
        kind: simulated.kind ?? chosen,
        source: "simulated",
        summary: inputs.summary,
      };
    }
    const canned = getLocalVizTemplate(
      chosen === "other" ? "two_pointers" : chosen,
    );
    const overlaid = overlayInputsOnTemplate(canned, inputs);
    if (overlaid) {
      return {
        plan: overlaid,
        kind: overlaid.kind ?? chosen,
        source: "overlay",
        summary: inputs.summary,
      };
    }
  }

  return {
    plan: getLocalVizTemplate(chosen === "other" ? "two_pointers" : chosen),
    kind: chosen === "other" ? "two_pointers" : chosen,
    source: "template",
  };
}
