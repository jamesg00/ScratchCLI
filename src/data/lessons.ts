import type { VizKind } from "../components/assistant/vizPlan";
import type { LessonExerciseId, LessonId } from "../stores/studyStore";
import type { PracticeFile } from "../components/assistant/practiceFile";
import {
  EXTRA_LESSON_EXERCISES,
  EXTRA_LESSON_TOPICS,
  EXTRA_LESSONS,
} from "./extraLessons";

export type LessonTopicId = string;

export type LessonTopic = {
  id: LessonTopicId;
  title: string;
  description: string;
  lessonIds: LessonId[];
};

export type LessonCopyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; title?: string; items: string[] }
  | {
      kind: "callout";
      tone: "signal" | "pitfall" | "strategy";
      title: string;
      text: string;
    };

type LessonNarrativeStep = {
  id: string;
  title: string;
  blocks: LessonCopyBlock[];
};

export type LessonStep =
  | ({
      type: "concept" | "worked_example" | "strategy" | "pitfall" | "recap";
    } & LessonNarrativeStep)
  | {
      id: string;
      type: "viz";
      title: string;
      vizKind: VizKind;
      content?: string;
    }
  | {
      id: string;
      type: "checkpoint";
      title: string;
      prompt: string;
      hint?: string;
      answer?: string;
      takeaway?: string;
    }
  | {
      id: string;
      type: "exercise";
      title: string;
      exerciseId: LessonExerciseId;
      intro: string;
      successCriteria: string[];
    };

export type Lesson = {
  id: LessonId;
  topicId: LessonTopicId;
  title: string;
  blurb: string;
  estimatedMinutes: number;
  learningGoals: string[];
  patternSignals: string[];
  commonMistakes: string[];
  complexityChecklist: string[];
  steps: LessonStep[];
};

export type LessonExercise = {
  id: LessonExerciseId;
  title: string;
  description: string;
  vizKind?: VizKind;
  practiceFile?: PracticeFile;
};

export type LessonProgress = {
  currentLessonId: LessonId | null;
  completedLessonIds: LessonId[];
  stepIndexByLesson: Record<LessonId, number>;
  completedExerciseIds: LessonExerciseId[];
};

export const LESSON_TOPICS: LessonTopic[] = [
  {
    id: "arrays_two_pointers",
    title: "Two pointers (arrays)",
    description:
      "Use ordering and invariants to discard impossible ranges quickly.",
    lessonIds: ["lesson-two-pointers-deep"],
  },
  {
    id: "strings_sliding_window",
    title: "Sliding window (strings)",
    description:
      "Maintain a valid contiguous window instead of recomputing every substring.",
    lessonIds: ["lesson-sliding-window-deep", "lesson-sliding-window-advanced"],
  },
  {
    id: "hashing_frequency",
    title: "Hashing + frequency",
    description:
      "Count once, query fast, and turn repeated scans into O(1) lookups.",
    lessonIds: ["lesson-hashing-deep"],
  },
  {
    id: "stack_queue",
    title: "Stack / queue fundamentals",
    description:
      "Choose LIFO vs FIFO based on the order the problem needs you to remember.",
    lessonIds: ["lesson-stack-queue-deep"],
  },
  {
    id: "tree_traversal",
    title: "Tree traversal",
    description:
      "Learn how BFS/DFS order, state, and visited rules shape correct tree walks.",
    lessonIds: ["lesson-tree-graph-deep"],
  },
  ...EXTRA_LESSON_TOPICS,
];

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

