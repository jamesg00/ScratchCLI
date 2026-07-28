/** Pick next LeetCode problem (Amazon OA pool or difficulty list) and build a scaffold. */

import { AMAZON_OA_SLUGS } from "../../data/amazonOaSlugs";
import {
  leetcodeGetProblem,
  leetcodeListProblems,
  type LeetCodeProblem,
} from "../../services/leetcode";
import { useLeetCodeStore } from "../../stores/leetcodeStore";
import { buildLeetCodeScaffold, type ScaffoldResult } from "./leetcodePractice";

export type LcPracticeMode = "easy" | "medium" | "oa" | "slug";

export type LcPracticeRequest = {
  kind: "leetcode";
  mode: LcPracticeMode;
  /** For mode === "slug" */
  slugOrId?: string;
};

function isCompletedOrSkipped(slug: string): boolean {
  const state = useLeetCodeStore.getState();
  const key = slug.toLowerCase();
  return state.completedSlugs.includes(key) || state.skippedSlugs.includes(key);
}

async function pickOaSlug(): Promise<string> {
  for (const slug of AMAZON_OA_SLUGS) {
    if (!isCompletedOrSkipped(slug)) return slug;
  }
  for (const difficulty of ["Medium", "Easy"] as const) {
    for (let skip = 0; skip < 200; skip += 50) {
      const list = await leetcodeListProblems({ difficulty, limit: 50, skip });
      const hit = list.find((i) => !isCompletedOrSkipped(i.titleSlug));
      if (hit) return hit.titleSlug;
      if (list.length < 50) break;
    }
  }
  throw new Error(
    "No remaining free Easy/Medium problems in the Amazon OA pool. Type done reset or invent for AI problems.",
  );
}

async function pickDifficultySlug(
  difficulty: "Easy" | "Medium",
): Promise<string> {
  const available: string[] = [];
  for (let skip = 0; skip < 300; skip += 50) {
    const list = await leetcodeListProblems({ difficulty, limit: 50, skip });
    for (const item of list) {
      if (!isCompletedOrSkipped(item.titleSlug)) {
        available.push(item.titleSlug);
      }
    }
    if (list.length < 50) break;
    if (available.length > 0) break;
  }

  for (const slug of AMAZON_OA_SLUGS) {
    if (available.includes(slug)) return slug;
  }
  if (available[0]) return available[0];

  throw new Error(
    `No remaining free ${difficulty} problems. Type done on finished ones, or try oa / invent.`,
  );
}

export async function fetchAndBuildLcPractice(
  req: LcPracticeRequest,
): Promise<ScaffoldResult & { problem: LeetCodeProblem }> {
  const trySlugs: string[] = [];

  if (req.mode === "slug") {
    const slug = (req.slugOrId ?? "").trim();
    if (!slug) throw new Error("Usage: leetcode <slug-or-id>");
    trySlugs.push(slug);
  } else if (req.mode === "easy") {
    trySlugs.push(await pickDifficultySlug("Easy"));
  } else if (req.mode === "medium") {
    trySlugs.push(await pickDifficultySlug("Medium"));
  } else {
    // Try several OA candidates in case some are premium/removed
    for (const slug of AMAZON_OA_SLUGS) {
      if (!isCompletedOrSkipped(slug)) trySlugs.push(slug);
      if (trySlugs.length >= 12) break;
    }
    if (trySlugs.length === 0) {
      trySlugs.push(await pickOaSlug());
    }
  }

  let lastError: unknown;
  for (const slug of trySlugs) {
    try {
      const problem = await leetcodeGetProblem(slug);
      const scaffold = buildLeetCodeScaffold(problem);
      useLeetCodeStore.getState().setLastSlug(problem.titleSlug);
      return { ...scaffold, problem };
    } catch (err) {
      lastError = err;
      // Skip broken/premium OA entries so the pool keeps moving
      if (req.mode === "oa" || req.mode === "easy" || req.mode === "medium") {
        useLeetCodeStore.getState().markSkipped(slug);
        continue;
      }
      throw err;
    }
  }

  // One more attempt via live list if OA candidates all failed
  if (req.mode === "oa") {
    const fallback = await pickOaSlug();
    const problem = await leetcodeGetProblem(fallback);
    const scaffold = buildLeetCodeScaffold(problem);
    useLeetCodeStore.getState().setLastSlug(problem.titleSlug);
    return { ...scaffold, problem };
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not fetch a LeetCode problem.");
}
