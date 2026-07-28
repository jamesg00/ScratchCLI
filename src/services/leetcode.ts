import { invoke } from "@tauri-apps/api/core";

export type LeetCodeListItem = {
  title: string;
  titleSlug: string;
  difficulty: string;
  paidOnly: boolean;
  frontendId: string;
  topicTags: string[];
};

export type LeetCodeCodeSnippet = {
  lang: string;
  langSlug: string;
  code: string;
};

export type LeetCodeProblem = {
  title: string;
  titleSlug: string;
  difficulty: string;
  frontendId: string;
  content: string;
  paidOnly: boolean;
  exampleTestcaseList: string[];
  codeSnippets: LeetCodeCodeSnippet[];
  topicTags: string[];
  metaData?: string | null;
  url: string;
};

export async function leetcodeListProblems(options?: {
  difficulty?: "Easy" | "Medium" | "Hard" | "";
  limit?: number;
  skip?: number;
}): Promise<LeetCodeListItem[]> {
  return invoke<LeetCodeListItem[]>("leetcode_list_problems", {
    difficulty: options?.difficulty ?? null,
    limit: options?.limit ?? null,
    skip: options?.skip ?? null,
  });
}

export async function leetcodeGetProblem(
  titleSlug: string,
): Promise<LeetCodeProblem> {
  return invoke<LeetCodeProblem>("leetcode_get_problem", {
    titleSlug,
  });
}
