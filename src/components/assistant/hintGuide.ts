/** Progressive hint guidance: comments in the user's buffer, never auto-complete solutions. */

export const HINT_COMMENT_PREFIX = "# HINT:";

export type HintGuideResult = {
  annotated: string;
  hintCount: number;
};

const HINT_LINE = /^\s*#\s*HINT\s*:\s*(.+)$/i;
const GUIDE_LINE = /^\s*#\s*(HINT|TODO|NOTE|FIXME|TIP)\s*:\s*(.+)$/i;

/** Strip comments / blank lines so we can compare “real” code. */
export function codeSkeleton(src: string): string {
  return src
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return "";
      const hash = line.indexOf("#");
      if (hash >= 0) {
        const before = line.slice(0, hash);
        const quotes = (before.match(/["']/g) ?? []).length;
        if (quotes % 2 === 0) return before.trimEnd();
      }
      return line.trimEnd();
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeWs(s: string): string {
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * True when annotated code only adds comments / blank lines — no logic rewrite.
 */
export function isGuideOnlyAnnotation(
  original: string,
  annotated: string,
): boolean {
  if (!annotated.trim()) return false;
  const a = normalizeWs(codeSkeleton(original));
  const b = normalizeWs(codeSkeleton(annotated));
  if (!a) {
    return b.length <= a.length + 40;
  }
  return a === b;
}

export function countHintComments(src: string): number {
  return src.split(/\r?\n/).filter((line) => HINT_LINE.test(line)).length;
}

/** Remove prior ScratchCLI `# HINT:` lines so a new hint pass replaces them. */
export function stripHintComments(src: string): string {
  const endedWithNl = /\r?\n$/.test(src);
  const out = src
    .split(/\r?\n/)
    .filter((line) => !HINT_LINE.test(line))
    .join("\n");
  if (!out) return endedWithNl ? "\n" : "";
  return endedWithNl && !out.endsWith("\n") ? `${out}\n` : out;
}

/** Pull the best python fence from a coach reply (or null). */
export function extractPythonFence(reply: string): string | null {
  const re = /```(?:python|py)?\s*\n([\s\S]*?)```/gi;
  let best: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(reply)) !== null) {
    const body = match[1]?.trim() ?? "";
    if (!best || body.length > best.length) best = body;
  }
  return best;
}

/**
 * If the reply is a guide-only annotated copy of `original`, return it.
 * Prefer mergeHintCommentsIntoBuffer for applying — do not replace the whole file.
 */
export function extractGuideAnnotation(
  reply: string,
  original: string,
): HintGuideResult | null {
  const fenced = extractPythonFence(reply);
  if (!fenced) return null;
  if (!isGuideOnlyAnnotation(original, fenced)) return null;
  const hintCount = countHintComments(fenced);
  if (hintCount === 0 && !/\bHINT\b/i.test(fenced)) {
    const guides = fenced
      .split(/\r?\n/)
      .filter((l) => GUIDE_LINE.test(l)).length;
    if (guides === 0) return null;
  }
  return {
    annotated: fenced.endsWith("\n") ? fenced : `${fenced}\n`,
    hintCount,
  };
}

/**
 * Take HINT comments from an annotated copy and inject them into `original`
 * (matched by following code line). Never replaces the user's file wholesale.
 */
export function mergeHintCommentsIntoBuffer(
  original: string,
  annotated: string,
): HintGuideResult | null {
  if (!isGuideOnlyAnnotation(original, annotated)) return null;

  const annLines = annotated.split(/\r?\n/);
  const byCodeLine = new Map<string, string[]>();
  let pending: string[] = [];
  for (const line of annLines) {
    const hint = line.match(HINT_LINE) ?? line.match(GUIDE_LINE);
    if (hint) {
      const text = (hint[hint.length - 1] ?? "").trim();
      if (text) pending.push(text);
      continue;
    }
    const skel = normalizeWs(codeSkeleton(line));
    if (!skel) continue;
    if (pending.length) {
      const list = byCodeLine.get(skel) ?? [];
      list.push(...pending);
      byCodeLine.set(skel, list);
      pending = [];
    }
  }
  if (byCodeLine.size === 0) return null;

  const origLines = original.split(/\r?\n/);
  const out: string[] = [];
  let added = 0;
  const used = new Set<string>();
  for (const line of origLines) {
    const skel = normalizeWs(codeSkeleton(line));
    if (skel && byCodeLine.has(skel) && !used.has(skel)) {
      used.add(skel);
      const indent = line.match(/^\s*/)?.[0] ?? "";
      for (const msg of byCodeLine.get(skel)!) {
        out.push(`${indent}${HINT_COMMENT_PREFIX} ${msg}`);
        added += 1;
      }
    }
    out.push(line);
  }
  if (added === 0) return null;
  const annotatedOut = out.join("\n");
  return {
    annotated: annotatedOut.endsWith("\n") ? annotatedOut : `${annotatedOut}\n`,
    hintCount: added,
  };
}

/**
 * Parse `L12: message` / `line 12: message` and inject `# HINT:` above those lines.
 */
export function applyLineNumberHints(
  original: string,
  reply: string,
): HintGuideResult | null {
  const hints = new Map<number, string[]>();
  for (const rawLine of reply.split(/\r?\n/)) {
    const line = rawLine
      .replace(/^\s*(?:[-*]|\d+[.)])\s+/, "")
      .replace(/\*\*/g, "");
    const m =
      line.match(/^\s*(?:L|line)\s*(\d+)\s*[:\-–—]\s*(.+)$/i) ??
      line.match(/^\s*(\d+)\s*[:\-–—]\s*(.+)$/);
    if (!m) continue;
    const n = Number(m[1]);
    const text = (m[2] ?? "").trim();
    if (!Number.isFinite(n) || n < 1 || !text) continue;
    if (/^def\s+|return\s+|for\s+\w+\s+in/.test(text)) continue;
    if (text.startsWith("```")) continue;
    const list = hints.get(n) ?? [];
    list.push(text.replace(/^#\s*HINT\s*:\s*/i, "").trim());
    hints.set(n, list);
  }
  if (hints.size === 0) return null;

  const lines = original.split(/\r?\n/);
  const out: string[] = [];
  let added = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const msgs = hints.get(lineNo);
    if (msgs) {
      const indent = lines[i]!.match(/^\s*/)?.[0] ?? "";
      for (const msg of msgs) {
        out.push(`${indent}${HINT_COMMENT_PREFIX} ${msg}`);
        added += 1;
      }
    }
    out.push(lines[i]!);
  }
  if (added === 0) return null;
  const annotated = out.join("\n");
  const withNl = annotated.endsWith("\n") ? annotated : `${annotated}\n`;
  return { annotated: withNl, hintCount: added };
}

/** Build the coach prompt for hint / review / advice (guide-only). */
export function buildHintGuidePrompt(opts: {
  mode: "hint" | "review" | "advice";
  focus?: string;
  buffer: string;
}): string {
  const focus = opts.focus?.trim();
  const modeLabel =
    opts.mode === "review"
      ? "code review with progressive hints"
      : "progressive hints";

  return [
    `Give me ${modeLabel} on my CURRENT editor attempt — coach me WITHOUT solving it.`,
    focus ? `Focus: ${focus}.` : "",
    "",
    "STRICT RULES (must follow):",
    "1) Do NOT write the correct algorithm, do NOT replace `pass`, do NOT complete my functions.",
    "2) Do NOT paste my whole file or any full ```python fence of my buffer.",
    "3) Reply with short plain-language advice in chat (2–6 sentences).",
    "4) Then list 2–6 line hints ONLY in this exact format (one per line):",
    "   L12: one short nudge",
    "   L27: another nudge",
    "   (use my real 1-based line numbers from the editor buffer)",
    "5) Each hint is one short sentence: pattern name, what to track, edge case, off-by-one — never finished code.",
    "6) ScratchCLI will inject `# HINT:` comments into MY existing file from those L#: lines. Do not rewrite the file yourself.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Prefer L#: line hints into the open buffer; if Grok still sent a guide-only
 * fence, merge only its `# HINT:` comments into the existing code (never replace).
 */
export function resolveGuideFromReply(
  reply: string,
  original: string,
): HintGuideResult | null {
  // Always replace prior hint comments instead of stacking duplicates.
  const cleaned = stripHintComments(original);
  const fromLines = applyLineNumberHints(cleaned, reply);
  if (fromLines) return fromLines;
  const fenced = extractPythonFence(reply);
  if (fenced) {
    return mergeHintCommentsIntoBuffer(cleaned, fenced);
  }
  return null;
}

/** Remove full-file python fences from a hint reply so chat stays advice-only. */
export function stripFullFileFencesFromReply(
  reply: string,
  original: string,
): string {
  return reply
    .replace(/```(?:python|py)?\s*\n([\s\S]*?)```/gi, (block, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return "";
      if (
        isGuideOnlyAnnotation(original, trimmed) ||
        trimmed.split(/\n/).length > 12 ||
        /if\s+__name__\s*==/.test(trimmed) ||
        /#\s*FILE:/.test(trimmed)
      ) {
        return "";
      }
      return block;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** User explicitly wants a full implementation / corrected file. */
export function isExplicitSolutionRequest(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  const word = lower.split(/\s+/)[0] ?? "";
  if (word === "solution" || word === "answer" || word === "implement") {
    return true;
  }
  return (
    /\b(full\s+)?(solution|answer|implementation)\b/.test(lower) ||
    /\bjust\s+(fix|solve|write|give)\s+(it|this|the\s+code|me\s+the\s+code)\b/.test(
      lower,
    ) ||
    /\b(write|give|show|paste|dump)\s+(me\s+)?(the\s+)?(full\s+)?(code|solution|implementation)\b/.test(
      lower,
    ) ||
    /\b(fix|complete|finish|solve)\s+(my\s+)?(code|solution|function|file|problem)\b/.test(
      lower,
    ) ||
    /\brewrite\s+(my\s+)?(code|file|solution)\b/.test(lower) ||
    /\bimplement\s+(it|this|the\s+solution|for\s+me)\b/.test(lower)
  );
}

/**
 * Wrap free-form coach questions so Grok does not dump a full solution
 * or echo the entire editor buffer unless the user explicitly asked.
 */
export function wrapFreeformCoachPrompt(question: string): {
  prompt: string;
  allowFullCode: boolean;
  guideBuffer: boolean;
} {
  const allowFullCode = isExplicitSolutionRequest(question);
  if (allowFullCode) {
    return {
      allowFullCode: true,
      guideBuffer: false,
      prompt: [
        "The user EXPLICITLY asked for a full implementation/solution for the CURRENTLY OPEN editor file.",
        "That open file is the practice problem — implement that one (read # FILE / # LC / docstring).",
        "You may provide a complete working Python solution with brief teaching comments.",
        `Their request: ${question.trim()}`,
      ].join("\n"),
    };
  }

  return {
    allowFullCode: false,
    guideBuffer: false,
    prompt: [
      "Answer the user's question as a DSA coach about the CURRENTLY OPEN editor file.",
      "That open practice file IS attached as context — identify it from # FILE / # LC / the docstring.",
      "Do NOT invent a new problem, and do NOT ask them to paste their code when the editor buffer is present.",
      "",
      "STRICT RULES:",
      "1) Do NOT return their whole file, whole function, or a complete solution. Do NOT fill in `pass`.",
      "2) Reply mostly in short plain language (approach, why something fails, what to try next).",
      "3) If you show code, quote ONLY the small part they asked about — typically 2–8 lines max, with a line-number hint like `around L42` when possible.",
      "4) Never paste the tests block, docstring, or unrelated helpers unless they asked about those specifically.",
      "5) Prefer one tiny ```python fence for that snippet (or none). Pseudocode is fine.",
      "6) If they want the finished implementation, tell them to type: solution",
      "7) If they want in-file `# HINT:` comments, tell them to type: hint",
      "",
      `User question: ${question.trim()}`,
    ].join("\n"),
  };
}
