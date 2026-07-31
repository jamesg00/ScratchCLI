import type {
  Lesson,
  LessonCopyBlock,
  LessonExercise,
  LessonTopic,
} from "./lessons";

function p(text: string): LessonCopyBlock {
  return { kind: "paragraph", text };
}

function bullets(items: string[], title?: string): LessonCopyBlock {
  return { kind: "bullets", title, items };
}

function callout(
  tone: "signal" | "pitfall" | "strategy",
  title: string,
  text: string,
): LessonCopyBlock {
  return { kind: "callout", tone, title, text };
}

export const EXTRA_LESSON_TOPICS: LessonTopic[] = [
  {
    id: "heaps",
    title: "Heaps / Priority queue",
    description:
      "Keep a dynamic top-k, median, or next-best event without full sorts.",
    lessonIds: ["lesson-heaps"],
  },
  {
    id: "recursion_basics",
    title: "Recursion fundamentals",
    description:
      "Define base cases, recurse on a smaller state, and trust the call stack.",
    lessonIds: ["lesson-recursion"],
  },
  {
    id: "backtracking",
    title: "Backtracking",
    description:
      "Build candidates, prune dead ends, and undo choices to explore the space.",
    lessonIds: ["lesson-backtracking"],
  },
  {
    id: "dynamic_programming",
    title: "Dynamic programming",
    description:
      "Turn overlapping subproblems into table fills with clear state transitions.",
    lessonIds: ["lesson-dp-basics", "lesson-dp-advanced"],
  },
  {
    id: "graphs_deep",
    title: "Graphs (BFS / DFS / advanced)",
    description:
      "Traverse adjacency lists, track visited state, then layer on shortest path ideas.",
    lessonIds: ["lesson-graphs", "lesson-graphs-advanced"],
  },
  {
    id: "tries",
    title: "Tries (prefix trees)",
    description:
      "Share prefixes for insert/search/autocomplete in dictionary-style problems.",
    lessonIds: ["lesson-tries"],
  },
];

/** Extra sliding-window lesson attached under the existing topic. */
export const EXTRA_SLIDING_LESSON_ID = "lesson-sliding-window-advanced";

