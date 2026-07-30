const CHEAT_SHEET_SOURCE =
  "Reference inspired by public Python DSA cheat-sheet resources, including AbdulMalikDev/PythonCheatSheet.";

const CHEAT_SHEET: Record<string, string[]> = {
  basics: [
    "for i, x in enumerate(nums): ...",
    "for a, b in zip(a1, a2): ...",
    "x if cond else y",
    "nums[::-1]  # reverse copy",
  ],
  list: [
    "nums.append(x) | nums.pop() | nums.pop(i)",
    "nums.sort() | nums.sort(key=..., reverse=True)",
    "sorted(nums, key=...)  # new list",
    "nums[l:r]  # slice, r exclusive",
  ],
  dict: [
    "d[key] = d.get(key, 0) + 1",
    "for k, v in d.items(): ...",
    "if key in d: ...",
    "del d[key]  # remove key",
  ],
  counter: [
    "from collections import Counter",
    "freq = Counter(nums)",
    "freq.most_common(3)",
    "freq[a] - freq[b] gives count delta",
  ],
  deque: [
    "from collections import deque",
    "q = deque([start])",
    "q.append(x) | q.appendleft(x)",
    "q.popleft()  # O(1) BFS queue",
  ],
  heap: [
    "import heapq",
    "heapq.heappush(h, x)",
    "x = heapq.heappop(h)",
    "min-heap only; store (-x, x) for max-heap pattern",
  ],
  set: [
    "seen = set()",
    "if x in seen: ...",
    "seen.add(x) | seen.remove(x) | seen.discard(x)",
    "a & b | a | b | a - b",
  ],
  string: [
    "s.lower() | s.strip() | s.split() | ''.join(parts)",
    "s[::-1]  # reverse string",
    "ord(c) - ord('a')  # char index",
    "for ch in s: ...",
  ],
  math: [
    "lo + (hi - lo) // 2  # safe mid",
    "divmod(x, k) -> (q, r)",
    "abs(x), min(...), max(...), sum(...)",
    "float('inf'), -float('inf')",
  ],
  patterns: [
    "Two pointers: while l < r: ...",
    "Sliding window: expand right, shrink while invalid",
    "BFS: deque + visited set",
    "DFS recursion: base case -> recurse children -> return",
  ],
};

const TOPIC_ALIASES: Record<string, keyof typeof CHEAT_SHEET> = {
  arrays: "list",
  lists: "list",
  dictionary: "dict",
  hashmap: "dict",
  hashmaps: "dict",
  maps: "dict",
  queue: "deque",
  bfs: "deque",
  priority: "heap",
  heapq: "heap",
  strings: "string",
};

export function renderPythonCheatSheet(topic?: string): string {
  const raw = topic?.trim().toLowerCase() ?? "";
  const normalized =
    (raw && (TOPIC_ALIASES[raw] ?? (raw as keyof typeof CHEAT_SHEET))) || null;

  if (normalized && CHEAT_SHEET[normalized]) {
    return [
      `Python DSA quick ref: ${normalized}`,
      ...CHEAT_SHEET[normalized].map((line) => `  - ${line}`),
      "",
      CHEAT_SHEET_SOURCE,
    ].join("\n");
  }

  return [
    "Python DSA quick ref",
    "  cheat <topic> topics: basics, list, dict, counter, deque, heap, set, string, math, patterns",
    "",
    ...Object.entries(CHEAT_SHEET).map(
      ([name, lines]) => `- ${name}: ${lines[0]}`,
    ),
    "",
    CHEAT_SHEET_SOURCE,
  ].join("\n");
}
