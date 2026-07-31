/** Pick next LeetCode problem from a chosen company pool or difficulty list and build a scaffold. */

import {
  leetcodeGetProblem,
  leetcodeListCompanyProblems,
  leetcodeListProblems,
  type LeetCodeProblem,
} from "../../services/leetcode";
import { useLeetCodeStore } from "../../stores/leetcodeStore";
import { buildLeetCodeScaffold, type ScaffoldResult } from "./leetcodePractice";

export type LcPracticeMode = "easy" | "medium" | "oa" | "slug" | "company";

export type LcPracticeRequest = {
  kind: "leetcode";
  mode: LcPracticeMode;
  /** For mode === "slug" */
  slugOrId?: string;
  companySlug?: string;
};

function requireOfficialCases(scaffold: ScaffoldResult): ScaffoldResult {
  if (scaffold.officialCaseCount >= 1) return scaffold;
  throw new Error(
    `LeetCode exposes no parseable official examples for this problem. Choose another problem or type invent.`,
  );
}

function isCompletedOrSkipped(slug: string): boolean {
  const state = useLeetCodeStore.getState();
  const key = slug.toLowerCase();
  return state.completedSlugs.includes(key) || state.skippedSlugs.includes(key);
}

async function pickCompanySlug(options?: {
  companySlug?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
}): Promise<string> {
  const companySlug =
    options?.companySlug || useLeetCodeStore.getState().preferredCompanySlug;
  for (let skip = 0; skip < 300; skip += 50) {
    const list = await leetcodeListCompanyProblems({
      companySlug,
      difficulty: options?.difficulty ?? "",
      limit: 50,
      skip,
    });
    const hit = list.find((item) => !isCompletedOrSkipped(item.titleSlug));
    if (hit) return hit.titleSlug;
    if (list.length < 50) break;
  }
  throw new Error(
    `No remaining free ${
      options?.difficulty ?? "company"
    } problems for ${companySlug}. Try company <name>, done reset, or invent.`,
  );
}

async function pickDifficultySlug(
  difficulty: "Easy" | "Medium",
): Promise<string> {
  try {
    return await pickCompanySlug({ difficulty });
  } catch {
    for (let skip = 0; skip < 300; skip += 50) {
      const list = await leetcodeListProblems({ difficulty, limit: 50, skip });
      const hit = list.find((item) => !isCompletedOrSkipped(item.titleSlug));
      if (hit) return hit.titleSlug;
      if (list.length < 50) break;
    }
    throw new Error(
      `No remaining free ${difficulty} problems. Type done on finished ones, company <name>, or invent.`,
    );
  }
}

export async function fetchAndBuildLcPractice(
  req: LcPracticeRequest,
): Promise<ScaffoldResult & { problem: LeetCodeProblem }> {
  const maxAttempts =
    req.mode === "slug"
      ? 1
      : req.mode === "easy" || req.mode === "medium"
        ? 8
        : 6;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let slug: string;
    try {
      if (req.mode === "slug") {
        slug = (req.slugOrId ?? "").trim();
        if (!slug) throw new Error("Usage: leetcode <slug-or-id>");
      } else if (req.mode === "easy") {
        slug = await pickDifficultySlug("Easy");
      } else if (req.mode === "medium") {
        slug = await pickDifficultySlug("Medium");
      } else if (req.mode === "company") {
        slug = await pickCompanySlug({ companySlug: req.companySlug });
      } else {
        slug = await pickCompanySlug();
      }
    } catch (err) {
      lastError = err;
      break;
    }

    try {
      const problem = await leetcodeGetProblem(slug);
      const scaffold = requireOfficialCases(buildLeetCodeScaffold(problem));
      useLeetCodeStore.getState().setLastSlug(problem.titleSlug);
      return { ...scaffold, problem };
    } catch (err) {
      lastError = err;
      if (req.mode === "slug") throw err;
      useLeetCodeStore.getState().markSkipped(slug);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not fetch a LeetCode problem.");
}