export const LESSONS: Lesson[] = [
  {
    id: "lesson-two-pointers-deep",
    topicId: "arrays_two_pointers",
    title: "Two pointers — reason from both ends",
    blurb:
      "Build the invariant, choose the discard rule, and stop guessing pointer moves.",
    estimatedMinutes: 28,
    learningGoals: [
      "Recognize when ordering makes a left/right sweep valid.",
      "Explain which pointer moves and why in sorted-array search problems.",
      "Avoid common duplicate and off-by-one mistakes.",
    ],
    patternSignals: [
      "Sorted array or sortable input",
      "Need one pair / one interval / one best range",
      "You can prove one side can be discarded after each comparison",
    ],
    commonMistakes: [
      "Moving the wrong pointer when the sum is too small or too large",
      "Forgetting duplicates or tie cases",
      "Using two pointers on unsorted input without restoring a valid ordering",
    ],
    complexityChecklist: [
      "Pointer movement should be monotonic",
      "Each index should be visited at most once or twice",
      "Target runtime is usually O(n) after sorting assumptions are met",
    ],
    steps: [
      {
        id: "tp-1",
        type: "concept",
        title: "When two pointers is the right pattern",
        blocks: [
          p(
            "Two pointers is not 'put one index on the left and one on the right and hope it works.' It is a proof technique. You use it when the input has an ordering, and that ordering lets you discard part of the search space after each comparison.",
          ),
          bullets(
            [
              "If the sum is too small in a sorted array, moving the left pointer right is the only move that can increase the sum.",
              "If the sum is too large, moving the right pointer left is the only move that can decrease the sum.",
              "Because each move removes impossible candidates forever, the algorithm stays linear.",
            ],
            "Core idea",
          ),
          callout(
            "signal",
            "Pattern signal",
            "If the problem says sorted array, pair sum, closest pair, remove duplicates, or maximize/minimize over a range, you should immediately test whether pointer movement can be justified by ordering.",
          ),
        ],
      },
      {
        id: "tp-2",
        type: "strategy",
        title: "The invariant matters more than the code",
        blocks: [
          p(
            "For pair-sum style problems, the invariant is: the answer, if it exists, is still somewhere inside the current interval [L, R]. Every pointer move must preserve that statement.",
          ),
          bullets(
            [
              "Start by naming what remains possible.",
              "Then ask: what evidence makes one boundary impossible?",
              "Only move a pointer when you can explain what you just ruled out.",
            ],
            "Mental checklist",
          ),
          callout(
            "strategy",
            "Interview move",
            "Say the discard rule out loud before you code it. That instantly makes your explanation stronger and prevents random pointer motion.",
          ),
        ],
      },
      {
        id: "tp-3",
        type: "worked_example",
        title: "Walk through the classic sorted two-sum problem",
        blocks: [
          p(
            "Suppose nums = [1, 2, 4, 6, 8] and target = 10. Start with L = 0, R = 4. The sum is 9, which is too small. Because the array is sorted, keeping L where it is can never produce a larger sum with any index left of R; the only promising direction is to increase L.",
          ),
          p(
            "At L = 1, R = 4 the sum becomes 10, so the pair is found. Notice what made the method reliable: we were never 'trying both options.' The ordering let us rule one option out.",
          ),
          bullets(
            [
              "Too small -> move L right",
              "Too large -> move R left",
              "Equal -> record answer or continue depending on the problem",
            ],
            "Decision table",
          ),
        ],
      },
      {
        id: "tp-4",
        type: "viz",
        title: "See how each pointer move shrinks the valid range",
        vizKind: "two_pointers",
        content:
          "Watch how the active interval shrinks and how the current sum determines which side becomes impossible.",
      },
      {
        id: "tp-5",
        type: "pitfall",
        title: "Common failure modes",
        blocks: [
          bullets([
            "Using the pattern on an unsorted array without sorting or otherwise proving a usable ordering.",
            "Moving both pointers at once and skipping candidates.",
            "Returning values when the problem wants indices, or vice versa.",
            "For duplicate-sensitive problems, forgetting whether duplicates should be skipped before or after recording an answer.",
          ]),
          callout(
            "pitfall",
            "Big trap",
            "If your explanation for a pointer move is 'it seemed reasonable,' the algorithm is probably wrong. Each move must be justified by an invariant or the sorted order.",
          ),
        ],
      },
      {
        id: "tp-6",
        type: "checkpoint",
        title: "Checkpoint: justify the move",
        prompt:
          "You are at nums[L] + nums[R] < target in a sorted array. Why is moving R left a bad move?",
        hint: "Think about whether decreasing the right value could ever help you reach a larger target sum.",
        answer:
          "Moving R left would only make the sum even smaller, so it cannot fix a sum that is already too small. The sorted order tells us the only candidate move is increasing L.",
        takeaway:
          "The pointer move comes from the direction the value must change, not from guesswork.",
      },
      {
        id: "tp-7",
        type: "strategy",
        title: "How this pattern generalizes",
        blocks: [
          p(
            "Once you understand the discard rule, the same structure shows up in container-with-most-water, removing duplicates in-place, partition-like scans, and some palindrome / string edge sweeps.",
          ),
          bullets(
            [
              "Ask what each pointer means.",
              "Ask what condition makes a side hopeless.",
              "Ask whether the output is one answer, all answers, or an optimized score.",
            ],
            "Transfer questions",
          ),
        ],
      },
      {
        id: "tp-8",
        type: "recap",
        title: "Recap: what to remember in interviews",
        blocks: [
          bullets([
            "Two pointers is about monotonic elimination.",
            "The best explanation uses an invariant and a discard rule.",
            "If the input is not ordered, justify how you create or simulate the ordering first.",
          ]),
        ],
      },
      {
        id: "tp-9",
        type: "exercise",
        title: "Capstone practice",
        exerciseId: "ex-two-pointers-1",
        intro:
          "Solve a sorted pair-sum problem and narrate the discard rule as you code. The goal is not just getting AC; it is being able to defend each pointer move.",
        successCriteria: [
          "State the invariant in one sentence before coding.",
          "Use O(1) extra space and a monotonic pointer sweep.",
          "Handle duplicates and missing-answer cases deliberately.",
        ],
      },
    ],
  },
  {
    id: "lesson-sliding-window-deep",
    topicId: "strings_sliding_window",
    title: "Sliding window — maintain validity, not brute force",
    blurb:
      "Use a live window invariant so contiguous-range problems stop feeling like nested-loop problems.",
    estimatedMinutes: 30,
    learningGoals: [
      "Recognize the difference between fixed and variable windows.",
      "Explain the window invariant before moving either pointer.",
      "Use hashing/state to keep updates O(1) while the window shifts.",
    ],
    patternSignals: [
      "Substring / subarray / contiguous range",
      "Longest or shortest valid range",
      "Need to maintain counts, uniqueness, or a budget while expanding and shrinking",
    ],
    commonMistakes: [
      "Shrinking too early or too late",
      "Forgetting to undo state when moving the left pointer",
      "Recomputing the window from scratch instead of updating it incrementally",
    ],
    complexityChecklist: [
      "Left and right pointers should only move forward",
      "All per-move state updates should be O(1)",
      "Target runtime is usually O(n)",
    ],
    steps: [
      {
        id: "sw-1",
        type: "concept",
        title: "What a sliding window really means",
        blocks: [
          p(
            "A sliding window is a contiguous region you keep updating as you scan. Instead of evaluating every substring independently, you carry forward useful state from the previous window.",
          ),
          bullets([
            "Fixed window: the size is constant, so each step drops one item and adds one item.",
            "Variable window: the size changes because validity depends on the contents.",
            "The invariant is the property that must remain true after each adjustment.",
          ]),
        ],
      },
      {
        id: "sw-2",
        type: "strategy",
        title: "Separate expand from repair",
        blocks: [
          p(
            "A clean way to reason about sliding window is in two phases: expand right to include new information, then repair from the left until the invariant becomes true again.",
          ),
          bullets([
            "Expand: include s[R] or nums[R].",
            "Check: did the invariant break?",
            "Repair: move L while invalid, updating state each time.",
            "Measure: once valid, consider updating the answer.",
          ]),
          callout(
            "strategy",
            "Interview phrase",
            "I grow the window aggressively, then shrink only as much as needed to restore validity.",
          ),
        ],
      },
      {
        id: "sw-3",
        type: "worked_example",
        title: "Longest substring without repeating characters",
        blocks: [
          p(
            "As you scan with R, keep a structure that tells you whether a character is already inside the current window. When a repeat appears, the job is not 'restart the search'; the job is 'push L until the repeat disappears.'",
          ),
          p(
            "That is the major mental shift: the left pointer exists to repair the invariant, not just to trail behind the right pointer.",
          ),
          bullets([
            "Window state: which characters are present, or their last-seen indices",
            "Invalid condition: the new character repeats inside the current window",
            "Answer update: whenever the window becomes valid again",
          ]),
        ],
      },
      {
        id: "sw-4",
        type: "viz",
        title: "Watch the window expand and repair itself",
        vizKind: "sliding_window",
        content:
          "The useful thing to notice is not just where L and R are, but why L moves only after the invariant breaks.",
      },
      {
        id: "sw-5",
        type: "pitfall",
        title: "The repair loop is where most bugs live",
        blocks: [
          bullets([
            "Forgetting to remove or decrement the left character before moving L",
            "Updating the answer before the window is valid again",
            "Using the wrong invariant: e.g. tracking global duplicates instead of window duplicates",
          ]),
          callout(
            "pitfall",
            "Common bug",
            "If your left pointer moves but your state does not, your invariant is fake and your answer will drift from reality.",
          ),
        ],
      },
      {
        id: "sw-6",
        type: "checkpoint",
        title: "Checkpoint: what forces L to move?",
        prompt:
          "In a variable-size window problem, should you move L on every iteration of R? Why or why not?",
        hint: "Think about what L is responsible for. Does it move because time passed, or because the window became invalid?",
        answer:
          "No. L only moves when the invariant is broken or when shrinking helps optimize the current valid window. If the window is still valid, moving L early can throw away useful candidates.",
        takeaway: "The left pointer is a repair tool, not a metronome.",
      },
      {
        id: "sw-7",
        type: "strategy",
        title: "How to identify the right state to maintain",
        blocks: [
          p(
            "Most sliding-window problems are solved by asking one question: what small piece of state lets me tell whether the current window is valid, and update that state in O(1) when either pointer moves?",
          ),
          bullets([
            "Uniqueness -> set or last-seen map",
            "Counts / budgets -> frequency map or running sum",
            "At most K distinct -> frequency map + distinct counter",
            "Target sum on positives -> running total",
          ]),
        ],
      },
      {
        id: "sw-8",
        type: "recap",
        title: "Recap: the three verbs",
        blocks: [
          bullets([
            "Expand the window",
            "Repair the invariant",
            "Measure the answer",
          ]),
          p(
            "If you can identify those three verbs cleanly, you can usually derive the rest of the implementation without memorizing the exact problem.",
          ),
        ],
      },
      {
        id: "sw-9",
        type: "exercise",
        title: "Capstone practice",
        exerciseId: "ex-sliding-window-1",
        intro:
          "Solve the longest-unique-substring problem while narrating your invariant and repair loop. The point is to train your reasoning, not just the syntax.",
        successCriteria: [
          "Explain what makes the window valid.",
          "Update state correctly when both R and L move.",
          "Keep the solution linear without nested rescans.",
        ],
      },
    ],
  },
  {
    id: "lesson-hashing-deep",
    topicId: "hashing_frequency",
    title: "Hashing — remember once, answer fast",
    blurb:
      "Turn repeated searching into constant-time lookup by deciding exactly what to store.",
    estimatedMinutes: 26,
    learningGoals: [
      "Use frequency maps and complement maps intentionally.",
      "Recognize whether the hash map stores counts, positions, or needs-to-find values.",
      "Explain why hashing changes repeated scans from O(n^2) to O(n).",
    ],
    patternSignals: [
      "Need fast membership or complement checks",
      "Need to count repeated values",
      "Need first/last occurrence, grouping, or duplicate detection",
    ],
    commonMistakes: [
      "Storing the wrong thing in the map",
      "Checking the complement after insertion when the order matters",
      "Confusing frequency problems with order-sensitive problems",
    ],
    complexityChecklist: [
      "Each lookup/update should be O(1) average case",
      "The map meaning should be nameable in one sentence",
      "Total runtime should usually be O(n)",
    ],
    steps: [
      {
        id: "hm-1",
        type: "concept",
        title: "Hashing is about what you remember",
        blocks: [
          p(
            "People often say 'use a hash map' too early. The real question is: what information do I need later, and can I store it so that future checks become constant time?",
          ),
          bullets([
            "Counts solve frequency problems",
            "Indices solve first-seen / position problems",
            "Complements solve pair / sum / lookup-against-target problems",
          ]),
        ],
      },
      {
        id: "hm-2",
        type: "strategy",
        title: "Name the meaning of the map",
        blocks: [
          p(
            "Before coding, finish this sentence: 'map[x] means ___.' If you cannot finish that sentence, you are likely storing the wrong thing or mixing multiple ideas into one structure.",
          ),
          bullets([
            "freq[c] = how many times c appears",
            "lastSeen[c] = most recent index of c",
            "need[x] = I am waiting for x to complete a pair",
          ]),
          callout(
            "strategy",
            "Interview habit",
            "Naming the map meaning out loud makes debugging much easier and makes your explanation sound intentional.",
          ),
        ],
      },
      {
        id: "hm-3",
        type: "worked_example",
        title: "Frequency counting and the second pass",
        blocks: [
          p(
            "For 'first unique character,' the first pass answers a global question: how many times does each character appear? The second pass answers an order question: which character appears first among those with frequency one?",
          ),
          p(
            "That split is important. The hash map gives you global knowledge cheaply, and the second pass restores the original order requirement.",
          ),
        ],
      },
      {
        id: "hm-4",
        type: "viz",
        title: "Watch a frequency map fill and then answer queries",
        vizKind: "hash_map",
        content:
          "Notice how the map is built once, then reused for constant-time checks during the ordered scan.",
      },
      {
        id: "hm-5",
        type: "pitfall",
        title: "Order still matters in many hashing problems",
        blocks: [
          bullets([
            "Two-sum variants often depend on whether you check before insert or insert before check.",
            "Frequency alone cannot answer 'first' or 'leftmost' questions without another ordered pass.",
            "Overusing a map can hide a simpler invariant if the input is already sorted.",
          ]),
          callout(
            "pitfall",
            "Subtle bug",
            "If you overwrite an earlier index that you still needed, the map became logically correct for the latest value but wrong for the output requirement.",
          ),
        ],
      },
      {
        id: "hm-6",
        type: "checkpoint",
        title: "Checkpoint: why two passes?",
        prompt:
          "Why is a second left-to-right pass still useful after you already counted every character?",
        hint: "Frequency answers uniqueness, but what answers 'first'?",
        answer:
          "The map tells you whether a character is unique, but it does not automatically preserve the original left-to-right answer requirement. The second pass restores the ordering constraint cheaply.",
        takeaway:
          "Hashing gives fast facts; you may still need a separate pass to respect output order.",
      },
      {
        id: "hm-7",
        type: "strategy",
        title: "Three common hashing templates",
        blocks: [
          bullets([
            "Count template: accumulate frequencies, then query them",
            "Complement template: ask whether what you need is already known",
            "Grouping template: use lists/buckets keyed by shared attributes",
          ]),
          p(
            "When a new problem appears, try classifying it into one of these templates before inventing a custom map shape.",
          ),
        ],
      },
      {
        id: "hm-8",
        type: "recap",
        title: "Recap: maps are memory, not magic",
        blocks: [
          bullets([
            "Decide what to remember",
            "Name what each entry means",
            "Check whether the final answer also needs order, not just lookup",
          ]),
        ],
      },
      {
        id: "hm-9",
        type: "exercise",
        title: "Capstone practice",
        exerciseId: "ex-hashing-1",
        intro:
          "Implement first unique character with a clear map meaning and a deliberate second pass.",
        successCriteria: [
          "Use a true O(n) two-pass solution",
          "Keep the map meaning obvious",
          "Return the index, not the character",
        ],
      },
    ],
  },
  {
    id: "lesson-stack-queue-deep",
    topicId: "stack_queue",
    title: "Stacks and queues — preserve the right order",
    blurb:
      "Understand why LIFO or FIFO is required before you choose the structure.",
    estimatedMinutes: 27,
    learningGoals: [
      "Choose stack vs queue based on required processing order.",
      "Explain the invariant for bracket matching and BFS-like queues.",
      "Recognize when the data structure is storing deferred work vs pending frontier.",
    ],
    patternSignals: [
      "Need to match the most recent unfinished item",
      "Need to process work in arrival order",
      "Need to preserve nested structure or level-order expansion",
    ],
    commonMistakes: [
      "Using a stack where first-in-first-out order is required",
      "Checking a closing token without verifying the stack is non-empty",
      "Treating a queue like a random bag instead of an ordered frontier",
    ],
    complexityChecklist: [
      "Push/pop or append/popleft should be O(1)",
      "The top/front of the structure should directly represent the next required work item",
      "Structure operations should mirror the problem’s order rule",
    ],
    steps: [
      {
        id: "sq-1",
        type: "concept",
        title: "Data structures encode order, not just storage",
        blocks: [
          p(
            "A stack is not just a list you call append/pop on. It represents 'most recent unfinished work.' A queue represents 'oldest pending work.' The structure is valuable because its ordering matches the problem’s ordering rule.",
          ),
          bullets([
            "Stack = LIFO, best for nesting and undo-like behavior",
            "Queue = FIFO, best for wavefront expansion and level order",
          ]),
        ],
      },
      {
        id: "sq-2",
        type: "worked_example",
        title: "Why valid parentheses is a stack problem",
        blocks: [
          p(
            "When you scan brackets left to right, a closing bracket must match the most recent opening bracket that has not been closed yet. That phrase 'most recent unmatched' is exactly the definition of stack top.",
          ),
          bullets([
            "Opening token -> push",
            "Closing token -> compare with top",
            "Mismatch or empty stack -> invalid immediately",
          ]),
        ],
      },
      {
        id: "sq-3",
        type: "viz",
        title: "See unmatched openings build and collapse",
        vizKind: "stack",
        content:
          "Watch how the top of the stack always represents the next bracket that must be closed correctly.",
      },
      {
        id: "sq-4",
        type: "pitfall",
        title: "What beginners often miss",
        blocks: [
          bullets([
            "Checking bracket type before checking whether the stack is empty",
            "Forgetting to ensure the stack is empty at the very end",
            "Pushing closers or storing the wrong representation",
          ]),
          callout(
            "pitfall",
            "Tiny but fatal",
            "An algorithm that handles every closer correctly but forgets the final 'stack must be empty' check still accepts incomplete strings.",
          ),
        ],
      },
      {
        id: "sq-5",
        type: "strategy",
        title: "Queues show up when discovery order matters",
        blocks: [
          p(
            "A queue is the right choice when items should be processed in the same order they were discovered. BFS is the classic example: earlier discoveries represent nodes closer to the source, so they must be processed first.",
          ),
          bullets([
            "Queue front = oldest pending work",
            "Queue append = newly discovered work",
            "Queue pop-left = process next frontier item",
          ]),
        ],
      },
      {
        id: "sq-6",
        type: "checkpoint",
        title: "Checkpoint: top vs front",
        prompt:
          "Why does valid-parentheses need a stack top instead of a queue front?",
        hint: "Ask which unmatched opening bracket must be closed first.",
        answer:
          "The correct closer must match the most recent unmatched opener, not the oldest one. A queue would expose the oldest pending token, which is the wrong dependency order for nested structure.",
        takeaway:
          "Choose the structure whose exposed element matches the next logically required element.",
      },
      {
        id: "sq-7",
        type: "strategy",
        title: "How to choose quickly in interviews",
        blocks: [
          bullets([
            "Need most recent unfinished item -> stack",
            "Need oldest pending item -> queue",
            "Need random lookup -> neither; you are solving a different problem",
          ]),
          p(
            "This choice should happen before syntax. If you choose the structure from the order rule, the code often writes itself.",
          ),
        ],
      },
      {
        id: "sq-8",
        type: "recap",
        title: "Recap: ask who must be served next",
        blocks: [
          p(
            "Stacks and queues feel simple, but they are foundational because so many problems reduce to one question: which pending item must be handled next to preserve correctness?",
          ),
        ],
      },
      {
        id: "sq-9",
        type: "exercise",
        title: "Capstone practice",
        exerciseId: "ex-stack-1",
        intro:
          "Implement valid parentheses with clear invalidation rules and a final completeness check.",
        successCriteria: [
          "Reject invalid closers immediately",
          "Use the stack top as the invariant source of truth",
          "Finish by checking whether any unmatched openings remain",
        ],
      },
    ],
  },
  {
    id: "lesson-tree-graph-deep",
    topicId: "tree_traversal",
    title: "Tree and graph traversal — order, frontier, visited",
    blurb:
      "Understand BFS vs DFS as search disciplines, not just memorized templates.",
    estimatedMinutes: 34,
    learningGoals: [
      "Explain why BFS and DFS produce different exploration orders.",
      "Understand queue/frontier state vs recursion/stack state.",
      "Know when a visited set is mandatory and when tree structure makes it optional.",
    ],
    patternSignals: [
      "Need level order, shortest unweighted distance, or nearest target -> BFS",
      "Need exhaustive path exploration or recursive structure -> DFS",
      "Need to prevent revisiting in general graphs -> visited set",
    ],
    commonMistakes: [
      "Forgetting visited tracking in graphs with cycles",
      "Confusing discovery order with processing order",
      "Mixing tree assumptions into graph problems",
    ],
    complexityChecklist: [
      "Each node should be processed a bounded number of times",
      "Queue or recursion stack should represent current frontier/path",
      "Visited should be updated consistently at discovery time or processing time",
    ],
    steps: [
      {
        id: "tg-1",
        type: "concept",
        title: "Traversal is about the next node you are allowed to touch",
        blocks: [
          p(
            "BFS and DFS are not just two snippets. They are two different policies for deciding which discovered node gets processed next. BFS uses oldest-discovered-first; DFS uses newest-discovered-first or recursive descent.",
          ),
          bullets([
            "BFS explores by distance / layer",
            "DFS explores one branch deeply before backing up",
            "The chosen order changes what is easy to answer",
          ]),
        ],
      },
      {
        id: "tg-2",
        type: "strategy",
        title: "When BFS is the natural fit",
        blocks: [
          bullets([
            "Level-order tree traversal",
            "Shortest path in an unweighted graph",
            "Nearest exit / nearest target / minimum number of steps",
          ]),
          p(
            "If the problem’s notion of progress is 'number of edges from the start,' BFS usually fits because the queue processes nodes in increasing distance order.",
          ),
        ],
      },
      {
        id: "tg-3",
        type: "worked_example",
        title: "What the queue means in BFS",
        blocks: [
          p(
            "The queue is the frontier: nodes already discovered but not fully processed. When you pop from the front, you are processing the next node with the smallest pending distance from the start.",
          ),
          p(
            "That is why BFS can answer shortest-step questions in unweighted graphs without extra magic. The order already encodes the distance guarantee.",
          ),
        ],
      },
      {
        id: "tg-4",
        type: "viz",
        title: "See breadth-first expansion on a structure",
        vizKind: "tree",
        content:
          "Notice how the queue preserves the left-to-right discovery order within each layer and how the frontier grows and shrinks over time.",
      },
      {
        id: "tg-5",
        type: "concept",
        title: "What DFS gives you instead",
        blocks: [
          p(
            "DFS is better when you need to commit to one path, recurse through structure, or collect information during backtracking. The active state is not a frontier by distance; it is the current path or branch.",
          ),
          bullets([
            "Tree height / subtree logic",
            "Backtracking and path construction",
            "Cycle detection with extra state",
          ]),
        ],
      },
      {
        id: "tg-6",
        type: "pitfall",
        title: "Graphs are not trees",
        blocks: [
          p(
            "In trees, parent-child structure prevents arbitrary cycles, so you can often skip visited if you carry the parent context. In general graphs, that shortcut fails. If you do not track visited, the traversal can loop forever or keep reprocessing the same nodes.",
          ),
          bullets([
            "Tree: usually no visited set needed if structure is trusted",
            "Graph: visited is usually mandatory",
            "Directed graph cycle problems may need more than one visited state",
          ]),
        ],
      },
      {
        id: "tg-7",
        type: "checkpoint",
        title: "Checkpoint: why BFS finds shortest unweighted distance",
        prompt:
          "Why can BFS return the shortest number of edges to a target the first time the target is popped or discovered?",
        hint: "Think about what order the queue guarantees for nodes at distance d, d+1, d+2, ...",
        answer:
          "Because BFS processes nodes in nondecreasing distance order. All nodes at distance d are explored before any node at distance d+1, so the first time you reach the target, no shorter unweighted path could still be waiting.",
        takeaway:
          "The correctness comes from queue order, not from an extra shortest-path formula.",
      },
      {
        id: "tg-8",
        type: "strategy",
        title: "A quick chooser for traversal problems",
        blocks: [
          bullets([
            "Need nearest / fewest steps / level order -> BFS",
            "Need recursive property / explore all paths / subtree aggregation -> DFS",
            "Need to avoid repeats in a graph -> visited set",
          ]),
          callout(
            "strategy",
            "Good habit",
            "Say what the queue or recursion stack represents. If you can define that state clearly, your traversal is usually on solid ground.",
          ),
        ],
      },
      {
        id: "tg-9",
        type: "recap",
        title: "Recap: think in terms of frontier vs path",
        blocks: [
          p(
            "BFS manages a frontier by distance. DFS manages a path by depth. Once you understand that difference, the code becomes an implementation detail instead of something to memorize blindly.",
          ),
        ],
      },
      {
        id: "tg-10",
        type: "exercise",
        title: "Capstone practice",
        exerciseId: "ex-tree-1",
        intro:
          "Implement a level-order traversal and explain what the queue represents at every iteration.",
        successCriteria: [
          "Process nodes level by level",
          "Build the output in the same order nodes are discovered within a level",
          "Be able to explain how the queue preserves correctness",
        ],
      },
    ],
  },
  ...EXTRA_LESSONS,
];

