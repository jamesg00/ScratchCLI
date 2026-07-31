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
  /** Cases with both an official LeetCode input and expected output. */
  officialCaseCount: number;
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
    .replace(/Example\s*(\d*)\s*:\s*\n+/g, (_, n) => `Example ${n || ""}:\n`)
    .replace(/\n+(Input:|Output:|Explanation:)/g, "\n$1")
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

type ParamAnn = { name: string; type: string };

function findParamAnnotations(code: string, method: string): ParamAnn[] {
  const re = new RegExp(`def\\s+${method}\\s*\\(([^)]*)\\)`, "m");
  const m = code.match(re);
  if (!m) return [];
  return m[1]!
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [namePart, ...typeParts] = p.split(":");
      const name = (namePart ?? "").trim();
      const type = typeParts.join(":").split("=")[0]?.trim() ?? "";
      return { name, type };
    })
    .filter((p) => p.name && p.name !== "self");
}

function findReturnType(code: string, method: string): string {
  const re = new RegExp(
    `def\\s+${method}\\s*\\([^)]*\\)\\s*(?:->\\s*([^:]+))?\\s*:`,
    "m",
  );
  return code.match(re)?.[1]?.trim() ?? "";
}

function usesType(type: string, name: "ListNode" | "TreeNode"): boolean {
  return new RegExp(`\\b${name}\\b`).test(type);
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

const LIST_NODE_HELPERS = `# Definition for singly-linked list (LeetCode).
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


def _to_listnode(vals):
    if vals is None:
        return None
    if isinstance(vals, ListNode):
        return vals
    if not isinstance(vals, list):
        raise TypeError(f"expected list for ListNode, got {type(vals)!r}")
    dummy = ListNode(0)
    cur = dummy
    for v in vals:
        cur.next = ListNode(v)
        cur = cur.next
    return dummy.next


def _from_listnode(node):
    out = []
    while node is not None:
        out.append(node.val)
        node = node.next
    return out
`;

const TREE_NODE_HELPERS = `# Definition for a binary tree node (LeetCode).
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def _to_treenode(vals):
    if vals is None or vals == []:
        return None
    if isinstance(vals, TreeNode):
        return vals
    if not isinstance(vals, list):
        raise TypeError(f"expected list for TreeNode, got {type(vals)!r}")
    root = TreeNode(vals[0])
    queue = [root]
    i = 1
    while queue and i < len(vals):
        node = queue.pop(0)
        if i < len(vals) and vals[i] is not None:
            node.left = TreeNode(vals[i])
            queue.append(node.left)
        i += 1
        if i < len(vals) and vals[i] is not None:
            node.right = TreeNode(vals[i])
            queue.append(node.right)
        i += 1
    return root


def _from_treenode(root):
    if root is None:
        return []
    out = []
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out
`;

function buildTypedHarness(options: {
  url: string;
  method: string;
  params: Array<{ name: string; type: string }>;
  returnType: string;
  caseLines: string[];
}): string {
  const { url, method, params, returnType, caseLines } = options;
  const argConverters = params.map((p, index) => {
    if (usesType(p.type, "ListNode")) {
      return `_to_listnode(args[${index}])`;
    }
    if (usesType(p.type, "TreeNode")) {
      return `_to_treenode(args[${index}])`;
    }
    return `args[${index}]`;
  });
  const callArgs = argConverters.join(", ");
  let compareBlock: string;
  if (usesType(returnType, "ListNode")) {
    compareBlock = `got = _from_listnode(result)
            if got == expected:`;
  } else if (usesType(returnType, "TreeNode")) {
    compareBlock = `got = _from_treenode(result)
            if got == expected:`;
  } else {
    compareBlock = `got = result
            if got == expected:`;
  }

  return `if __name__ == "__main__":
    # Official LeetCode examples: ${url}
    CASES = [
${caseLines.join("\n")}
    ]
    passed = 0
    sol = Solution()
    for i, (args, expected) in enumerate(CASES, 1):
        try:
            result = getattr(sol, ${JSON.stringify(method)})(${callArgs})
            ${compareBlock}
                print(f"Test {i}: PASS (input {args!r})")
                passed += 1
            else:
                print(f"Test {i}: FAIL (input {args!r}; got {got!r}, expected {expected!r})")
        except Exception as e:
            print(f"Test {i}: FAIL (input {args!r}; {e})")
    print(f"{passed}/{len(CASES)} tests passed")
`;
}

export function buildLeetCodeScaffold(
  problem: LeetCodeProblem,
): ScaffoldResult {
  const warnings: string[] = [];
  const plain = htmlToPlainText(problem.content || "");
  const examples = parseExamplesFromText(plain);
  const officialInputCount = problem.exampleTestcaseList.filter(Boolean).length;
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
  const params = findParamAnnotations(stub, method);
  const returnType = findReturnType(stub, method);
  const needsListNode =
    /\bListNode\b/.test(stub) ||
    params.some((p) => usesType(p.type, "ListNode")) ||
    usesType(returnType, "ListNode");
  const needsTreeNode =
    /\bTreeNode\b/.test(stub) ||
    params.some((p) => usesType(p.type, "TreeNode")) ||
    usesType(returnType, "TreeNode");

  const fileName = `${problem.titleSlug.replace(/-/g, "_")}.py`;
  const tags = problem.topicTags.join(", ") || "—";
  const conciseExamples =
    examples.length > 0
      ? [
          "Examples:",
          ...examples
            .slice(0, 4)
            .map(
              (ex, index) =>
                `- ${index + 1}. ${ex.rawInput} -> ${ex.rawOutput}`,
            ),
          "",
        ].join("\n")
      : "";
  const docBody = [
    `LeetCode ${problem.frontendId}. ${problem.title}`,
    `Difficulty: ${problem.difficulty}`,
    `Tags: ${tags}`,
    `URL: ${problem.url}`,
    "",
    conciseExamples,
    plain.slice(0, 6000),
    "",
    "Local submit accepts when every explicit case in this file passes (official example counts vary by problem).",
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
    if (officialInputCount > examples.length) {
      warnings.push(
        `LeetCode supplied ${officialInputCount} official input(s), but only ${examples.length} had parseable expected output(s). The unmatched inputs were not added as tests so ScratchCLI never invents an expected answer.`,
      );
    }
    if (examples.length < 2) {
      warnings.push(
        `Only ${examples.length} parseable official example(s). Consider adding another edge case to CASES for stronger local coverage.`,
      );
    }
    const paramNames = params.map((p) => p.name);
    const caseLines = examples.map((ex) => {
      const args = orderArgs(ex.bindings, paramNames);
      return `        (${toPythonLiteral(args)}, ${toPythonLiteral(ex.expected)}),`;
    });
    harness = buildTypedHarness({
      url: problem.url,
      method,
      params,
      returnType,
      caseLines,
    });
  }

  const helpers = [
    needsListNode ? LIST_NODE_HELPERS : "",
    needsTreeNode ? TREE_NODE_HELPERS : "",
  ]
    .filter(Boolean)
    .join("\n");

  const content = `# FILE: ${fileName}
# LC: ${problem.titleSlug}
"""
${docBody}
"""

from typing import List, Optional, Dict, Set, Tuple

${helpers}${stub}
${harness}`;

  return {
    file: { fileName, content: content.trimEnd() + "\n" },
    warnings,
    officialCaseCount: examples.length,
  };
}
