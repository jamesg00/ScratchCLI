/** Extract a runnable practice .py file from a Grok coach reply. */

import { buildVizPrompt } from "./vizPrompt";
import { buildHintGuidePrompt } from "./hintGuide";
import type { LcPracticeMode } from "./leetcodeFlow";

export type PracticeFile = {
  content: string;
  fileName: string;
};

export type PracticeCommand =
  | {
      kind: "grok";
      prompt: string;
      createFile: boolean;
      guideBuffer?: boolean;
    }
  | { kind: "leetcode"; mode: LcPracticeMode; slugOrId?: string }
  | { kind: "done" }
  | { kind: "done-reset" };

const FILE_LINE = /^\s*#\s*FILE:\s*([A-Za-z0-9_-]+\.py)\s*$/im;

export function extractPracticeFile(reply: string): PracticeFile | null {
  const fenced = extractLargestPythonFence(reply);
  const raw = (fenced ?? reply).trim();
  if (!raw) return null;

  const hasPass = /^\s*pass\s*$/m.test(raw) || /\n\s+pass\s*\n/.test(raw);
  const hasMain = /if\s+__name__\s*==\s*["']__main__["']/.test(raw);
  const hasDef = /\bdef\s+\w+\s*\(/.test(raw);
  const hasFileMarker = FILE_LINE.test(raw);
  const hasCases = /\bCASES\s*=/.test(raw);
  const hasPassFail = /\bPASS\b/.test(raw) && /\bFAIL\b/.test(raw);
  if (!hasDef || !hasMain) return null;
  if (!hasPass && !hasFileMarker && !hasCases) return null;
  if (
    !hasPassFail &&
    !hasFileMarker &&
    !hasCases &&
    raw.split("\n").length < 20
  ) {
    return null;
  }

  const fileMatch = raw.match(FILE_LINE);
  let fileName = fileMatch?.[1]?.toLowerCase() ?? "";
  if (!fileName) {
    const fn = raw.match(/\bdef\s+([a-zA-Z_]\w*)\s*\(/);
    const slug = (fn?.[1] ?? "practice_problem")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    fileName = `${slug || "practice_problem"}.py`;
  }

  let content = raw.replace(FILE_LINE, "").replace(/^\s*\n/, "");
  if (!content.startsWith("# FILE:")) {
    content = `# FILE: ${fileName}\n${content}`;
  }

  return { content: content.trimEnd() + "\n", fileName };
}

function extractLargestPythonFence(reply: string): string | null {
  const re = /```(?:python|py)?\s*\n([\s\S]*?)```/gi;
  let best: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(reply)) !== null) {
    const body = match[1]?.trim() ?? "";
    if (!best || body.length > best.length) best = body;
  }
  return best;
}

const COACH_ONLY = new Set([
  "hint",
  "hints",
  "advice",
  "guide",
  "review",
  "solution",
  "answer",
  "explain",
  "viz",
  "visualize",
  "help",
  "?",
  "clear",
  "cls",
  "insert",
  "settings",
  "key",
  "exit",
  "close",
  "q",
  "done",
]);

/** True when the user is asking for a new AI-invented practice problem. */
export function isInventProblemRequest(lower: string): boolean {
  const word = lower.split(/\s+/)[0] ?? "";
  if (COACH_ONLY.has(word)) return false;
  if (word === "invent" || word === "original") return true;
  if (word === "hard") return true; // AI invent for hard; LC path is easy/medium/oa
  return (
    (/\b(invent|original|made-up|fake)\b/.test(lower) &&
      /\b(problem|question|challenge)\b/.test(lower)) ||
    /\b(give|generate|create|make|write)\b.{0,40}\b(original|invented)\b/.test(
      lower,
    )
  );
}

/** Legacy helper used by tests / free-form detection. */
export function isNewProblemRequest(lower: string): boolean {
  const word = lower.split(/\s+/)[0] ?? "";
  if (COACH_ONLY.has(word)) return false;
  if (
    word === "practice" ||
    word === "problem" ||
    word === "problems" ||
    word === "leetcode" ||
    word === "dsa" ||
    word === "next" ||
    word === "easy" ||
    word === "medium" ||
    word === "hard" ||
    word === "another" ||
    word === "again" ||
    word === "new" ||
    word === "oa" ||
    word === "amazon" ||
    word === "invent" ||
    word === "original"
  ) {
    return true;
  }
  return (
    (/\b(new|another|next|fresh|more)\b/.test(lower) &&
      /\b(problem|problems|question|questions|challenge|kata|exercise)\b/.test(
        lower,
      )) ||
    /\b(give|generate|create|make|write)\b.{0,40}\b(problem|problems|question|leetcode|challenge)\b/.test(
      lower,
    ) ||
    /^(easy|medium|hard)\b/.test(lower)
  );
}

export const PRACTICE_FILE_INSTRUCTIONS = [
  "Reply with a one-line intro, then ONE ```python fence that is a COMPLETE runnable .py file.",
  "The file must start with `# FILE: short_snake_name.py`.",
  "Include: module docstring (title, difficulty, full problem, I/O, constraints; examples optional),",
  "a WORKING reference solution (real algorithm — ScratchCLI strips it to `pass` after sealing),",
  'and `if __name__ == "__main__":` with `CASES` — INPUTS ONLY (no expected outputs).',
  "Function problems: `CASES = [(arg,), ...]` or multi-arg tuples.",
  "Design/class problems (MedianFinder, LRUCache, etc.): use a real class implementation (not pass stubs) and",
  '`CASES = [(["ClassName","method",...], [[], [args], ...]), ...]` — LeetCode ops/args style.',
  "NEVER invent expected outputs or PASS/FAIL harnesses; ScratchCLI runs your solution to seal expecteds.",
  "Prefer JSON-serializable I/O (str, int, list, dict, bool, None).",
].join(" ");

/** Prompt used when a first practice reply fails sealing (retry once). */
export const PRACTICE_SEAL_RETRY_PROMPT = [
  "Your previous practice file could not be sealed (missing/invalid CASES, pass-only stubs, or the reference crashed).",
  "Reply again with ONE ```python fence starting with `# FILE: short_snake_name.py`.",
  "Include a WORKING reference solution (not `pass`) and `CASES` with INPUTS ONLY — no expected outputs.",
  'If it is a design problem (class with methods), use CASES = [(["ClassName", "addNum", "findMedian", ...], [[], [1], [], ...]), ...] and implement the class for real.',
  "Prefer simple JSON-serializable arguments.",
].join(" ");

function difficultyFromText(lower: string): "Easy" | "Medium" | "Hard" {
  if (/\bhard\b/.test(lower)) return "Hard";
  if (/\beasy\b/.test(lower)) return "Easy";
  if (/\bmedium\b/.test(lower)) return "Medium";
  return "Medium";
}

function inventPrompt(difficulty: string, topic: string, raw?: string): string {
  const lead = raw
    ? `The user asked: "${raw.trim()}" Give them a NEW original LeetCode-style ${difficulty} Python DSA problem matching that request.`
    : `Give me a NEW original LeetCode-style ${difficulty} problem in Python. Topic focus: ${topic}.`;
  return [
    lead,
    "Do not reuse a famous problem by name.",
    PRACTICE_FILE_INSTRUCTIONS,
  ].join(" ");
}

/** Map short coach commands / free-form problem asks. */
export function expandPracticeCommand(
  lower: string,
  raw: string,
  buffer = "",
): PracticeCommand | null {
  const word = lower.split(/\s+/)[0] ?? "";
  const rest = raw.trim().slice(word.length).trim();

  if (word === "done") {
    if (rest === "reset" || rest === "clear") return { kind: "done-reset" };
    return { kind: "done" };
  }

  if (
    word === "hint" ||
    word === "hints" ||
    word === "advice" ||
    word === "guide"
  ) {
    return {
      kind: "grok",
      createFile: false,
      guideBuffer: true,
      prompt: buildHintGuidePrompt({
        mode: word === "advice" ? "advice" : "hint",
        focus: rest || undefined,
        buffer,
      }),
    };
  }

  if (word === "review") {
    return {
      kind: "grok",
      createFile: false,
      guideBuffer: true,
      prompt: buildHintGuidePrompt({
        mode: "review",
        focus: rest || undefined,
        buffer,
      }),
    };
  }

  if (word === "solution" || word === "answer") {
    return {
      kind: "grok",
      createFile: false,
      prompt: rest
        ? `The user EXPLICITLY asked for the full solution for: ${rest}. Show a clean optimal Python solution with brief teaching comments and complexity. Do not claim this is a hint.`
        : "The user EXPLICITLY asked for the full solution for the current problem. Show a clean optimal Python solution with brief teaching comments and time/space complexity. This is NOT a hint — they asked for the answer.",
    };
  }

  if (word === "viz" || word === "visualize") {
    return {
      kind: "grok",
      createFile: false,
      prompt: buildVizPrompt({ focus: rest || undefined }),
    };
  }

  if (word === "invent" || word === "original") {
    const difficulty = difficultyFromText(lower);
    const topic = rest || "any core DSA topic";
    return {
      kind: "grok",
      createFile: true,
      prompt: inventPrompt(difficulty, topic),
    };
  }

  if (word === "easy") {
    return { kind: "leetcode", mode: "easy" };
  }
  if (word === "medium") {
    return { kind: "leetcode", mode: "medium" };
  }
  if (word === "oa" || word === "amazon") {
    return { kind: "leetcode", mode: "oa" };
  }
  if (
    word === "practice" ||
    word === "problem" ||
    word === "problems" ||
    word === "dsa" ||
    word === "next" ||
    word === "another" ||
    word === "again" ||
    word === "new"
  ) {
    return { kind: "leetcode", mode: "oa" };
  }

  if (word === "leetcode") {
    if (!rest) return { kind: "leetcode", mode: "oa" };
    return { kind: "leetcode", mode: "slug", slugOrId: rest.split(/\s+/)[0] };
  }

  if (word === "hard" || isInventProblemRequest(lower)) {
    const difficulty = difficultyFromText(lower);
    return {
      kind: "grok",
      createFile: true,
      prompt: inventPrompt(difficulty, rest || "any core DSA topic", raw),
    };
  }

  // Free-form "give me a problem" → Amazon OA LeetCode pull
  if (isNewProblemRequest(lower)) {
    return { kind: "leetcode", mode: "oa" };
  }

  return null;
}
