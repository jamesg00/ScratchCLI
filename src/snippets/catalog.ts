export type Snippet = {
  id: string;
  label: string;
  language: "python";
  body: string;
  tags: string[];
};

export const SNIPPETS: Snippet[] = [
  {
    id: "two_sum",
    label: "Two sum (hash map)",
    language: "python",
    tags: ["hash_map", "array"],
    body: `def two_sum(nums: list[int], target: int) -> list[int]:
    seen: dict[int, int] = {}
    for i, x in enumerate(nums):
        need = target - x
        if need in seen:
            return [seen[need], i]
        seen[x] = i
    return []
$0
`,
  },
  {
    id: "sliding_window",
    label: "Sliding window (fixed k)",
    language: "python",
    tags: ["sliding_window", "array"],
    body: `def max_sum(nums: list[int], k: int) -> int:
    window = sum(nums[:k])
    best = window
    for right in range(k, len(nums)):
        window += nums[right] - nums[right - k]
        best = max(best, window)
    return best
$0
`,
  },
  {
    id: "binary_search",
    label: "Binary search",
    language: "python",
    tags: ["binary_search"],
    body: `def binary_search(nums: list[int], target: int) -> int:
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
$0
`,
  },
  {
    id: "stack_parens",
    label: "Valid parentheses",
    language: "python",
    tags: ["stack", "string"],
    body: `def is_valid(s: str) -> bool:
    stack: list[str] = []
    pairs = {")": "(", "]": "[", "}": "{"}
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        elif not stack or stack.pop() != pairs[ch]:
            return False
    return not stack
$0
`,
  },
  {
    id: "bfs",
    label: "Graph BFS",
    language: "python",
    tags: ["graph_bfs"],
    body: `from collections import deque

def bfs(graph: dict, start):
    seen = {start}
    q = deque([start])
    order = []
    while q:
        node = q.popleft()
        order.append(node)
        for nxt in graph.get(node, []):
            if nxt not in seen:
                seen.add(nxt)
                q.append(nxt)
    return order
$0
`,
  },
  {
    id: "dfs",
    label: "Graph DFS",
    language: "python",
    tags: ["graph_dfs"],
    body: `def dfs(graph: dict, node, seen=None):
    if seen is None:
        seen = set()
    seen.add(node)
    for nxt in graph.get(node, []):
        if nxt not in seen:
            dfs(graph, nxt, seen)
    return seen
$0
`,
  },
  {
    id: "linked_list_reverse",
    label: "Reverse linked list",
    language: "python",
    tags: ["linked_list"],
    body: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def reverse_list(head: ListNode | None) -> ListNode | None:
    prev = None
    cur = head
    while cur:
        nxt = cur.next
        cur.next = prev
        prev = cur
        cur = nxt
    return prev
$0
`,
  },
  {
    id: "tree_level_order",
    label: "Tree level order",
    language: "python",
    tags: ["tree"],
    body: `from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def level_order(root: TreeNode | None) -> list[int]:
    if not root:
        return []
    q = deque([root])
    out: list[int] = []
    while q:
        node = q.popleft()
        out.append(node.val)
        if node.left:
            q.append(node.left)
        if node.right:
            q.append(node.right)
    return out
$0
`,
  },
  {
    id: "climb_stairs_dp",
    label: "Climb stairs DP",
    language: "python",
    tags: ["dp"],
    body: `def climb(n: int) -> int:
    if n <= 2:
        return n
    dp = [0] * (n + 1)
    dp[1], dp[2] = 1, 2
    for i in range(3, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]
$0
`,
  },
  {
    id: "union_find",
    label: "Union-find stub",
    language: "python",
    tags: ["graph_dfs", "array"],
    body: `class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, a: int, b: int) -> bool:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1
        return True
$0
`,
  },
  {
    id: "math_pi",
    label: "Insert math.pi",
    language: "python",
    tags: ["math"],
    body: `import math

r = 1.0
area = math.pi * r * r
$0
`,
  },
];

export function getSnippet(id: string): Snippet | undefined {
  return SNIPPETS.find((item) => item.id === id);
}

export function listSnippets(): Snippet[] {
  return SNIPPETS;
}