export const LESSON_EXERCISES: LessonExercise[] = [
  {
    id: "ex-two-pointers-1",
    title: "Practice: pair sum (two pointers)",
    description: "Placeholder exercise description (authored in lesson-mvp).",
    vizKind: "two_pointers",
    practiceFile: {
      fileName: "two_sum_sorted_practice.py",
      content: `# FILE: two_sum_sorted_practice.py
# Lesson exercise: Two pointers
#
# Goal: Return the indices of two numbers in a *sorted* array that add up to target.

from typing import List


def two_sum_sorted(nums: List[int], target: int) -> List[int]:
    # TODO: implement two pointers (L from left, R from right)
    pass


if __name__ == "__main__":
    tests = [
        ("example", [1, 2, 3, 4, 5], 9, [3, 4]),  # 4 + 5
        ("two_indices", [1, 2, 4, 6, 8], 10, [1, 4]),  # 2 + 8
        ("duplicates", [1, 1, 2, 3], 2, [0, 1]),
        ("missing", [1, 2, 4], 100, []),
    ]
    passed = 0
    for name, nums, target, expected in tests:
        try:
            got = two_sum_sorted(nums, target)
            ok = sorted(got) == sorted(expected)
        except Exception:
            ok = False
        if ok:
            passed += 1
            print(f"PASS: {name}")
        else:
            print(f"FAIL: {name}")
    print(f"{passed} / {len(tests)}")
`,
    },
  },
  {
    id: "ex-sliding-window-1",
    title: "Practice: longest valid window",
    description: "Placeholder exercise description (authored in lesson-mvp).",
    vizKind: "sliding_window",
    practiceFile: {
      fileName: "longest_unique_substring_practice.py",
      content: `# FILE: longest_unique_substring_practice.py
# Lesson exercise: Sliding window
#
# Goal: Return the length of the longest substring without repeating characters.

from typing import Dict


def length_of_longest_substring(s: str) -> int:
    # TODO: sliding window with a character->last_seen index (or set + shrink)
    pass


if __name__ == "__main__":
    tests = [
        ("abcabcbb", "abcabcbb", 3),
        ("bbbbb", "bbbbb", 1),
        ("", "", 0),
        ("pwwkew", "pwwkew", 3),
    ]
    passed = 0
    for name, s, expected in tests:
        try:
            got = length_of_longest_substring(s)
            ok = got == expected
        except Exception:
            ok = False
        if ok:
            passed += 1
            print(f"PASS: {name}")
        else:
            print(f"FAIL: {name}")
    print(f"{passed} / {len(tests)}")
`,
    },
  },
  {
    id: "ex-hashing-1",
    title: "Practice: frequency counting",
    description: "Placeholder exercise description (authored in lesson-mvp).",
    vizKind: "hash_map",
    practiceFile: {
      fileName: "first_unique_char_practice.py",
      content: `# FILE: first_unique_char_practice.py
# Lesson exercise: Hashing + frequency counting
#
# Goal: Return the index of the first non-repeating character in a string.
# If no unique character exists, return -1.


def first_unique_char(s: str) -> int:
    # TODO: count frequencies, then scan left-to-right
    pass


if __name__ == "__main__":
    tests = [
        ("leetcode", "leetcode", 0),
        ("loveleetcode", "loveleetcode", 2),
        ("aabb", "aabb", -1),
        ("abc", "abc", 0),
    ]
    passed = 0
    for name, s, expected in tests:
        try:
            got = first_unique_char(s)
            ok = got == expected
        except Exception:
            ok = False
        if ok:
            passed += 1
            print(f"PASS: {name}")
        else:
            print(f"FAIL: {name}")
    print(f"{passed} / {len(tests)}")
`,
    },
  },
  {
    id: "ex-stack-1",
    title: "Practice: stack simulation",
    description: "Placeholder exercise description (authored in lesson-mvp).",
    vizKind: "stack",
    practiceFile: {
      fileName: "valid_parentheses_practice.py",
      content: `# FILE: valid_parentheses_practice.py
# Lesson exercise: Stack
#
# Goal: Return True if the input string is a valid sequence of parentheses/brackets/braces.


def is_valid_parentheses(s: str) -> bool:
    # TODO: stack-based bracket matching
    pass


if __name__ == "__main__":
    tests = [
        ("empty", "", True),
        ("paren", "()", True),
        ("all", "()[]{}", True),
        ("mismatch", "(]", False),
        ("cross", "([)]", False),
    ]
    passed = 0
    for name, s, expected in tests:
        try:
            got = is_valid_parentheses(s)
            ok = got == expected
        except Exception:
            ok = False
        if ok:
            passed += 1
            print(f"PASS: {name}")
        else:
            print(f"FAIL: {name}")
    print(f"{passed} / {len(tests)}")
`,
    },
  },
  {
    id: "ex-tree-1",
    title: "Practice: level-order traversal",
    description: "Placeholder exercise description (authored in lesson-mvp).",
    vizKind: "tree",
    practiceFile: {
      fileName: "level_order_heap_practice.py",
      content: `# FILE: level_order_heap_practice.py
# Lesson exercise: Tree traversal (BFS)
#
# Representation:
# - Input is a heap-like array where index i has children 2*i+1 and 2*i+2.
# - Use None for missing nodes.
#
# Goal:
# Return a list of levels, where each level is a list of node values.

from typing import List, Optional


def level_order_heap(values: List[Optional[int]]) -> List[List[int]]:
    # TODO: BFS with a queue of indices; build levels by depth.
    pass


if __name__ == "__main__":
    tests = [
        ("example", [1, 2, 3, 4, 5], [[1], [2, 3], [4, 5]]),
        ("missing_children", [1, None, 2, 3], [[1], [2], [3]]),
        ("all_missing", [None], []),
    ]
    passed = 0
    for name, values, expected in tests:
        try:
            got = level_order_heap(values)
            ok = got == expected
        except Exception:
            ok = False
        if ok:
            passed += 1
            print(f"PASS: {name}")
        else:
            print(f"FAIL: {name}")
    print(f"{passed} / {len(tests)}")
`,
    },
  },
  ...EXTRA_LESSON_EXERCISES,
];

