import type { VizKind, VizPlan, VizStep } from "./vizPlan";
import { VIZ_KIND_LABELS, VIZ_KINDS } from "./vizPrompt";

/** Heuristic: guess animation kind from editor text (no API). */
export function detectVizKind(buffer: string): VizKind {
  const text = buffer.toLowerCase();
  if (
    /two.?pointer|left\s*,\s*right|while\s+left\s*<\s*right|l\s*,\s*r\s*=/.test(
      text,
    )
  ) {
    return "two_pointers";
  }
  if (
    /sliding.?window|window.?sum|max.?window|min.?window/.test(text) ||
    (/window\s*=/.test(text) && /left|right|l\b|r\b/.test(text))
  ) {
    return "sliding_window";
  }
  if (/binary.?search|lo\s*,\s*hi|low\s*,\s*high|mid\s*=/.test(text)) {
    return "binary_search";
  }
  if (/\blinked.?list\b|listnode|list.?node|\.next\b|dummy\s*=/.test(text)) {
    return "linked_list";
  }
  if (
    /\btree\b|treenode|left\s*=\s*none|right\s*=\s*none|inorder|preorder|postorder|bst\b/.test(
      text,
    )
  ) {
    return "tree";
  }
  if (
    /\bstack\b|\.append\(|\.pop\(\)|deque\(/.test(text) &&
    /stack/.test(text)
  ) {
    return "stack";
  }
  if (
    (/valid.?paren|parentheses|brackets/.test(text) ||
      /[()[\]{}]{2,}/.test(buffer)) &&
    !/two.?sum/.test(text)
  ) {
    return "stack";
  }
  if (/\bqueue\b|collections\.deque|popleft|fifo/.test(text)) {
    return "queue";
  }
  if (
    /dict\(|defaultdict|Counter|hash.?map|seen\s*=\s*\{|two.?sum/.test(text)
  ) {
    return "hash_map";
  }
  if (/heapq|heappush|heappop|priority.?queue|\bheap\b|kth.?largest/.test(text)) {
    return "heap";
  }
  if (/\btrie\b|startswith|prefix.?tree|autocomplete/.test(text)) {
    return "trie";
  }
  if (
    /backtrack|permute|permutation|combination|subsets?\(|n.?queens|path\.pop\(/.test(
      text,
    )
  ) {
    return "backtracking";
  }
  if (/bfs|queue.*neighbor|level.?order/.test(text)) {
    return "graph_bfs";
  }
  if (/dfs|visited\.add|recursion|def\s+\w+\(.*\):\s*\n\s+\w+\(/.test(text)) {
    if (/dfs|visited|graph|adj/.test(text)) return "graph_dfs";
    return "recursion";
  }
  if (/\bdp\b|memo|tabulation|dp\[/.test(text)) {
    return "dp";
  }
  if (/sorted\(|\.sort\(|merge.?sort|quick.?sort|bubble/.test(text)) {
    return "sort";
  }
  if (
    /\bstr\b|string|vowels|palindrome|s\s*=\s*["']|chars?\s*=/.test(text) &&
    !/nums\s*=/.test(text)
  ) {
    return "string";
  }
  if (/\bnums\b|\barr\b|enumerate\(|for\s+\w+\s+in\s+range/.test(text)) {
    return "array";
  }
  return "two_pointers";
}

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

/** Built-in demo plans — free, no Grok credits. */
export function getLocalVizTemplate(kind: VizKind): VizPlan {
  switch (kind) {
    case "two_pointers":
      return {
        kind,
        title: "Two pointers — pair sum",
        code: codeLines(`
def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return [left, right]
        if total < target:
            left += 1
        else:
            right -= 1
    return []
`),
        steps: [
          step(1, {
            vars: { left: 0, right: 4, target: 9 },
            arrays: {
              nums: {
                values: [1, 2, 4, 6, 8],
                highlights: { "0": "L", "4": "R" },
              },
            },
            note: "Start at both ends of a sorted array.",
          }),
          step(3, {
            vars: { left: 0, right: 4, total: 9, target: 9 },
            arrays: {
              nums: {
                values: [1, 2, 4, 6, 8],
                highlights: { "0": "L", "4": "R" },
              },
            },
            note: "1 + 8 = 9 — found the pair.",
          }),
          step(4, {
            vars: { left: 0, right: 4 },
            arrays: {
              nums: {
                values: [1, 2, 4, 6, 8],
                highlights: { "0": "L", "4": "R" },
              },
            },
            note: "Return the indices.",
          }),
        ],
      };

    case "sliding_window":
      return {
        kind,
        title: "Sliding window — max sum of k",
        code: codeLines(`
def max_sum(nums, k):
    window = sum(nums[:k])
    best = window
    for right in range(k, len(nums)):
        window += nums[right] - nums[right - k]
        best = max(best, window)
    return best
`),
        steps: [
          step(1, {
            vars: { k: 3, window: 6, best: 6 },
            arrays: {
              nums: {
                values: [2, 1, 3, 4, 1],
                highlights: { "0": "L", "1": "", "2": "R" },
              },
            },
            note: "First window [2,1,3] sums to 6.",
          }),
          step(3, {
            vars: { right: 3, window: 8, best: 8 },
            arrays: {
              nums: {
                values: [2, 1, 3, 4, 1],
                highlights: { "1": "L", "2": "", "3": "R" },
              },
            },
            note: "Slide: drop 2, add 4 → window 8.",
          }),
          step(3, {
            vars: { right: 4, window: 8, best: 8 },
            arrays: {
              nums: {
                values: [2, 1, 3, 4, 1],
                highlights: { "2": "L", "3": "", "4": "R" },
              },
            },
            note: "Slide again: drop 1, add 1 → still 8.",
          }),
          step(5, {
            vars: { best: 8 },
            arrays: {
              nums: { values: [2, 1, 3, 4, 1], highlights: {} },
            },
            note: "Best window sum is 8.",
          }),
        ],
      };

    case "binary_search":
      return {
        kind,
        title: "Binary search",
        code: codeLines(`
def binary_search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`),
        steps: [
          step(1, {
            vars: { lo: 0, hi: 6, target: 7 },
            arrays: {
              nums: {
                values: [1, 3, 4, 6, 7, 9, 12],
                highlights: { "0": "lo", "6": "hi" },
              },
            },
            note: "Search 7 in a sorted list.",
          }),
          step(3, {
            vars: { lo: 0, hi: 6, mid: 3 },
            arrays: {
              nums: {
                values: [1, 3, 4, 6, 7, 9, 12],
                highlights: { "0": "lo", "3": "mid", "6": "hi" },
              },
            },
            note: "mid=3 → 6 < 7, search right half.",
          }),
          step(3, {
            vars: { lo: 4, hi: 6, mid: 5 },
            arrays: {
              nums: {
                values: [1, 3, 4, 6, 7, 9, 12],
                highlights: { "4": "lo", "5": "mid", "6": "hi" },
              },
            },
            note: "mid=5 → 9 > 7, shrink hi.",
          }),
          step(4, {
            vars: { lo: 4, hi: 4, mid: 4 },
            arrays: {
              nums: {
                values: [1, 3, 4, 6, 7, 9, 12],
                highlights: { "4": "mid" },
              },
            },
            note: "nums[4]=7 — found.",
          }),
        ],
      };

    case "stack":
      return {
        kind,
        title: "Stack — valid parentheses",
        code: codeLines(`
def is_valid(s):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif not stack or stack.pop() != pairs[ch]:
            return False
    return not stack
`),
        steps: [
          step(1, {
            vars: { ch: null },
            arrays: { stack: { values: [], highlights: {} } },
            note: "Empty stack.",
          }),
          step(4, {
            vars: { ch: "(" },
            arrays: { stack: { values: ["("], highlights: { "0": "top" } } },
            note: "Push '('.",
          }),
          step(4, {
            vars: { ch: "[" },
            arrays: {
              stack: { values: ["(", "["], highlights: { "1": "top" } },
            },
            note: "Push '['.",
          }),
          step(6, {
            vars: { ch: "]" },
            arrays: { stack: { values: ["("], highlights: { "0": "top" } } },
            note: "'] matches '[' — pop.",
          }),
          step(6, {
            vars: { ch: ")" },
            arrays: { stack: { values: [], highlights: {} } },
            note: "')' matches '(' — stack empty → valid.",
          }),
        ],
      };

    case "queue":
      return {
        kind,
        title: "Queue — process in order",
        code: codeLines(`
from collections import deque
def process(items):
    q = deque(items)
    out = []
    while q:
        x = q.popleft()
        out.append(x)
    return out
`),
        steps: [
          step(2, {
            arrays: {
              q: { values: ["A", "B", "C"], highlights: { "0": "front" } },
              out: { values: [], highlights: {} },
            },
            note: "Queue holds A→B→C.",
          }),
          step(4, {
            vars: { x: "A" },
            arrays: {
              q: { values: ["B", "C"], highlights: { "0": "front" } },
              out: { values: ["A"], highlights: { "0": "done" } },
            },
            note: "Dequeue A.",
          }),
          step(4, {
            vars: { x: "B" },
            arrays: {
              q: { values: ["C"], highlights: { "0": "front" } },
              out: { values: ["A", "B"], highlights: { "1": "done" } },
            },
            note: "Dequeue B.",
          }),
          step(4, {
            vars: { x: "C" },
            arrays: {
              q: { values: [], highlights: {} },
              out: { values: ["A", "B", "C"], highlights: {} },
            },
            note: "FIFO order preserved.",
          }),
        ],
      };

    case "hash_map":
      return {
        kind,
        title: "Hash map — two sum",
        code: codeLines(`
def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        need = target - x
        if need in seen:
            return [seen[need], i]
        seen[x] = i
    return []
`),
        steps: [
          step(1, {
            vars: { target: 9 },
            arrays: {
              nums: { values: [2, 7, 11, 15], highlights: {} },
              seen_keys: { values: [], highlights: {} },
            },
            note: "Need two numbers that sum to 9.",
          }),
          step(5, {
            vars: { i: 0, x: 2, need: 7 },
            arrays: {
              nums: { values: [2, 7, 11, 15], highlights: { "0": "i" } },
              seen_keys: { values: [2], highlights: { "0": "store" } },
            },
            note: "Store 2 → index 0.",
          }),
          step(3, {
            vars: { i: 1, x: 7, need: 2 },
            arrays: {
              nums: { values: [2, 7, 11, 15], highlights: { "1": "i" } },
              seen_keys: { values: [2], highlights: { "0": "hit" } },
            },
            note: "need=2 is in seen — pair found.",
          }),
          step(4, {
            vars: { i: 1 },
            arrays: {
              nums: {
                values: [2, 7, 11, 15],
                highlights: { "0": "a", "1": "b" },
              },
            },
            note: "Return [0, 1].",
          }),
        ],
      };

    case "recursion":
      return {
        kind,
        title: "Recursion — factorial",
        code: codeLines(`
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
`),
        steps: [
          step(0, {
            vars: { n: 4 },
            note: "Call factorial(4).",
          }),
          step(3, {
            vars: { n: 4 },
            note: "Needs 4 * factorial(3).",
          }),
          step(3, {
            vars: { n: 3 },
            note: "Needs 3 * factorial(2).",
          }),
          step(3, {
            vars: { n: 2 },
            note: "Needs 2 * factorial(1).",
          }),
          step(2, {
            vars: { n: 1 },
            note: "Base case → 1.",
          }),
          step(3, {
            vars: { n: 4, result: 24 },
            note: "Unwind: 2*1 → 3*2 → 4*6 = 24.",
          }),
        ],
      };

    case "dp":
      return {
        kind,
        title: "DP — climb stairs",
        code: codeLines(`
def climb(n):
    if n <= 2:
        return n
    dp = [0] * (n + 1)
    dp[1], dp[2] = 1, 2
    for i in range(3, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]
`),
        steps: [
          step(3, {
            vars: { n: 5 },
            arrays: {
              dp: {
                values: [0, 1, 2, 0, 0, 0],
                highlights: { "1": "1", "2": "2" },
              },
            },
            note: "Base: 1 way for 1 step, 2 for 2.",
          }),
          step(5, {
            vars: { i: 3 },
            arrays: {
              dp: {
                values: [0, 1, 2, 3, 0, 0],
                highlights: { "3": "i" },
              },
            },
            note: "dp[3] = dp[2]+dp[1] = 3.",
          }),
          step(5, {
            vars: { i: 4 },
            arrays: {
              dp: {
                values: [0, 1, 2, 3, 5, 0],
                highlights: { "4": "i" },
              },
            },
            note: "dp[4] = 5.",
          }),
          step(5, {
            vars: { i: 5 },
            arrays: {
              dp: {
                values: [0, 1, 2, 3, 5, 8],
                highlights: { "5": "ans" },
              },
            },
            note: "dp[5] = 8 ways.",
          }),
        ],
      };

    case "graph_bfs":
      return {
        kind,
        title: "BFS — shortest hops",
        code: codeLines(`
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
`),
        steps: [
          step(2, {
            vars: { start: "A" },
            arrays: {
              q: { values: ["A"], highlights: { "0": "front" } },
              seen: { values: ["A"], highlights: {} },
            },
            structure: {
              kind: "graph",
              nodes: [
                { id: "A", label: "A", state: "active" },
                { id: "B", label: "B", state: "dimmed" },
                { id: "C", label: "C", state: "dimmed" },
                { id: "D", label: "D", state: "dimmed" },
              ],
              edges: [
                { from: "A", to: "B" },
                { from: "A", to: "C" },
                { from: "B", to: "D" },
                { from: "C", to: "D" },
              ],
              rootId: "A",
              queue: ["A"],
              visitedOrder: ["A"],
            },
            note: "Start at A.",
          }),
          step(5, {
            vars: { node: "A" },
            arrays: {
              q: { values: ["B", "C"], highlights: { "0": "front" } },
              seen: { values: ["A", "B", "C"], highlights: {} },
            },
            structure: {
              kind: "graph",
              nodes: [
                { id: "A", label: "A", state: "visited" },
                { id: "B", label: "B", state: "frontier" },
                { id: "C", label: "C", state: "frontier" },
                { id: "D", label: "D", state: "dimmed" },
              ],
              edges: [
                { from: "A", to: "B" },
                { from: "A", to: "C" },
                { from: "B", to: "D" },
                { from: "C", to: "D" },
              ],
              rootId: "A",
              queue: ["B", "C"],
              visitedOrder: ["A", "B", "C"],
            },
            note: "Visit A; enqueue neighbors B, C.",
          }),
          step(5, {
            vars: { node: "B" },
            arrays: {
              q: { values: ["C", "D"], highlights: { "0": "front" } },
              seen: { values: ["A", "B", "C", "D"], highlights: {} },
            },
            structure: {
              kind: "graph",
              nodes: [
                { id: "A", label: "A", state: "visited" },
                { id: "B", label: "B", state: "active" },
                { id: "C", label: "C", state: "frontier" },
                { id: "D", label: "D", state: "frontier" },
              ],
              edges: [
                { from: "A", to: "B" },
                { from: "A", to: "C" },
                { from: "B", to: "D" },
                { from: "C", to: "D" },
              ],
              rootId: "A",
              queue: ["C", "D"],
              visitedOrder: ["A", "B", "C", "D"],
            },
            note: "Visit B; enqueue D.",
          }),
          step(5, {
            vars: { node: "C" },
            arrays: {
              q: { values: ["D"], highlights: { "0": "front" } },
              seen: { values: ["A", "B", "C", "D"], highlights: {} },
            },
            structure: {
              kind: "graph",
              nodes: [
                { id: "A", label: "A", state: "visited" },
                { id: "B", label: "B", state: "visited" },
                { id: "C", label: "C", state: "active" },
                { id: "D", label: "D", state: "frontier" },
              ],
              edges: [
                { from: "A", to: "B" },
                { from: "A", to: "C" },
                { from: "B", to: "D" },
                { from: "C", to: "D" },
              ],
              rootId: "A",
              queue: ["D"],
              visitedOrder: ["A", "B", "C", "D"],
            },
            note: "Level-order exploration.",
          }),
        ],
      };

    case "graph_dfs":
      return {
        kind,
        title: "DFS — explore deep first",
        code: codeLines(`
def dfs(graph, node, seen=None):
    if seen is None:
        seen = set()
    seen.add(node)
    for nxt in graph[node]:
        if nxt not in seen:
            dfs(graph, nxt, seen)
    return seen
`),
        steps: [
          step(3, {
            vars: { node: "A" },
            arrays: { seen: { values: ["A"], highlights: { "0": "cur" } } },
            structure: {
              kind: "graph",
              nodes: [
                { id: "A", label: "A", state: "active" },
                { id: "B", label: "B", state: "dimmed" },
                { id: "C", label: "C", state: "dimmed" },
                { id: "D", label: "D", state: "dimmed" },
              ],
              edges: [
                { from: "A", to: "B" },
                { from: "A", to: "C" },
                { from: "B", to: "D" },
              ],
              rootId: "A",
              visitedOrder: ["A"],
            },
            note: "Enter A.",
          }),
          step(3, {
            vars: { node: "B" },
            arrays: {
              seen: { values: ["A", "B"], highlights: { "1": "cur" } },
            },
            structure: {
              kind: "graph",
              nodes: [
                { id: "A", label: "A", state: "visited" },
                { id: "B", label: "B", state: "active" },
                { id: "C", label: "C", state: "dimmed" },
                { id: "D", label: "D", state: "dimmed" },
              ],
              edges: [
                { from: "A", to: "B" },
                { from: "A", to: "C" },
                { from: "B", to: "D" },
              ],
              rootId: "A",
              visitedOrder: ["A", "B"],
            },
            note: "Go deep into B before siblings.",
          }),
          step(3, {
            vars: { node: "D" },
            arrays: {
              seen: {
                values: ["A", "B", "D"],
                highlights: { "2": "cur" },
              },
            },
            structure: {
              kind: "graph",
              nodes: [
                { id: "A", label: "A", state: "visited" },
                { id: "B", label: "B", state: "visited" },
                { id: "C", label: "C", state: "dimmed" },
                { id: "D", label: "D", state: "active" },
              ],
              edges: [
                { from: "A", to: "B" },
                { from: "A", to: "C" },
                { from: "B", to: "D" },
              ],
              rootId: "A",
              visitedOrder: ["A", "B", "D"],
            },
            note: "Reach leaf D, then backtrack.",
          }),
          step(3, {
            vars: { node: "C" },
            arrays: {
              seen: {
                values: ["A", "B", "D", "C"],
                highlights: { "3": "cur" },
              },
            },
            structure: {
              kind: "graph",
              nodes: [
                { id: "A", label: "A", state: "visited" },
                { id: "B", label: "B", state: "visited" },
                { id: "C", label: "C", state: "active" },
                { id: "D", label: "D", state: "visited" },
              ],
              edges: [
                { from: "A", to: "B" },
                { from: "A", to: "C" },
                { from: "B", to: "D" },
              ],
              rootId: "A",
              visitedOrder: ["A", "B", "D", "C"],
            },
            note: "After backtrack, visit C.",
          }),
        ],
      };

    case "sort":
      return {
        kind,
        title: "Sort — bubble pass",
        code: codeLines(`
def bubble_pass(nums):
    n = len(nums)
    for i in range(n - 1):
        if nums[i] > nums[i + 1]:
            nums[i], nums[i + 1] = nums[i + 1], nums[i]
    return nums
`),
        steps: [
          step(2, {
            vars: { i: 0 },
            arrays: {
              nums: {
                values: [4, 2, 5, 1],
                highlights: { "0": "i", "1": "i+1" },
              },
            },
            note: "4 > 2 — swap.",
          }),
          step(2, {
            vars: { i: 1 },
            arrays: {
              nums: {
                values: [2, 4, 5, 1],
                highlights: { "1": "i", "2": "i+1" },
              },
            },
            note: "4 < 5 — keep.",
          }),
          step(2, {
            vars: { i: 2 },
            arrays: {
              nums: {
                values: [2, 4, 5, 1],
                highlights: { "2": "i", "3": "i+1" },
              },
            },
            note: "5 > 1 — swap. Largest bubbles right.",
          }),
          step(5, {
            arrays: {
              nums: {
                values: [2, 4, 1, 5],
                highlights: { "3": "done" },
              },
            },
            note: "One pass complete.",
          }),
        ],
      };

    case "array":
      return {
        kind,
        title: "Array — in-place scan",
        code: codeLines(`
def find_max(nums):
    best = nums[0]
    for i in range(1, len(nums)):
        if nums[i] > best:
            best = nums[i]
    return best
`),
        steps: [
          step(1, {
            vars: { best: 3 },
            arrays: {
              nums: {
                values: [3, 1, 7, 2],
                highlights: { "0": "best" },
              },
            },
            note: "Start with first element.",
          }),
          step(2, {
            vars: { i: 1, best: 3 },
            arrays: {
              nums: {
                values: [3, 1, 7, 2],
                highlights: { "0": "best", "1": "i" },
              },
            },
            note: "1 < 3 — keep best.",
          }),
          step(3, {
            vars: { i: 2, best: 7 },
            arrays: {
              nums: {
                values: [3, 1, 7, 2],
                highlights: { "2": "best" },
              },
            },
            note: "7 > 3 — update best.",
          }),
          step(5, {
            vars: { best: 7 },
            arrays: {
              nums: {
                values: [3, 1, 7, 2],
                highlights: { "2": "ans" },
              },
            },
            note: "Max is 7.",
          }),
        ],
      };

    case "string":
      return {
        kind,
        title: "String — reverse vowels sketch",
        code: codeLines(`
def reverse_vowels(s):
    vowels = set('aeiouAEIOU')
    chars = list(s)
    left, right = 0, len(chars) - 1
    while left < right:
        while left < right and chars[left] not in vowels:
            left += 1
        while left < right and chars[right] not in vowels:
            right -= 1
        chars[left], chars[right] = chars[right], chars[left]
        left += 1
        right -= 1
    return ''.join(chars)
`),
        steps: [
          step(2, {
            vars: { left: 0, right: 6 },
            arrays: {
              chars: {
                values: ["l", "e", "e", "t", "c", "o", "d"],
                highlights: { "0": "L", "6": "R" },
              },
            },
            note: "Start at both ends.",
          }),
          step(4, {
            vars: { left: 1, right: 5 },
            arrays: {
              chars: {
                values: ["l", "e", "e", "t", "c", "o", "d"],
                highlights: { "1": "L", "5": "R" },
              },
            },
            note: "Vowels at L and R.",
          }),
          step(8, {
            vars: { left: 2, right: 4 },
            arrays: {
              chars: {
                values: ["l", "o", "e", "t", "c", "e", "d"],
                highlights: { "1": "swap", "5": "swap" },
              },
            },
            note: "Swap e ↔ o.",
          }),
        ],
      };

    case "linked_list":
      return {
        kind,
        title: "Linked list — reverse",
        code: codeLines(`
def reverse_list(head):
    prev = None
    cur = head
    while cur:
        nxt = cur.next
        cur.next = prev
        prev = cur
        cur = nxt
    return prev
`),
        steps: [
          step(1, {
            vars: { prev: "None", cur: "1" },
            arrays: {
              nodes: {
                values: [1, 2, 3, 4],
                highlights: { "0": "cur" },
              },
            },
            note: "Values shown left→right as the list order.",
          }),
          step(4, {
            vars: { prev: "1", cur: "2" },
            arrays: {
              nodes: {
                values: [1, 2, 3, 4],
                highlights: { "0": "prev", "1": "cur" },
              },
            },
            note: "Rewire 1 ← prev; advance.",
          }),
          step(4, {
            vars: { prev: "2", cur: "3" },
            arrays: {
              nodes: {
                values: [1, 2, 3, 4],
                highlights: { "1": "prev", "2": "cur" },
              },
            },
            note: "Continue reversing links.",
          }),
          step(6, {
            vars: { prev: "4", cur: "None" },
            arrays: {
              nodes: {
                values: [4, 3, 2, 1],
                highlights: { "0": "head" },
              },
            },
            note: "prev is new head: 4→3→2→1.",
          }),
        ],
      };

    case "tree":
      return {
        kind,
        title: "Tree — level order (BFS)",
        code: codeLines(`
from collections import deque
def level_order(root):
    if not root:
        return []
    q = deque([root])
    out = []
    while q:
        node = q.popleft()
        out.append(node.val)
        if node.left:
            q.append(node.left)
        if node.right:
            q.append(node.right)
    return out
`),
        steps: [
          step(3, {
            vars: { node: 1 },
            arrays: {
              q: { values: [1], highlights: { "0": "front" } },
              out: { values: [], highlights: {} },
              level: {
                values: [1, 2, 3, 4, 5],
                highlights: { "0": "root" },
              },
            },
            structure: {
              kind: "tree",
              rootId: "1",
              nodes: [
                { id: "1", label: "1", state: "frontier" },
                { id: "2", label: "2", state: "dimmed" },
                { id: "3", label: "3", state: "dimmed" },
                { id: "4", label: "4", state: "dimmed" },
                { id: "5", label: "5", state: "dimmed" },
              ],
              edges: [
                { from: "1", to: "2" },
                { from: "1", to: "3" },
                { from: "2", to: "4" },
                { from: "2", to: "5" },
              ],
              queue: ["1"],
              visitedOrder: [],
            },
            note: "Heap-style array: parent i → kids 2i+1, 2i+2.",
          }),
          step(6, {
            vars: { node: 1 },
            arrays: {
              q: { values: [2, 3], highlights: { "0": "front" } },
              out: { values: [1], highlights: { "0": "done" } },
              level: {
                values: [1, 2, 3, 4, 5],
                highlights: { "1": "L", "2": "R" },
              },
            },
            structure: {
              kind: "tree",
              rootId: "1",
              nodes: [
                { id: "1", label: "1", state: "visited" },
                { id: "2", label: "2", state: "frontier" },
                { id: "3", label: "3", state: "frontier" },
                { id: "4", label: "4", state: "dimmed" },
                { id: "5", label: "5", state: "dimmed" },
              ],
              edges: [
                { from: "1", to: "2" },
                { from: "1", to: "3" },
                { from: "2", to: "4" },
                { from: "2", to: "5" },
              ],
              queue: ["2", "3"],
              visitedOrder: ["1"],
            },
            note: "Visit 1; enqueue left=2, right=3.",
          }),
          step(6, {
            vars: { node: 2 },
            arrays: {
              q: { values: [3, 4, 5], highlights: { "0": "front" } },
              out: { values: [1, 2], highlights: { "1": "done" } },
              level: {
                values: [1, 2, 3, 4, 5],
                highlights: { "3": "L", "4": "R" },
              },
            },
            structure: {
              kind: "tree",
              rootId: "1",
              nodes: [
                { id: "1", label: "1", state: "visited" },
                { id: "2", label: "2", state: "active" },
                { id: "3", label: "3", state: "frontier" },
                { id: "4", label: "4", state: "frontier" },
                { id: "5", label: "5", state: "frontier" },
              ],
              edges: [
                { from: "1", to: "2" },
                { from: "1", to: "3" },
                { from: "2", to: "4" },
                { from: "2", to: "5" },
              ],
              queue: ["3", "4", "5"],
              visitedOrder: ["1", "2"],
            },
            note: "Visit 2; enqueue 4, 5.",
          }),
          step(6, {
            vars: { node: 3 },
            arrays: {
              q: { values: [4, 5], highlights: { "0": "front" } },
              out: { values: [1, 2, 3], highlights: {} },
              level: {
                values: [1, 2, 3, 4, 5],
                highlights: { "2": "cur" },
              },
            },
            structure: {
              kind: "tree",
              rootId: "1",
              nodes: [
                { id: "1", label: "1", state: "visited" },
                { id: "2", label: "2", state: "visited" },
                { id: "3", label: "3", state: "active" },
                { id: "4", label: "4", state: "frontier" },
                { id: "5", label: "5", state: "frontier" },
              ],
              edges: [
                { from: "1", to: "2" },
                { from: "1", to: "3" },
                { from: "2", to: "4" },
                { from: "2", to: "5" },
              ],
              queue: ["4", "5"],
              visitedOrder: ["1", "2", "3"],
            },
            note: "Level-order: 1, then 2,3, then 4,5.",
          }),
        ],
      };

    case "heap":
      return {
        kind,
        title: "Heap — top-k with min-heap",
        code: codeLines(`
import heapq
def top_k(nums, k):
    heap = []
    for x in nums:
        heapq.heappush(heap, x)
        if len(heap) > k:
            heapq.heappop(heap)
    return heap
`),
        steps: [
          step(2, {
            vars: { k: 2, x: 5 },
            arrays: {
              heap: { values: [5], highlights: { "0": "min" } },
              nums: {
                values: [5, 1, 9, 3],
                highlights: { "0": "x" },
              },
            },
            note: "Push 5. Size ≤ k.",
          }),
          step(2, {
            vars: { k: 2, x: 1 },
            arrays: {
              heap: { values: [1, 5], highlights: { "0": "min" } },
              nums: {
                values: [5, 1, 9, 3],
                highlights: { "1": "x" },
              },
            },
            note: "Push 1. Heap keeps smallest on top.",
          }),
          step(4, {
            vars: { k: 2, x: 9 },
            arrays: {
              heap: { values: [5, 9], highlights: { "0": "min" } },
              nums: {
                values: [5, 1, 9, 3],
                highlights: { "2": "x" },
              },
            },
            note: "Size > k → pop 1. Keep top-2: [5,9].",
          }),
          step(4, {
            vars: { k: 2, x: 3 },
            arrays: {
              heap: { values: [5, 9], highlights: { "0": "min" } },
              nums: {
                values: [5, 1, 9, 3],
                highlights: { "3": "x" },
              },
            },
            note: "Push 3, pop 3. Answer still [5,9].",
          }),
        ],
      };

    case "backtracking":
      return {
        kind,
        title: "Backtracking — subsets",
        code: codeLines(`
def subsets(nums):
    out, path = [], []
    def dfs(i):
        if i == len(nums):
            out.append(path[:])
            return
        path.append(nums[i]); dfs(i + 1); path.pop()
        dfs(i + 1)
    dfs(0)
    return out
`),
        steps: [
          step(5, {
            vars: { i: 0 },
            arrays: {
              path: { values: [1], highlights: { "0": "pick" } },
              nums: {
                values: [1, 2],
                highlights: { "0": "i" },
              },
            },
            note: "Choose 1, recurse.",
          }),
          step(5, {
            vars: { i: 1 },
            arrays: {
              path: { values: [1, 2], highlights: { "1": "pick" } },
              nums: {
                values: [1, 2],
                highlights: { "1": "i" },
              },
            },
            note: "Choose 2 → leaf [1,2].",
          }),
          step(5, {
            vars: { i: 1 },
            arrays: {
              path: { values: [1], highlights: { "0": "keep" } },
              nums: {
                values: [1, 2],
                highlights: { "1": "i" },
              },
            },
            note: "Backtrack: pop 2, skip 2 → [1].",
          }),
          step(6, {
            vars: { i: 0 },
            arrays: {
              path: { values: [], highlights: {} },
              nums: {
                values: [1, 2],
                highlights: { "0": "skip" },
              },
            },
            note: "Skip 1 entirely; explore paths without it.",
          }),
        ],
      };

    case "trie":
      return {
        kind,
        title: "Trie — insert + search",
        code: codeLines(`
class Trie:
    def __init__(self):
        self.child = {}
        self.end = False
    def insert(self, word):
        node = self
        for ch in word:
            node = node.child.setdefault(ch, Trie())
        node.end = True
    def search(self, word):
        node = self
        for ch in word:
            if ch not in node.child: return False
            node = node.child[ch]
        return node.end
`),
        steps: [
          step(5, {
            vars: { ch: "c", word: "cat" },
            arrays: {
              path: { values: ["c"], highlights: { "0": "node" } },
            },
            note: "Insert 'c' edge from root.",
          }),
          step(5, {
            vars: { ch: "a", word: "cat" },
            arrays: {
              path: {
                values: ["c", "a"],
                highlights: { "1": "node" },
              },
            },
            note: "Then 'a', then 't'. Mark end.",
          }),
          step(6, {
            vars: { word: "cat", end: true },
            arrays: {
              path: {
                values: ["c", "a", "t"],
                highlights: { "2": "end" },
              },
            },
            note: "Word ends at t (end=True).",
          }),
          step(11, {
            vars: { word: "car", found: false },
            arrays: {
              path: {
                values: ["c", "a"],
                highlights: { "1": "miss" },
              },
            },
            note: "Search 'car': no 'r' child → False.",
          }),
        ],
      };

    case "other":
    default:
      return getLocalVizTemplate("two_pointers");
  }
}

export function listVizTemplates(): Array<{
  kind: VizKind;
  label: string;
  title: string;
}> {
  return VIZ_KINDS.filter((kind) => kind !== "other").map((kind) => {
    const plan = getLocalVizTemplate(kind);
    return {
      kind,
      label: VIZ_KIND_LABELS[kind],
      title: plan.title || VIZ_KIND_LABELS[kind],
    };
  });
}

/** Prefer buffer heuristic, else two_pointers. Always free (canned only). */
export function planFromBufferOrTemplate(
  buffer: string,
  kind?: VizKind,
): VizPlan {
  const chosen = kind ?? detectVizKind(buffer);
  return getLocalVizTemplate(chosen);
}