export const EXTRA_LESSONS: Lesson[] = [
  {
    id: EXTRA_SLIDING_LESSON_ID,
    topicId: "strings_sliding_window",
    title: "Sliding window — variable + at-most-k",
    blurb:
      "Grow/shrink windows with frequency maps for longest/shortest valid substrings.",
    estimatedMinutes: 18,
    learningGoals: [
      "Recognize variable-size windows with a validity constraint",
      "Use a counter / set size to know when to shrink",
      "Track the best answer while the window stays valid",
    ],
    patternSignals: [
      "Longest substring with at most K distinct chars",
      "Minimum window covering required counts",
      "Contiguous subarray where a running property must stay true",
    ],
    commonMistakes: [
      "Shrinking too late after the window is already invalid",
      "Forgetting to decrement / delete keys when counts hit 0",
      "Updating the answer on invalid windows",
    ],
    complexityChecklist: [
      "Usually O(n) time with two pointers",
      "O(Σ) or O(k) extra space for the char map",
    ],
    steps: [
      {
        id: "sw2-concept",
        type: "concept",
        title: "Variable window invariant",
        blocks: [
          p(
            "Keep a right pointer expanding, and a left pointer that only moves forward to restore validity.",
          ),
          bullets([
            "Expand right → include s[right]",
            "While invalid → drop s[left] and left++",
            "While valid → record best length / window",
          ]),
          callout(
            "strategy",
            "Template",
            "Maintain counts in a map. The window [left, right] should always represent the best candidate ending at right after shrink.",
          ),
        ],
      },
      {
        id: "sw2-viz",
        type: "viz",
        title: "See the window move",
        vizKind: "sliding_window",
        content:
          "Watch left/right and the validity condition advance together.",
      },
      {
        id: "sw2-example",
        type: "worked_example",
        title: "At most 2 distinct",
        blocks: [
          p(
            'On "eceba" with k=2: expand to "ece", shrink when "b" adds a 3rd distinct, then continue.',
          ),
          bullets([
            "Answer candidates: ece (3), then ce (2), then ba (2)",
            "Best length stays 3",
          ]),
        ],
      },
      {
        id: "sw2-check",
        type: "checkpoint",
        title: "When do you shrink?",
        prompt:
          "For longest substring with ≤ k distinct chars, when should left move?",
        hint: "Think about map size after inserting s[right].",
        answer: "While the number of positive-count keys exceeds k.",
        takeaway:
          "Shrink is driven by the invariant, not by a fixed window size.",
      },
      {
        id: "sw2-pitfall",
        type: "pitfall",
        title: "Zero-count keys",
        blocks: [
          callout(
            "pitfall",
            "Stale keys",
            "If you leave count[c]=0 in the map, 'distinct' looks larger than it is. Delete or ignore zeros.",
          ),
        ],
      },
      {
        id: "sw2-ex",
        type: "exercise",
        title: "Practice: longest with ≤ k distinct",
        exerciseId: "ex-sliding-window-2",
        intro:
          "Implement the variable window for at most k distinct characters.",
        successCriteria: [
          "Two pointers only move forward",
          "Map tracks live character counts",
          "Local tests print PASS",
        ],
      },
      {
        id: "sw2-recap",
        type: "recap",
        title: "Recap",
        blocks: [
          bullets([
            "Expand → maybe shrink → record",
            "Validity is a property of the current window",
            "Same skeleton covers many 'longest/shortest contiguous' prompts",
          ]),
        ],
      },
    ],
  },
  {
    id: "lesson-heaps",
    topicId: "heaps",
    title: "Heaps — keep only what matters",
    blurb:
      "Use a min-heap or max-heap when you repeatedly need the current extreme.",
    estimatedMinutes: 16,
    learningGoals: [
      "Know when a heap beats sorting each time",
      "Maintain top-k with a size-bounded heap",
      "Read push/pop complexity for interviews",
    ],
    patternSignals: [
      "Kth largest / top K frequent",
      "Merge K sorted lists",
      "Running median / next meeting to process",
    ],
    commonMistakes: [
      "Using the wrong heap polarity (min vs max)",
      "Forgetting to pop when size exceeds k",
      "Sorting the whole array when only k extremes matter",
    ],
    complexityChecklist: [
      "Push/pop: O(log n)",
      "Top-k over n items: O(n log k)",
    ],
    steps: [
      {
        id: "heap-concept",
        type: "concept",
        title: "Priority queue idea",
        blocks: [
          p(
            "A heap stores elements so the smallest (or largest) is always available in O(1) peek / O(log n) pop.",
          ),
          bullets([
            "Min-heap: parent ≤ children",
            "Max-heap: parent ≥ children (or negate into a min-heap)",
            "Python: heapq is a min-heap",
          ]),
        ],
      },
      {
        id: "heap-viz",
        type: "viz",
        title: "Top-k heap walk",
        vizKind: "heap",
        content: "Push values and evict the smallest when size > k.",
      },
      {
        id: "heap-strategy",
        type: "strategy",
        title: "Size-k pattern",
        blocks: [
          callout(
            "strategy",
            "Top-k largest",
            "Keep a min-heap of size k. The root is the smallest of the large ones — i.e. the kth largest threshold.",
          ),
          bullets([
            "Push each number",
            "If len > k, pop",
            "Heap contents are the answer set",
          ]),
        ],
      },
      {
        id: "heap-check",
        type: "checkpoint",
        title: "Why min-heap for kth largest?",
        prompt:
          "To find the kth largest with a heap of size k, do you use min-heap or max-heap?",
        hint: "You want to eject the weakest of the keepers.",
        answer:
          "Min-heap of size k: pop removes the smallest among the current top-k candidates.",
        takeaway: "Polarity follows what you need to discard.",
      },
      {
        id: "heap-ex",
        type: "exercise",
        title: "Practice: kth largest",
        exerciseId: "ex-heap-1",
        intro: "Return the kth largest element using a bounded heap.",
        successCriteria: [
          "Uses heap operations",
          "Does not fully sort unless needed",
          "Tests pass",
        ],
      },
      {
        id: "heap-recap",
        type: "recap",
        title: "Recap",
        blocks: [
          bullets([
            "Heap = repeated 'next best'",
            "Bound size for top-k",
            "State polarity carefully",
          ]),
        ],
      },
    ],
  },
  {
    id: "lesson-recursion",
    topicId: "recursion_basics",
    title: "Recursion — smaller problem, same rule",
    blurb:
      "Write the relation, nail the base case, then let the stack finish the work.",
    estimatedMinutes: 14,
    learningGoals: [
      "Separate base case from recursive case",
      "Identify the shrinking measure that guarantees termination",
      "Trace a short call stack on paper",
    ],
    patternSignals: [
      "Tree/list defined in terms of smaller copies",
      "Divide and conquer",
      "'Assume f(n-1) works' reasoning",
    ],
    commonMistakes: [
      "Missing or wrong base case",
      "Not shrinking the argument → infinite recursion",
      "Doing work twice instead of combining sub-results",
    ],
    complexityChecklist: [
      "Time often ≈ number of calls",
      "Space includes call-stack depth",
    ],
    steps: [
      {
        id: "rec-concept",
        type: "concept",
        title: "The recursion contract",
        blocks: [
          p(
            "A recursive function solves a problem by calling itself on a strictly smaller instance, then combining.",
          ),
          bullets([
            "Base: smallest inputs return immediately",
            "Progress: each call reduces size / distance to base",
            "Combine: use returned values (or mutate with care)",
          ]),
        ],
      },
      {
        id: "rec-viz",
        type: "viz",
        title: "Factorial unwind",
        vizKind: "recursion",
        content:
          "Follow calls down to the base case, then multiply on the way back.",
      },
      {
        id: "rec-check",
        type: "checkpoint",
        title: "Termination",
        prompt: "What two things must every correct recursive solution have?",
        hint: "One stops; one moves toward stop.",
        answer:
          "A reachable base case, and a recursive step that moves toward that base case.",
        takeaway: "No progress measure ⇒ stack overflow.",
      },
      {
        id: "rec-ex",
        type: "exercise",
        title: "Practice: reverse a list recursively",
        exerciseId: "ex-recursion-1",
        intro: "Reverse a Python list using recursion (no loops).",
        successCriteria: [
          "Base case for empty/singleton",
          "Recursive combine is correct",
        ],
      },
      {
        id: "rec-recap",
        type: "recap",
        title: "Recap",
        blocks: [
          bullets([
            "Base + progress + combine",
            "Trace small n first",
            "Watch stack depth",
          ]),
        ],
      },
    ],
  },
  {
    id: "lesson-backtracking",
    topicId: "backtracking",
    title: "Backtracking — choose, explore, undo",
    blurb:
      "DFS over decisions with prune + undo for subsets, permutations, and constraint search.",
    estimatedMinutes: 18,
    learningGoals: [
      "Model the decision tree",
      "Push/pop path state correctly",
      "Prune before diving into impossible branches",
    ],
    patternSignals: [
      "Generate all subsets / permutations / combinations",
      "N-Queens / sudoku / word search",
      "'Try this choice, then revert'",
    ],
    commonMistakes: [
      "Forgetting to pop after recurse",
      "Appending the same path list reference (need path[:])",
      "Exploring after a prune condition already failed",
    ],
    complexityChecklist: [
      "Often exponential in n",
      "Pruning is the interview differentiator",
    ],
    steps: [
      {
        id: "bt-concept",
        type: "concept",
        title: "Template",
        blocks: [
          bullets([
            "If done → record path copy",
            "For each choice: append → dfs → pop",
            "Skip choices that break constraints",
          ]),
          callout(
            "signal",
            "Smell",
            "If the prompt says 'all possible' under constraints, start from a backtracking skeleton.",
          ),
        ],
      },
      {
        id: "bt-viz",
        type: "viz",
        title: "Subsets tree",
        vizKind: "backtracking",
        content: "Include vs skip each element, undoing path changes.",
      },
      {
        id: "bt-check",
        type: "checkpoint",
        title: "Why path[:]?",
        prompt:
          "Why append path[:] (a copy) to the answer list instead of path?",
        hint: "Lists are mutable references.",
        answer:
          "Because later backtracking mutates path; without a copy, previous answers change.",
        takeaway: "Snapshot results at leaves.",
      },
      {
        id: "bt-ex",
        type: "exercise",
        title: "Practice: subsets",
        exerciseId: "ex-backtracking-1",
        intro: "Generate all subsets of a distinct integer array.",
        successCriteria: [
          "Uses choose/skip or index DFS",
          "Returns all 2^n subsets",
        ],
      },
      {
        id: "bt-recap",
        type: "recap",
        title: "Recap",
        blocks: [
          bullets([
            "Choose → explore → undo",
            "Copy at success",
            "Prune early",
          ]),
        ],
      },
    ],
  },
  {
    id: "lesson-dp-basics",
    topicId: "dynamic_programming",
    title: "DP basics — overlapping subproblems",
    blurb:
      "Define dp[state], the transition, and the base cases before coding loops.",
    estimatedMinutes: 18,
    learningGoals: [
      "Spot overlapping subproblems + optimal substructure",
      "Write a 1D transition like climb stairs / house robber",
      "Choose bottom-up vs top-down memo",
    ],
    patternSignals: [
      "Count ways / min cost to reach n",
      "Answers reuse answers for i-1, i-2, …",
      "Recursion with memo works but TLE without cache",
    ],
    commonMistakes: [
      "Unclear state meaning",
      "Wrong base indices",
      "Looping in an order that reads uncomputed cells",
    ],
    complexityChecklist: [
      "Time ≈ number of states × transition work",
      "Space can often compress to O(1) / O(k)",
    ],
    steps: [
      {
        id: "dp1-concept",
        type: "concept",
        title: "State first",
        blocks: [
          p(
            "DP is recursion with memory. Name the state so the transition is obvious.",
          ),
          bullets([
            "dp[i] = answer for prefix/size i",
            "Transition: how dp[i] uses earlier cells",
            "Base: smallest i you can answer immediately",
          ]),
        ],
      },
      {
        id: "dp1-viz",
        type: "viz",
        title: "Climb stairs table",
        vizKind: "dp",
        content: "Fill dp[i] from two previous ways counts.",
      },
      {
        id: "dp1-check",
        type: "checkpoint",
        title: "Climb stairs transition",
        prompt:
          "If dp[i] = ways to climb i steps taking 1 or 2, what is the transition?",
        hint: "Last jump was 1 or 2.",
        answer: "dp[i] = dp[i-1] + dp[i-2]",
        takeaway: "Transitions encode the last decision.",
      },
      {
        id: "dp1-ex",
        type: "exercise",
        title: "Practice: climb stairs",
        exerciseId: "ex-dp-1",
        intro:
          "Return number of distinct ways to climb n stairs (1 or 2 at a time).",
        successCriteria: ["Bottom-up or memoized", "Correct for n=1..10 tests"],
      },
      {
        id: "dp1-recap",
        type: "recap",
        title: "Recap",
        blocks: [
          bullets([
            "State → transition → base → loop order",
            "Start with the recurrence on paper",
          ]),
        ],
      },
    ],
  },
  {
    id: "lesson-dp-advanced",
    topicId: "dynamic_programming",
    title: "Advanced DP — 2D & knapsack family",
    blurb:
      "Grid paths, LCS-style tables, and 0/1 knapsack share the same fill discipline.",
    estimatedMinutes: 20,
    learningGoals: [
      "Set up 2D dp[i][j] meanings",
      "Recognize knapsack / subset-sum style decisions",
      "Avoid reading cells before they are ready",
    ],
    patternSignals: [
      "Grid unique paths / min path sum",
      "Longest common subsequence",
      "Subset sum / partition equal subset",
    ],
    commonMistakes: [
      "Off-by-one on string/grid borders",
      "Reusing a cell in 0/1 knapsack with the wrong loop direction",
      "Mixing 'count ways' with 'boolean reachable'",
    ],
    complexityChecklist: ["Grid n×m: O(nm)", "Knapsack n×W: O(nW)"],
    steps: [
      {
        id: "dp2-concept",
        type: "concept",
        title: "Two axes",
        blocks: [
          p(
            "When two sequences or a grid are involved, index both dimensions and decide what dp[i][j] means.",
          ),
          callout(
            "strategy",
            "Knapsack decision",
            "For each item: skip it (dp[i-1][w]) or take it if w≥wt (val + dp[i-1][w-wt]).",
          ),
        ],
      },
      {
        id: "dp2-viz",
        type: "viz",
        title: "Reuse the DP player",
        vizKind: "dp",
        content: "Same fill mindset — just more dimensions in your head.",
      },
      {
        id: "dp2-check",
        type: "checkpoint",
        title: "0/1 vs unbounded",
        prompt:
          "In 1D knapsack, why does loop direction differ for 0/1 vs unbounded?",
        hint: "Can the same item be reused in one pass?",
        answer:
          "0/1 loops weights downward so each item is used once; unbounded loops upward to allow reuse.",
        takeaway: "Loop direction encodes reuse policy.",
      },
      {
        id: "dp2-ex",
        type: "exercise",
        title: "Practice: subset sum",
        exerciseId: "ex-dp-2",
        intro:
          "Return whether any subset sums to target (0/1 knapsack boolean).",
        successCriteria: [
          "Boolean DP or recursion+memo",
          "Handles empty/zero cases",
        ],
      },
      {
        id: "dp2-recap",
        type: "recap",
        title: "Recap",
        blocks: [
          bullets([
            "Name dp[i][j]",
            "Fill borders first",
            "Match loop direction to reuse rules",
          ]),
        ],
      },
    ],
  },
  {
    id: "lesson-graphs",
    topicId: "graphs_deep",
    title: "Graphs — BFS & DFS on adjacency lists",
    blurb:
      "Model nodes/edges, track visited, and pick BFS for layers or DFS for path exploration.",
    estimatedMinutes: 18,
    learningGoals: [
      "Build / read an adjacency list",
      "Implement BFS with a queue and visited set",
      "Implement DFS iteratively or recursively",
    ],
    patternSignals: [
      "Number of islands / connected components",
      "Shortest path in unweighted graph",
      "Clone graph / course schedule prerequisites",
    ],
    commonMistakes: [
      "Forgetting to mark visited before enqueue",
      "Treating undirected edges as one-way",
      "Using DFS when shortest hop count is required",
    ],
    complexityChecklist: ["Time O(V+E)", "Space O(V) for visited / queue"],
    steps: [
      {
        id: "g1-concept",
        type: "concept",
        title: "BFS vs DFS",
        blocks: [
          bullets([
            "BFS: queue + layers → shortest hops in unweighted graphs",
            "DFS: stack/recursion → path existence, components, topology ideas",
            "Always record visited to avoid cycles",
          ]),
        ],
      },
      {
        id: "g1-viz-bfs",
        type: "viz",
        title: "BFS layers",
        vizKind: "graph_bfs",
        content: "Watch the frontier expand level by level.",
      },
      {
        id: "g1-viz-dfs",
        type: "viz",
        title: "DFS dive",
        vizKind: "graph_dfs",
        content: "Follow one branch deeply, then backtrack.",
      },
      {
        id: "g1-check",
        type: "checkpoint",
        title: "Shortest path tool",
        prompt: "Unweighted graph, need fewest edges from s to t — BFS or DFS?",
        hint: "Layers equal distance.",
        answer: "BFS.",
        takeaway: "DFS does not guarantee shortest hop distance.",
      },
      {
        id: "g1-ex",
        type: "exercise",
        title: "Practice: connected components",
        exerciseId: "ex-graph-1",
        intro: "Count connected components in an undirected adjacency list.",
        successCriteria: ["Visited set used", "Counts each component once"],
      },
      {
        id: "g1-recap",
        type: "recap",
        title: "Recap",
        blocks: [
          bullets([
            "Adj list + visited",
            "BFS for layers",
            "DFS for exploration",
          ]),
        ],
      },
    ],
  },
  {
    id: "lesson-graphs-advanced",
    topicId: "graphs_deep",
    title: "Advanced graphs — topo sort & multi-source",
    blurb:
      "Layer Kahn's algorithm, cycle detection, and multi-source BFS on top of basics.",
    estimatedMinutes: 20,
    learningGoals: [
      "Detect cycles / order tasks with topological sort",
      "Start BFS from multiple sources",
      "Translate grid problems into implicit graphs",
    ],
    patternSignals: [
      "Course schedule / build order",
      "Rotting oranges / walls and gates",
      "Word ladder (implicit graph)",
    ],
    commonMistakes: [
      "Topo sort without indegree updates",
      "Single-source BFS when all sources should start at dist 0",
      "Not handling disconnected DAGs",
    ],
    complexityChecklist: [
      "Topo: O(V+E)",
      "Multi-source BFS: O(cells) on grids",
    ],
    steps: [
      {
        id: "g2-concept",
        type: "concept",
        title: "Kahn's idea",
        blocks: [
          p(
            "Track indegrees. Repeatedly take nodes with indegree 0 and reduce neighbors — if you process all nodes, the graph was a DAG.",
          ),
          callout(
            "strategy",
            "Multi-source",
            "Push every starting cell into the queue first with distance 0, then BFS as usual.",
          ),
        ],
      },
      {
        id: "g2-viz",
        type: "viz",
        title: "BFS mindset still applies",
        vizKind: "graph_bfs",
        content: "Same queue mechanics; richer initialization.",
      },
      {
        id: "g2-check",
        type: "checkpoint",
        title: "Cycle signal",
        prompt: "In Kahn topo sort, how do you know a cycle exists?",
        hint: "Compare processed count to V.",
        answer:
          "If fewer than V nodes are processed, remaining nodes are in a cycle.",
        takeaway: "Topo success ≡ DAG.",
      },
      {
        id: "g2-ex",
        type: "exercise",
        title: "Practice: can finish courses",
        exerciseId: "ex-graph-2",
        intro:
          "Given prereq edges, return whether all courses can be finished (cycle detect).",
        successCriteria: [
          "Topo or DFS color mark",
          "True on DAG, False on cycle",
        ],
      },
      {
        id: "g2-recap",
        type: "recap",
        title: "Recap",
        blocks: [
          bullets([
            "Indegree queue for topo",
            "Multi-source for 'nearest' on grids",
            "Cycle ⇒ cannot order",
          ]),
        ],
      },
    ],
  },
  {
    id: "lesson-tries",
    topicId: "tries",
    title: "Tries — shared prefixes",
    blurb:
      "Store words in a character tree for insert, search, and prefix queries.",
    estimatedMinutes: 16,
    learningGoals: [
      "Implement insert / search / startsWith",
      "Know when a trie beats a hash set of words",
      "Mark end-of-word distinctly from prefix existence",
    ],
    patternSignals: [
      "Autocomplete / prefix scoring",
      "Word search II",
      "Replace words with shortest root dictionary",
    ],
    commonMistakes: [
      "Forgetting the end flag",
      "Treating prefix match as full-word match",
      "Not sharing nodes for common prefixes",
    ],
    complexityChecklist: [
      "Insert/search O(L) in word length",
      "Space depends on shared prefixes",
    ],
    steps: [
      {
        id: "trie-concept",
        type: "concept",
        title: "Node = map of children + end",
        blocks: [
          p(
            "Each edge is a character. A boolean (or count) marks that a word ends at this node.",
          ),
          bullets([
            "insert: walk/create children, set end",
            "search: walk; true only if end",
            "startsWith: walk; true if path exists",
          ]),
        ],
      },
      {
        id: "trie-viz",
        type: "viz",
        title: "Insert cat, miss car",
        vizKind: "trie",
        content: "Follow character edges and the end marker.",
      },
      {
        id: "trie-check",
        type: "checkpoint",
        title: "Prefix vs word",
        prompt:
          "After inserting only 'cat', what should search('ca') and startsWith('ca') return?",
        hint: "End flag matters.",
        answer: "search False, startsWith True.",
        takeaway: "Prefix existence ≠ word existence.",
      },
      {
        id: "trie-ex",
        type: "exercise",
        title: "Practice: trie class",
        exerciseId: "ex-trie-1",
        intro: "Implement insert, search, and startsWith.",
        successCriteria: ["All three APIs correct on sample ops"],
      },
      {
        id: "trie-recap",
        type: "recap",
        title: "Recap",
        blocks: [
          bullets([
            "Children map + end flag",
            "O(L) ops",
            "Great for shared prefixes",
          ]),
        ],
      },
    ],
  },
];

