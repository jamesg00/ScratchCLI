import type { ReactNode } from "react";

const KEYWORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

const BUILTINS = new Set([
  "abs",
  "all",
  "any",
  "bool",
  "dict",
  "enumerate",
  "filter",
  "float",
  "int",
  "len",
  "list",
  "map",
  "max",
  "min",
  "print",
  "range",
  "set",
  "str",
  "sum",
  "type",
  "zip",
  "open",
  "input",
  "sorted",
  "reversed",
  "isinstance",
  "hasattr",
  "getattr",
  "setattr",
]);

export type PyToken = {
  kind:
    | "text"
    | "keyword"
    | "builtin"
    | "string"
    | "comment"
    | "number"
    | "defname"
    | "className"
    | "operator";
  text: string;
};

export type PyLine = {
  important: boolean;
  tokens: PyToken[];
};

const IMPORTANT_PREFIX = /^#!\s+/;
const IMPORTANT_COMMENT = /#\s*important\b/i;

/** Strip UI markers and classify each source line for highlighting. */
export function parsePythonLines(code: string): PyLine[] {
  return code.split("\n").map((raw) => {
    let important = false;
    let line = raw;
    if (IMPORTANT_PREFIX.test(line)) {
      important = true;
      line = line.replace(IMPORTANT_PREFIX, "");
    } else if (IMPORTANT_COMMENT.test(line)) {
      important = true;
    } else if (/^\s*(return|raise|assert)\b/.test(line)) {
      important = true;
    }
    return { important, tokens: tokenizePythonLine(line) };
  });
}

export function tokenizePythonLine(line: string): PyToken[] {
  const tokens: PyToken[] = [];
  let i = 0;
  let expectName: "def" | "class" | null = null;

  const push = (kind: PyToken["kind"], text: string) => {
    if (!text) return;
    tokens.push({ kind, text });
  };

  while (i < line.length) {
    const ch = line[i]!;

    if (ch === "#") {
      push("comment", line.slice(i));
      break;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      const triple = line.slice(i, i + 3) === quote.repeat(3);
      if (triple) {
        j = i + 3;
        while (j < line.length && line.slice(j, j + 3) !== quote.repeat(3)) {
          if (line[j] === "\\") j += 2;
          else j += 1;
        }
        j = Math.min(line.length, j + 3);
      } else {
        while (j < line.length && line[j] !== quote) {
          if (line[j] === "\\") j += 2;
          else j += 1;
        }
        j = Math.min(line.length, j + 1);
      }
      push("string", line.slice(i, j));
      i = j;
      expectName = null;
      continue;
    }

    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /\s/.test(line[j]!)) j += 1;
      push("text", line.slice(i, j));
      i = j;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(line[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < line.length && /[0-9_.eExXobB]/.test(line[j]!)) j += 1;
      push("number", line.slice(i, j));
      i = j;
      expectName = null;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[A-Za-z0-9_]/.test(line[j]!)) j += 1;
      const word = line.slice(i, j);
      if (expectName === "def") {
        push("defname", word);
        expectName = null;
      } else if (expectName === "class") {
        push("className", word);
        expectName = null;
      } else if (KEYWORDS.has(word)) {
        push("keyword", word);
        expectName = word === "def" || word === "class" ? word : null;
      } else if (BUILTINS.has(word)) {
        push("builtin", word);
        expectName = null;
      } else {
        push("text", word);
        expectName = null;
      }
      i = j;
      continue;
    }

    // operators / punctuation
    let j = i + 1;
    while (
      j < line.length &&
      !/[A-Za-z0-9_\s#'"]/.test(line[j]!) &&
      line[j] !== '"' &&
      line[j] !== "'"
    ) {
      j += 1;
    }
    push("operator", line.slice(i, j));
    i = j;
    expectName = null;
  }

  return tokens;
}

export function renderPythonCode(
  code: string,
  opts?: { blockImportant?: boolean; trailing?: ReactNode },
): ReactNode {
  const lines = parsePythonLines(code);
  return (
    <code className="py-hl">
      {lines.map((line, lineIndex) => (
        <span
          key={lineIndex}
          className={
            line.important || opts?.blockImportant
              ? "py-line is-important"
              : "py-line"
          }
        >
          {line.tokens.map((token, tokenIndex) => (
            <span
              key={tokenIndex}
              className={
                token.kind === "text" ? undefined : `py-tok py-${token.kind}`
              }
            >
              {token.text}
            </span>
          ))}
          {lineIndex < lines.length - 1 ? "\n" : null}
        </span>
      ))}
      {opts?.trailing}
    </code>
  );
}
