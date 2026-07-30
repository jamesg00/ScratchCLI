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

export type LeetCodeCompanyInfo = {
  name: string;
  slug: string;
  questionCount: number;
  totalFrequency: number;
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

export async function leetcodeListCompanies(): Promise<LeetCodeCompanyInfo[]> {
  return invoke<LeetCodeCompanyInfo[]>("leetcode_list_companies");
}

export async function leetcodeListCompanyProblems(options: {
  companySlug: string;
  difficulty?: "Easy" | "Medium" | "Hard" | "";
  limit?: number;
  skip?: number;
}): Promise<LeetCodeListItem[]> {
  return invoke<LeetCodeListItem[]>("leetcode_list_company_problems", {
    companySlug: options.companySlug,
    difficulty: options.difficulty ?? null,
    limit: options.limit ?? null,
    skip: options.skip ?? null,
  });
}