function practiceShell(
  fileName: string,
  header: string,
  body: string,
): LessonExercise["practiceFile"] {
  return {
    fileName,
    content: `${header}

${body}
`,
  };
}

export const EXTRA_LESSON_EXERCISES: LessonExercise[] = [
  {
    id: "ex-sliding-window-2",
    title: "Longest substring with ≤ k distinct",
    description: "Variable sliding window with a frequency map.",
    vizKind: "sliding_window",
    practiceFile: practiceShell(
      "longest_k_distinct_practice.py",
      `# FILE: longest_k_distinct_practice.py
# Lesson exercise: variable sliding window`,
      `from collections import defaultdict

def longest_k_distinct(s: str, k: int) -> int:
    # TODO: expand right, shrink while distinct > k, track best length.
    pass

if __name__ == "__main__":
    tests = [
        ("eceba", 2, 3),
        ("aa", 1, 2),
        ("", 2, 0),
    ]
    passed = 0
    for s, k, expected in tests:
        try:
            ok = longest_k_distinct(s, k) == expected
        except Exception:
            ok = False
        print(("PASS" if ok else "FAIL") + f": {s!r} k={k}")
        passed += int(ok)
    print(f"{passed} / {len(tests)}")`,
    ),
  },
  {
    id: "ex-heap-1",
    title: "Kth largest element",
    description: "Bounded min-heap.",
    vizKind: "heap",
    practiceFile: practiceShell(
      "kth_largest_practice.py",
      `# FILE: kth_largest_practice.py
# Lesson exercise: heaps`,
      `import heapq
from typing import List

def find_kth_largest(nums: List[int], k: int) -> int:
    # TODO: size-k min-heap; return heap[0]
    pass

if __name__ == "__main__":
    tests = [
        ([3, 2, 1, 5, 6, 4], 2, 5),
        ([3, 2, 3, 1, 2, 4, 5, 5, 6], 4, 4),
    ]
    passed = 0
    for nums, k, expected in tests:
        try:
            ok = find_kth_largest(nums, k) == expected
        except Exception:
            ok = False
        print(("PASS" if ok else "FAIL") + f": k={k}")
        passed += int(ok)
    print(f"{passed} / {len(tests)}")`,
    ),
  },
  {
    id: "ex-recursion-1",
    title: "Recursive reverse",
    description: "Reverse a list with recursion.",
    vizKind: "recursion",
    practiceFile: practiceShell(
      "recursive_reverse_practice.py",
      `# FILE: recursive_reverse_practice.py
# Lesson exercise: recursion`,
      `from typing import List

def reverse_list(xs: List[int]) -> List[int]:
    # TODO: base case + reverse(rest) + first at end
    pass

if __name__ == "__main__":
    tests = [([], []), ([1], [1]), ([1, 2, 3], [3, 2, 1])]
    passed = 0
    for xs, expected in tests:
        try:
            ok = reverse_list(list(xs)) == expected
        except Exception:
            ok = False
        print(("PASS" if ok else "FAIL") + f": {xs}")
        passed += int(ok)
    print(f"{passed} / {len(tests)}")`,
    ),
  },
  {
    id: "ex-backtracking-1",
    title: "Subsets",
    description: "Generate all subsets.",
    vizKind: "backtracking",
    practiceFile: practiceShell(
      "subsets_practice.py",
      `# FILE: subsets_practice.py
# Lesson exercise: backtracking`,
      `from typing import List

def subsets(nums: List[int]) -> List[List[int]]:
    # TODO: dfs choose/skip; append path[:]
    pass

if __name__ == "__main__":
    got = subsets([1, 2])
    normalized = sorted(tuple(sorted(x)) for x in (got or []))
    expected = sorted([(), (1,), (2,), (1, 2)])
    ok = normalized == expected
    print(("PASS" if ok else "FAIL") + ": subsets([1,2])")
    print("1 / 1" if ok else "0 / 1")`,
    ),
  },
  {
    id: "ex-dp-1",
    title: "Climb stairs",
    description: "Classic 1D DP.",
    vizKind: "dp",
    practiceFile: practiceShell(
      "climb_stairs_practice.py",
      `# FILE: climb_stairs_practice.py
# Lesson exercise: DP basics`,
      `def climb_stairs(n: int) -> int:
    # TODO: dp[i] = dp[i-1] + dp[i-2]
    pass

if __name__ == "__main__":
    tests = [(1, 1), (2, 2), (3, 3), (5, 8)]
    passed = 0
    for n, expected in tests:
        try:
            ok = climb_stairs(n) == expected
        except Exception:
            ok = False
        print(("PASS" if ok else "FAIL") + f": n={n}")
        passed += int(ok)
    print(f"{passed} / {len(tests)}")`,
    ),
  },
  {
    id: "ex-dp-2",
    title: "Subset sum",
    description: "Boolean knapsack.",
    vizKind: "dp",
    practiceFile: practiceShell(
      "subset_sum_practice.py",
      `# FILE: subset_sum_practice.py
# Lesson exercise: advanced DP`,
      `from typing import List

def can_sum(nums: List[int], target: int) -> bool:
    # TODO: boolean DP reachable sums
    pass

if __name__ == "__main__":
    tests = [
        ([1, 2, 3], 5, True),
        ([1, 2, 3], 7, False),
        ([], 0, True),
    ]
    passed = 0
    for nums, target, expected in tests:
        try:
            ok = can_sum(nums, target) is expected
        except Exception:
            ok = False
        print(("PASS" if ok else "FAIL") + f": {nums} -> {target}")
        passed += int(ok)
    print(f"{passed} / {len(tests)}")`,
    ),
  },
  {
    id: "ex-graph-1",
    title: "Connected components",
    description: "Count components via DFS/BFS.",
    vizKind: "graph_bfs",
    practiceFile: practiceShell(
      "components_practice.py",
      `# FILE: components_practice.py
# Lesson exercise: graphs`,
      `from typing import Dict, List

def count_components(n: int, edges: List[List[int]]) -> int:
    # TODO: build adj, DFS/BFS unmarked nodes
    pass

if __name__ == "__main__":
    tests = [
        (5, [[0, 1], [1, 2], [3, 4]], 2),
        (3, [[0, 1], [0, 2], [1, 2]], 1),
    ]
    passed = 0
    for n, edges, expected in tests:
        try:
            ok = count_components(n, edges) == expected
        except Exception:
            ok = False
        print(("PASS" if ok else "FAIL") + f": n={n}")
        passed += int(ok)
    print(f"{passed} / {len(tests)}")`,
    ),
  },
  {
    id: "ex-graph-2",
    title: "Course schedule",
    description: "Cycle detection / topo sort.",
    vizKind: "graph_dfs",
    practiceFile: practiceShell(
      "course_schedule_practice.py",
      `# FILE: course_schedule_practice.py
# Lesson exercise: advanced graphs`,
      `from typing import List

def can_finish(num_courses: int, prereqs: List[List[int]]) -> bool:
    # TODO: topo sort or DFS colors; False on cycle
    pass

if __name__ == "__main__":
    tests = [
        (2, [[1, 0]], True),
        (2, [[1, 0], [0, 1]], False),
    ]
    passed = 0
    for n, edges, expected in tests:
        try:
            ok = can_finish(n, edges) is expected
        except Exception:
            ok = False
        print(("PASS" if ok else "FAIL") + f": n={n}")
        passed += int(ok)
    print(f"{passed} / {len(tests)}")`,
    ),
  },
  {
    id: "ex-trie-1",
    title: "Trie API",
    description: "insert / search / startsWith.",
    vizKind: "trie",
    practiceFile: practiceShell(
      "trie_practice.py",
      `# FILE: trie_practice.py
# Lesson exercise: tries`,
      `class Trie:
    def __init__(self) -> None:
        # TODO
        pass

    def insert(self, word: str) -> None:
        # TODO
        pass

    def search(self, word: str) -> bool:
        # TODO
        pass

    def startsWith(self, prefix: str) -> bool:
        # TODO
        pass

if __name__ == "__main__":
    t = Trie()
    try:
        t.insert("cat")
        ok = (
            t.search("cat") is True
            and t.search("ca") is False
            and t.startsWith("ca") is True
            and t.search("car") is False
        )
    except Exception:
        ok = False
    print(("PASS" if ok else "FAIL") + ": trie ops")
    print("1 / 1" if ok else "0 / 1")`,
    ),
  },
];
