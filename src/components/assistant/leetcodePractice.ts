/** Build a local practice .py from a LeetCode GraphQL problem payload. */

import type { PracticeFile } from "./practiceFile";
import type { LeetCodeProblem } from "../../services/leetcode";
import { toPythonLiteral } from "./sealPracticeTests";

export type ParsedExample = {
  /** Ordered arg values matching the solution method params when possible. */
  args: unknown[];
  /** Named bindings from the Input: line (for kwargs-style harness). */
  bindings: Record<string, unknown>;
  expected: unknown;
  rawInput: string;
  rawOutput: string;
};

export type ScaffoldResult = {
  file: PracticeFile;
  warnings: string[];
};

const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** Strip LeetCode HTML content to readable plain text. */
export function htmlToPlainText(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/?pre[^>]*>/gi, "\n")
    .replace(/<\/?code[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "");
  text = text.replace(
    /&(?:nbsp|lt|gt|amp|quot|apos|#39);/gi,
    (m) => ENTITY_MAP[m.toLowerCase()] ?? m,
  );
  text = text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tryParseValue(raw: string): unknown {
  const t = raw.trim();
  if (!t) return t;
  if (t === "null" || t === "None") return null;
  if (t === "true" || t === "True") return true;
  if (t === "false" || t === "False") return false;
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    try {
      return JSON.parse(t.replace(/^'/, '"').replace(/'$/, '"'));
    } catch {
      return t.slice(1, -1);
    }
  }
  const asJson = t
    .replace(/\bNone\b/g, "null")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/'/g, '"');
  try {
    return JSON.parse(asJson);
  } catch {
    const num = Number(t);
    if (t !== "" && Number.isFinite(num)) return num;
    return t;
  }
}

/** Split `a = 1, b = [2, 3], c = "x"` on top-level commas. */
function splitTopLevelComma(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inStr: '"' | "'" | null = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inStr) {
      if (ch === inStr && s[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "[" || ch === "{" || ch === "(") depth += 1;
    else if (ch === "]" || ch === "}" || ch === ")") depth -= 1;
    else if (ch === "," && depth === 0) {
      parts.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(s.slice(start).trim());
  return parts.filter(Boolean);
}

export function parseInputBindings(inputLine: string): Record<string, unknown> {
  const bindings: Record<string, unknown> = {};
  for (const part of splitTopLevelComma(inputLine)) {
    const m = part.match(/^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/);
    if (!m) continue;
    bindings[m[1]!] = tryParseValue(m[2]!);
  }
  return bindings;
}

/** Pull Input/Output pairs from plain problem text. */
export function parseExamplesFromText(plain: string): ParsedExample[] {
  const examples: ParsedExample[] = [];
  const re =
    /Example\s*\d*\s*:?\s*([\s\S]*?)(?=Example\s*\d*\s*:|Constraints:|Follow-up:|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(plain)) !== null) {
    const block = match[1] ?? "";
    const inputMatch = block.match(/Input:\s*([^\n]+)/i);
    const outputMatch = block.match(/Output:\s*([^\n]+)/i);
    if (!inputMatch || !outputMatch) continue;
    const rawInput = inputMatch[1]!.trim();
    const rawOutput = outputMatch[1]!.trim();
    const bindings = parseInputBindings(rawInput);
    const expected = tryParseValue(rawOutput);
    examples.push({
      args: Object.values(bindings),
      bindings,
      expected,
      rawInput,
      rawOutput,
    });
  }
  return examples;
}

export function stubSolutionCode(code: string): string {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const defMatch = line.match(
      /^(\s*)def\s+(\w+)\s*\(.*\)\s*(->\s*.+)?\s*:\s*$/,
    );
    if (defMatch) {
      out.push(line);
      const indent = defMatch[1] ?? "";
      const bodyIndent = `${indent}    `;
      i += 1;
      while (i < lines.length) {
        const body = lines[i]!;
        if (body.trim() === "") {
          i += 1;
          continue;
        }
        const leading = body.match(/^\s*/)?.[0]?.length ?? 0;
        if (leading > indent.length) {
          i += 1;
          continue;
        }
        break;
      }
      out.push(`${bodyIndent}pass`);
      continue;
    }
    out.push(line);
    i += 1;
  }
  let result = out.join("\n").trimEnd();
  if (!/class\s+Solution\b/.test(result) && !/\bdef\s+\w+\s*\(/.test(result)) {
    result = `class Solution:\n    def solve(self):\n        pass`;
  }
  return result + "\n";
}

function findMethodName(code: string): string | null {
  const methods = [...code.matchAll(/^\s*def\s+(\w+)\s*\(/gm)].map(
    (m) => m[1]!,
  );
  const skip = new Set(["__init__", "__str__", "__repr__"]);
  return methods.find((m) => !skip.has(m)) ?? null;
}

function findParamNames(code: string, method: string): string[] {
  const re = new RegExp(`def\\s+${method}\\s*\\(([^)]*)\\)`, "m");
  const m = code.match(re);
  if (!m) return [];
  return m[1]!
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split(":")[0]!.trim())
    .filter((p) => p && p !== "self");
}

function orderArgs(
  bindings: Record<string, unknown>,
  paramNames: string[],
): unknown[] {
  if (paramNames.length && paramNames.every((p) => p in bindings)) {
    return paramNames.map((p) => bindings[p]);
  }
  return Object.values(bindings);
}

export function buildLeetCodeScaffold(
  problem: LeetCodeProblem,
): ScaffoldResult {
  const warnings: string[] = [];
  const plain = htmlToPlainText(problem.content || "");
  const examples = parseExamplesFromText(plain);
  const pySnippet =
    problem.codeSnippets.find((s) => s.langSlug === "python3") ??
    problem.codeSnippets.find((s) => s.langSlug === "python");
  if (!pySnippet) {
    warnings.push(
      "No Python snippet from LeetCode — using a bare Solution stub.",
    );
  }
  const stub = stubSolutionCode(
    pySnippet?.code ?? "class Solution:\n    def solve(self):\n        pass\n",
  );
  const method = findMethodName(stub) ?? "solve";
  const params = findParamNames(stub, method);

  const fileName = `${problem.titleSlug.replace(/-/g, "_")}.py`;
  const tags = problem.topicTags.join(", ") || "—";
  const docBody = [
    `LeetCode ${problem.frontendId}. ${problem.title}`,
    `Difficulty: ${problem.difficulty}`,
    `Tags: ${tags}`,
    `URL: ${problem.url}`,
    "",
    plain.slice(0, 6000),
    "",
    "Local tests use official examples only. Submit on LeetCode for the full judge.",
  ].join("\n");

  let harness = "";
  if (examples.length === 0) {
    warnings.push(
      "Could not parse Input/Output examples — stub only. Open the URL for samples.",
    );
    harness = `if __name__ == "__main__":
    print("No local examples parsed. Solve in-editor, then submit on LeetCode:")
    print(${JSON.stringify(problem.url)})
`;
  } else {
    const caseLines = examples.map((ex) => {
      const args = orderArgs(ex.bindings, params);
      return `        (${toPythonLiteral(args)}, ${toPythonLiteral(ex.expected)}),`;
    });
    harness = `if __name__ == "__main__":
    # Official examples only — full tests: ${problem.url}
    test_cases = [
${caseLines.join("\n")}
    ]
    passed = 0
    sol = Solution()
    for i, (args, expected) in enumerate(test_cases, 1):
        try:
            result = getattr(sol, ${JSON.stringify(method)})(*args)
            if result == expected:
                print(f"Test {i}: PASS")
                passed += 1
            else:
                print(f"Test {i}: FAIL (got {result!r}, expected {expected!r})")
        except Exception as e:
            print(f"Test {i}: FAIL ({e})")
    print(f"{passed}/{len(test_cases)} tests passed")
    print("Submit on LeetCode for the full test suite.")
`;
  }

  const content = `# FILE: ${fileName}
# LC: ${problem.titleSlug}
"""
${docBody}
"""

from typing import List, Optional, Dict, Set, Tuple

${stub}
${harness}`;

  return {
    file: { fileName, content: content.trimEnd() + "\n" },
    warnings,
  };
}