export function getLessonById(lessonId: LessonId): Lesson | undefined {
  return LESSONS.find((l) => l.id === lessonId);
}

export function getExerciseById(
  exerciseId: LessonExerciseId,
): LessonExercise | undefined {
  return LESSON_EXERCISES.find((e) => e.id === exerciseId);
}

export function getTopicByLessonId(
  lessonId: LessonId,
): LessonTopic | undefined {
  const lesson = getLessonById(lessonId);
  if (!lesson) return undefined;
  return LESSON_TOPICS.find((t) => t.id === lesson.topicId);
}

export function countLessonStepType(
  lesson: Lesson | undefined,
  type: LessonStep["type"],
): number {
  if (!lesson) return 0;
  return lesson.steps.filter((step) => step.type === type).length;
}

export function lessonFeatureSummary(lesson: Lesson | undefined): string[] {
  if (!lesson) return [];
  const tags: string[] = [];
  const vizCount = countLessonStepType(lesson, "viz");
  const checkpointCount = countLessonStepType(lesson, "checkpoint");
  const exerciseCount = countLessonStepType(lesson, "exercise");
  if (vizCount) tags.push(`${vizCount} viz`);
  if (checkpointCount)
    tags.push(
      `${checkpointCount} checkpoint${checkpointCount === 1 ? "" : "s"}`,
    );
  if (exerciseCount) tags.push(`${exerciseCount} exercise`);
  tags.push(`${lesson.steps.length} steps`);
  tags.push(`${lesson.estimatedMinutes} min`);
  return tags;
}
