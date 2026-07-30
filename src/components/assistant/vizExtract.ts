export type VizScalar = string | number | boolean | null;

export type VizExtractedInputs = {
  arrays: Array<{ name: string; values: VizScalar[] }>;
  strings: string[];
  target?: number;
  k?: number;
  n?: number;
  /**
   * Optional adjacency mapping extracted from a simple dict literal.
   * Example: graph = {"A":["B","C"], "B":["D"]}
   */
  graphAdj?: Record<string, VizScalar[]>;
  /** Human-readable summary, e.g. nums=[1,2,3] target=9 */
  summary: string;
};

function parseLiteral(token: string): VizScalar {
  const t = token.trim();
  if (t === "None" || t === "null") return null;
  if (t === "True" || t === "true") return true;
  if (t === "False" || t === "false") return false;
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  const num = Number(t);
  if (t !== "" && Number.isFinite(num)) return num;
  return t;
}

/** Split a Python list body on commas, respecting nested [] and quotes. */
function splitListItems(body: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let inQuote: '"' | "'" | null = null;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (inQuote) {
      if (ch === inQuote && body[i - 1] !== "\\") inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === "[") depth += 1;
    else if (ch === "]") depth -= 1;
    else if (ch === "," && depth === 0) {
      items.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = body.slice(start).trim();
  if (last) items.push(last);
  return items.filter(Boolean);
}

function parseListLiteral(source: string): VizScalar[] | null {
  const trimmed = source.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  const body = trimmed.slice(1, -1).trim();
  if (!body) return [];
  // Skip nested/complex lists for v1 (e.g. [[1,2],[3,4]])
  if (body.includes("[")) return null;
  return splitListItems(body).map(parseLiteral);
}

function findMatchingBracket(text: string, openIdx: number): number {
  let depth = 0;
  let inQuote: '"' | "'" | null = null;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuote) {
      if (ch === inQuote && text[i - 1] !== "\\") inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingCurlyBrace(text: string, openIdx: number): number {
  let depth = 0;
  let inQuote: '"' | "'" | null = null;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inQuote) {
      if (ch === inQuote && text[i - 1] !== "\\") inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractSimpleAdjacencyDict(
  buffer: string,
): Record<string, VizScalar[]> | undefined {
  // Look for: something = { ... }
  const re = /\b([A-Za-z_]\w*)\s*=\s*\{/g;
  let match: RegExpExecArray | null;
  let tries = 0;
  while ((match = re.exec(buffer)) !== null && tries < 6) {
    tries += 1;
    const openIdx = match.index + match[0].length - 1; // at "{"
    const closeIdx = findMatchingCurlyBrace(buffer, openIdx);
    if (closeIdx < 0) continue;
    const dictLit = buffer.slice(openIdx, closeIdx + 1);
    if (!dictLit.includes(":") || !dictLit.includes("[")) continue;

    // Parse top-level entries as: key : [ ... ]
    const body = dictLit.slice(1, -1).trim();
    if (!body) continue;

    const entries: string[] = [];
    let inQuote: '"' | "'" | null = null;
    let bracketDepth = 0;
    let start = 0;
    for (let i = 0; i < body.length; i += 1) {
      const ch = body[i]!;
      if (inQuote) {
        if (ch === inQuote && body[i - 1] !== "\\") inQuote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        continue;
      }
      if (ch === "[") bracketDepth += 1;
      else if (ch === "]") bracketDepth -= 1;

      if (ch === "," && bracketDepth === 0) {
        entries.push(body.slice(start, i).trim());
        start = i + 1;
      }
    }
    const last = body.slice(start).trim();
    if (last) entries.push(last);
    if (entries.length === 0) continue;

    const adjacency: Record<string, VizScalar[]> = {};
    let totalEdges = 0;
    let ok = true;

    for (const entry of entries) {
      const colonIdx = (() => {
        // Find first ':' not inside quotes/brackets.
        let q: '"' | "'" | null = null;
        let depth = 0;
        for (let i = 0; i < entry.length; i += 1) {
          const ch = entry[i]!;
          if (q) {
            if (ch === q && entry[i - 1] !== "\\") q = null;
            continue;
          }
          if (ch === '"' || ch === "'") {
            q = ch;
            continue;
          }
          if (ch === "[") depth += 1;
          else if (ch === "]") depth -= 1;
          if (ch === ":" && depth === 0) return i;
        }
        return -1;
      })();

      if (colonIdx < 0) {
        ok = false;
        break;
      }
      const keyPart = entry.slice(0, colonIdx).trim();
      const valuePart = entry.slice(colonIdx + 1).trim();

      const key = (() => {
        if (
          (keyPart.startsWith('"') && keyPart.endsWith('"')) ||
          (keyPart.startsWith("'") && keyPart.endsWith("'"))
        ) {
          return keyPart.slice(1, -1);
        }
        // bare identifier / number
        const m = keyPart.match(/^[A-Za-z_]\w*$/) ?? keyPart.match(/^-?\d+$/);
        if (!m) return null;
        return keyPart;
      })();

      if (!key) {
        ok = false;
        break;
      }

      const neighbors = parseListLiteral(valuePart);
      if (!neighbors) {
        ok = false;
        break;
      }
      if (neighbors.length > 24) {
        ok = false;
        break;
      }
      adjacency[key] = neighbors;
      totalEdges += neighbors.length;
    }

    if (!ok) continue;
    if (totalEdges === 0) continue;
    if (Object.keys(adjacency).length > 16) continue;
    if (totalEdges > 64) continue;

    return adjacency;
  }
  return undefined;
}

function extractNamedLists(
  buffer: string,
): Array<{ name: string; values: VizScalar[] }> {
  const found: Array<{ name: string; values: VizScalar[] }> = [];
  const re = /\b([A-Za-z_][\w]*)\s*=\s*\[/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(buffer)) !== null) {
    const name = match[1];
    const openIdx = match.index + match[0].length - 1;
    const closeIdx = findMatchingBracket(buffer, openIdx);
    if (closeIdx < 0) continue;
    const lit = buffer.slice(openIdx, closeIdx + 1);
    const values = parseListLiteral(lit);
    if (values && values.length > 0 && values.length <= 24) {
      found.push({ name, values });
    }
  }
  return found;
}

function extractAssertLists(
  buffer: string,
): Array<{ name: string; values: VizScalar[] }> {
  const found: Array<{ name: string; values: VizScalar[] }> = [];
  const lines = buffer.split(/\r?\n/);
  for (const line of lines) {
    if (!/(?:assert|check|case|PASS|FAIL|print)\b/i.test(line)) continue;
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] !== "[") continue;
      const closeIdx = findMatchingBracket(line, i);
      if (closeIdx < 0) continue;
      const lit = line.slice(i, closeIdx + 1);
      const values = parseListLiteral(lit);
      if (values && values.length > 0 && values.length <= 24) {
        found.push({ name: `arg${found.length}`, values });
      }
      i = closeIdx;
    }
  }
  return found;
}

function extractStrings(buffer: string): string[] {
  const found: string[] = [];
  const re = /(["'])(?:(?!\1)[^\\\n]|\\.)*\1/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(buffer)) !== null) {
    const raw = match[0];
    const value = raw.slice(1, -1);
    // Prefer short algorithmic strings (parens, words), skip long prose/docstrings
    if (value.length >= 1 && value.length <= 32 && !/\n/.test(value)) {
      // Skip obvious non-inputs
      if (/^(pass|fail|true|false|none)$/i.test(value)) continue;
      if (value.includes("FILE:") || value.includes("Problem")) continue;
      found.push(value);
    }
  }
  // Prefer strings that look like paren problems or contain mixed chars
  const scored = [...new Set(found)].sort((a, b) => {
    const score = (s: string) =>
      (/[()[\]{}]/.test(s) ? 10 : 0) + (/[aeiou]/i.test(s) ? 2 : 0) + s.length;
    return score(b) - score(a);
  });
  return scored.slice(0, 6);
}

function extractNumberAssign(
  buffer: string,
  names: string[],
): number | undefined {
  for (const name of names) {
    const re = new RegExp(`\\b${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`, "i");
    const match = buffer.match(re);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function extractTargetFromCall(buffer: string): number | undefined {
  // e.g. two_sum(nums, 9) or fn([1,2,3], 9)
  const call = buffer.match(
    /\b\w+\s*\(\s*(?:\[[^\]]*\]|[A-Za-z_]\w*)\s*,\s*(-?\d+)\s*\)/,
  );
  if (call) {
    const n = Number(call[1]);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function preferArrayName(
  arrays: Array<{ name: string; values: VizScalar[] }>,
): Array<{ name: string; values: VizScalar[] }> {
  const preferred = [
    "nums",
    "arr",
    "a",
    "array",
    "values",
    "items",
    "data",
    "heights",
    "prices",
  ];
  return [...arrays].sort((a, b) => {
    const ai = preferred.indexOf(a.name.toLowerCase());
    const bi = preferred.indexOf(b.name.toLowerCase());
    const as = ai === -1 ? 99 : ai;
    const bs = bi === -1 ? 99 : bi;
    if (as !== bs) return as - bs;
    return b.values.length - a.values.length;
  });
}

/** Pull sample arrays / strings / scalars from a Python-ish buffer (no execution). */
export function extractVizInputs(buffer: string): VizExtractedInputs | null {
  if (!buffer.trim()) return null;

  const arrays = preferArrayName([
    ...extractNamedLists(buffer),
    ...extractAssertLists(buffer),
  ]);
  // Dedupe by serialized values
  const seen = new Set<string>();
  const uniqueArrays = arrays.filter((item) => {
    const key = JSON.stringify(item.values);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const strings = extractStrings(buffer);
  const target =
    extractNumberAssign(buffer, ["target", "t"]) ??
    extractTargetFromCall(buffer);
  const k = extractNumberAssign(buffer, ["k", "window", "window_size"]);
  const n = extractNumberAssign(buffer, ["n", "N"]);

  const graphAdj = extractSimpleAdjacencyDict(buffer);

  if (uniqueArrays.length === 0 && strings.length === 0) {
    // Scalars alone aren't enough to seed a walkthrough
    if (target === undefined && k === undefined && n === undefined) return null;
  }

  if (uniqueArrays.length === 0 && strings.length === 0) return null;

  const parts: string[] = [];
  if (uniqueArrays[0]) {
    parts.push(
      `${uniqueArrays[0].name}=[${uniqueArrays[0].values.slice(0, 12).join(",")}${
        uniqueArrays[0].values.length > 12 ? ",…" : ""
      }]`,
    );
  }
  if (strings[0] && !uniqueArrays[0]) {
    parts.push(`s=${JSON.stringify(strings[0])}`);
  } else if (strings[0] && /[()[\]{}]/.test(strings[0])) {
    parts.push(`s=${JSON.stringify(strings[0])}`);
  }
  if (target !== undefined) parts.push(`target=${target}`);
  if (k !== undefined) parts.push(`k=${k}`);
  if (n !== undefined) parts.push(`n=${n}`);

  return {
    arrays: uniqueArrays.slice(0, 4),
    strings: strings.slice(0, 4),
    target,
    k,
    n,
    graphAdj,
    summary: parts.join(" ") || "extracted inputs",
  };
}

export function primaryArray(
  inputs: VizExtractedInputs,
): { name: string; values: VizScalar[] } | null {
  return inputs.arrays[0] ?? null;
}

export function primaryString(inputs: VizExtractedInputs): string | null {
  return inputs.strings[0] ?? null;
}
