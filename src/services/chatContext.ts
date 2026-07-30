import type { ChatMessage, ChatProviderId } from "./chat";

type Snapshot = {
  fileKey: string;
  provider: ChatProviderId;
  model: string;
  language: string;
  localMode: "fast" | "balanced" | "full";
  buffer: string;
  hash: string;
  lastUsedAt: number;
};

export type ChatContextCache = {
  snapshots: Record<string, Snapshot>;
};

export type ChatContextPayload = {
  buffer: string;
  contextOverride?: string;
  meta?: {
    usedChars: number;
    budgetChars: number;
    ratio: number;
    compacted: boolean;
  };
};

const EXCERPT_PADDING = 6;
const MAX_IMPORT_LINES = 24;
const MAX_SAMPLE_LINES = 16;
const MAX_FILE_SNAPSHOTS = 8;
const CONTEXT_BUDGETS = {
  fast: 4200,
  balanced: 7500,
  full: 12000,
} as const;

export function createChatContextCache(): ChatContextCache {
  return { snapshots: {} };
}

export function clearChatContextCache(
  cache: ChatContextCache,
  fileKey?: string,
): void {
  if (!fileKey) {
    cache.snapshots = {};
    return;
  }
  delete cache.snapshots[fileKey];
}

export function compactChatContextCache(
  cache: ChatContextCache,
  fileKey?: string,
): void {
  if (!fileKey) {
    cache.snapshots = {};
    return;
  }
  const snapshot = cache.snapshots[fileKey];
  if (!snapshot) return;
  snapshot.buffer = "";
  snapshot.hash = "";
}

export function buildChatContextPayload(options: {
  cache: ChatContextCache;
  provider: ChatProviderId;
  model: string;
  language?: string;
  buffer?: string;
  isLocal: boolean;
  fileKey?: string;
  localMode?: "fast" | "balanced" | "full";
  question?: string;
  history?: ChatMessage[];
}): ChatContextPayload {
  const language = (options.language ?? "plaintext").trim() || "plaintext";
  const buffer = options.buffer ?? "";
  const fileKey = options.fileKey?.trim() || "__default__";
  const localMode = options.localMode ?? "balanced";
  if (!options.isLocal || !buffer.trim()) {
    return { buffer };
  }
  const budgetChars = CONTEXT_BUDGETS[localMode];

  const model = options.model.trim();
  const hash = simpleHash(buffer);
  const snapshot = options.cache.snapshots[fileKey];
  const shouldReset =
    !snapshot ||
    snapshot.fileKey !== fileKey ||
    snapshot.provider !== options.provider ||
    snapshot.model !== model ||
      snapshot.language !== language ||
      snapshot.localMode !== localMode;

  if (shouldReset) {
    options.cache.snapshots[fileKey] = {
      fileKey,
      provider: options.provider,
      model,
      language,
      localMode,
      buffer,
      hash,
      lastUsedAt: Date.now(),
    };
    pruneChatContextCache(options.cache, fileKey);
    return {
      buffer,
      ...finalizeLocalPayload(
        buildPrimaryContext(
        language,
        buffer,
        localMode,
        options.question,
        options.history,
        ),
        budgetChars,
      ),
    };
  }
  snapshot.lastUsedAt = Date.now();
  snapshot.buffer = buffer;
  snapshot.hash = hash;

  // Ollama and LM Studio requests are stateless. A delta or a reference to a
  // previous snapshot is not context unless we send the actual code again.
  return {
    buffer,
    ...finalizeLocalPayload(
      buildPrimaryContext(
        language,
        buffer,
        localMode,
        options.question,
        options.history,
      ),
      budgetChars,
    ),
  };
}

function pruneChatContextCache(cache: ChatContextCache, keepFileKey: string): void {
  const entries = Object.entries(cache.snapshots);
  if (entries.length <= MAX_FILE_SNAPSHOTS) return;
  entries
    .sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt)
    .filter(([fileKey]) => fileKey !== keepFileKey)
    .slice(0, Math.max(0, entries.length - MAX_FILE_SNAPSHOTS))
    .forEach(([fileKey]) => {
      delete cache.snapshots[fileKey];
    });
}

function buildPrimaryContext(
  language: string,
  buffer: string,
  localMode: "fast" | "balanced" | "full",
  question?: string,
  history?: ChatMessage[],
): string {
  if (localMode === "full") {
    return buildFullContext(language, buffer, history);
  }
  return buildCompactContext(language, buffer, localMode, question, history);
}

function buildFullContext(
  language: string,
  buffer: string,
  history?: ChatMessage[],
): string {
  return (
    `Editor language: ${language}\n` +
    localReplyStyle() +
    buildHistorySummary(history) +
    `Lines are numbered (N|code) for reference.\n\n` +
    `Editor buffer:\n\`\`\`${language}\n${numberedBuffer(buffer)}\n\`\`\`\n`
  );
}

function buildCompactContext(
  language: string,
  buffer: string,
  localMode: "fast" | "balanced" | "full",
  question?: string,
  history?: ChatMessage[],
): string {
  const trimmed = buffer.trim();
  if (!trimmed) return buildFullContext(language, buffer);
  if (!isPythonLike(language)) {
    return (
      `Editor language: ${language}\n` +
      `Compact local context mode: ${localMode}.\n` +
      `Use the summarized slices below instead of assuming the whole file is present.\n\n` +
      `Relevant excerpt:\n\`\`\`${language}\n${numberedExcerpt(
        buffer,
        1,
        Math.min(40, buffer.split(/\r?\n/).length),
      )}\n\`\`\`\n`
    );
  }

  const lines = buffer.split(/\r?\n/);
  const imports = collectImportLines(lines);
  const samples = collectSampleLines(lines);
  const blocks = collectPythonBlocks(lines);
  const ranked = rankPythonBlocks(blocks, question, localMode);
  const blockLimit = localMode === "fast" ? 1 : 2;
  const chosen = ranked.slice(0, blockLimit);
  const focusedExcerpt = buildFocusedExcerpt(language, buffer, question);
  const names = chosen.map((block) => block.name).filter(Boolean).join(", ");
  const summary = buildPythonSummary(lines, blocks);

  const parts = [
    `Editor language: ${language}`,
    localReplyStyle().trim(),
    `Compact local context mode: ${localMode}.`,
    buildHistorySummary(history).trim(),
    `Python file summary: ${summary}.`,
    names ? `Focus blocks: ${names}.` : "",
    "Use these slices as primary context instead of assuming the whole file is attached.",
    "",
  ].filter(Boolean);

  if (focusedExcerpt) {
    parts.push(
      `Focused excerpt:\n\`\`\`${language}\n${focusedExcerpt}\n\`\`\`\n`,
    );
  }

  if (imports.length) {
    parts.push(
      `Imports:\n\`\`\`${language}\n${numberLines(
        imports.map((index) => [index, lines[index - 1] ?? ""]),
      )}\n\`\`\`\n`,
    );
  }

  chosen.forEach((block, index) => {
    const compacted = compactPythonBlock(block.lines, localMode);
    parts.push(
      `Code block ${index + 1} (${block.name}, lines ${block.start}-${block.end}):\n\`\`\`${language}\n${numberLines(compacted)}\n\`\`\`\n`,
    );
  });

  if (samples.length) {
    parts.push(
      `Examples / runtime clues:\n\`\`\`${language}\n${numberLines(
        samples.map((index) => [index, lines[index - 1] ?? ""]),
      )}\n\`\`\`\n`,
    );
  }

  if (!imports.length && chosen.length === 0 && samples.length === 0) {
    parts.push(
      `Fallback excerpt:\n\`\`\`${language}\n${numberedExcerpt(
        buffer,
        1,
        Math.min(lines.length, localMode === "fast" ? 28 : 44),
      )}\n\`\`\`\n`,
    );
  }

  return parts.join("\n");
}

function localReplyStyle(): string {
  return (
    "Local reply style: be concise and practical. Prefer 3-6 short bullets or a short paragraph. Avoid repeating the question or dumping long generic explanations. Use code only when it materially helps. Ground every claim in the supplied code. For a dry run, evaluate the actual condition before each claimed iteration and stop immediately when it is false; never invent values, lines, or iterations. If the relevant code is missing, say that rather than guessing.\n\n"
  );
}

type PythonBlock = {
  name: string;
  start: number;
  end: number;
  kind: "def" | "class";
  lines: Array<[number, string]>;
};

function isPythonLike(language: string): boolean {
  const lower = language.trim().toLowerCase();
  return lower === "python" || lower === "py";
}

function collectImportLines(lines: string[]): number[] {
  const out: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? "";
    if (!trimmed) {
      if (out.length > 0) break;
      continue;
    }
    if (/^(from\s+\S+\s+import\s+|import\s+\S+)/.test(trimmed)) {
      out.push(index + 1);
      if (out.length >= MAX_IMPORT_LINES) break;
      continue;
    }
    if (out.length > 0) break;
    if (!trimmed.startsWith("#") && !trimmed.startsWith('"""') && !trimmed.startsWith("'''")) {
      break;
    }
  }
  return out;
}

function collectSampleLines(lines: string[]): number[] {
  const picked: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (
      /(^assert\b|print\(|if __name__ == ["']__main__["']|(^|\s)(nums|arr|grid|target|k|s|word|words)\s*=)/.test(
        trimmed,
      )
    ) {
      picked.push(index + 1);
      if (picked.length >= MAX_SAMPLE_LINES) break;
    }
  }
  return picked;
}

function collectPythonBlocks(lines: string[]): PythonBlock[] {
  const blocks: PythonBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = line.match(/^\s*(def|class)\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (!match) continue;
    const kind = match[1] as "def" | "class";
    const name = match[2] ?? kind;
    const baseIndent = line.match(/^\s*/)?.[0].length ?? 0;
    let end = index + 1;
    for (let probe = index + 1; probe < lines.length; probe += 1) {
      const next = lines[probe] ?? "";
      const trimmed = next.trim();
      if (!trimmed) {
        end = probe + 1;
        continue;
      }
      const indent = next.match(/^\s*/)?.[0].length ?? 0;
      if (indent <= baseIndent && /^(def|class)\s+/.test(trimmed)) break;
      if (indent <= baseIndent && !trimmed.startsWith("#")) break;
      end = probe + 1;
    }
    blocks.push({
      name,
      start: index + 1,
      end,
      kind,
      lines: lines.slice(index, end).map((value, offset) => [index + offset + 1, value]),
    });
  }
  return blocks;
}

function rankPythonBlocks(
  blocks: PythonBlock[],
  question: string | undefined,
  localMode: "fast" | "balanced" | "full",
): PythonBlock[] {
  if (blocks.length === 0) return [];
  const tokens = tokenizeQuestion(question);
  const scored = blocks.map((block) => {
    let score = block.kind === "def" ? 6 : 3;
    if (block.lines.length <= (localMode === "fast" ? 80 : 140)) score += 2;
    const joined = block.lines.map(([, line]) => line.toLowerCase()).join("\n");
    if (/\b(return|yield)\b/.test(joined)) score += 2;
    if (/\b(for|while|if|elif)\b/.test(joined)) score += 1;
    for (const token of tokens) {
      if (block.name.toLowerCase().includes(token)) score += 7;
      if (joined.includes(token)) score += 2;
    }
    return { block, score };
  });
  scored.sort((left, right) => right.score - left.score || right.block.start - left.block.start);
  return scored.map((item) => item.block);
}

function tokenizeQuestion(question?: string): string[] {
  return (question ?? "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((token) => token.length >= 3)
    .slice(0, 12);
}

function buildHistorySummary(history?: ChatMessage[]): string {
  const recent = (history ?? []).slice(-6);
  if (recent.length === 0) return "";
  const lines = recent.map((entry, index) => {
    const label = entry.role === "assistant" ? "Assistant" : "User";
    return `${index + 1}. ${label}: ${clipInline(entry.content, 140)}`;
  });
  return `Recent chat summary:\n${lines.join("\n")}\n\n`;
}

function finalizeLocalPayload(
  contextOverride: string,
  budgetChars: number,
): Pick<ChatContextPayload, "contextOverride" | "meta"> {
  const compacted = compactOverrideText(contextOverride, budgetChars);
  return {
    contextOverride: compacted.text,
    meta: {
      usedChars: compacted.text.length,
      budgetChars,
      ratio: Math.min(1, compacted.text.length / budgetChars),
      compacted: compacted.compacted,
    },
  };
}

function compactOverrideText(
  text: string,
  budgetChars: number,
): { text: string; compacted: boolean } {
  if (text.length <= budgetChars) return { text, compacted: false };
  const head = text.slice(0, Math.max(0, Math.floor(budgetChars * 0.72)));
  const tail = text.slice(-Math.max(0, Math.floor(budgetChars * 0.2)));
  return {
    text:
      `${head}\n\n[Context compacted to fit local budget]\n\n${tail}`.slice(
        0,
        budgetChars,
      ),
    compacted: true,
  };
}

function clipInline(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function buildFocusedExcerpt(
  language: string,
  buffer: string,
  question?: string,
): string | null {
  if (!question?.trim()) return null;
  const lineRef = extractLineReference(question);
  if (lineRef != null) {
    return numberedExcerpt(buffer, lineRef, lineRef);
  }
  if (!isPythonLike(language)) return null;
  const tokens = tokenizeQuestion(question);
  if (tokens.length === 0) return null;
  const lines = buffer.split(/\r?\n/);
  const hit = lines.findIndex((line) =>
    tokens.some((token) => line.toLowerCase().includes(token)),
  );
  if (hit < 0) return null;
  return numberedExcerpt(buffer, hit + 1, hit + 1);
}

function extractLineReference(question: string): number | null {
  const match = question.match(/\bL(\d+)\b|\bline\s+(\d+)\b/i);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buildPythonSummary(lines: string[], blocks: PythonBlock[]): string {
  const defCount = blocks.filter((block) => block.kind === "def").length;
  const classCount = blocks.filter((block) => block.kind === "class").length;
  return `${lines.length} total lines, ${defCount} function(s), ${classCount} class(es)`;
}

function compactPythonBlock(
  lines: Array<[number, string]>,
  localMode: "fast" | "balanced" | "full",
): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  let inDocstring = false;
  const limit = localMode === "fast" ? 48 : 90;
  for (const entry of lines) {
    const [lineNumber, raw] = entry;
    const trimmed = raw.trim();
    const tripleCount = (raw.match(/"""/g) ?? []).length + (raw.match(/'''/g) ?? []).length;
    if (tripleCount > 0) {
      if (!inDocstring && trimmed !== '"""' && trimmed !== "'''") {
        out.push([lineNumber, raw]);
      }
      inDocstring = tripleCount % 2 === 1 ? !inDocstring : inDocstring;
      continue;
    }
    if (inDocstring) continue;
    if (trimmed.startsWith("#")) continue;
    if (!trimmed && out.at(-1)?.[1].trim() === "") continue;
    out.push([lineNumber, raw]);
    if (out.length >= limit) break;
  }
  return out;
}

function numberLines(lines: Array<[number, string]>): string {
  return lines.map(([lineNumber, line]) => `${String(lineNumber).padStart(4, " ")}|${line}`).join("\n");
}

function numberedExcerpt(buffer: string, startLine: number, endLine: number): string {
  const lines = buffer.split(/\r?\n/);
  const start = Math.max(1, startLine - EXCERPT_PADDING);
  const end = Math.min(lines.length, endLine + EXCERPT_PADDING);
  return lines
    .slice(start - 1, end)
    .map((line, index) => `${String(start + index).padStart(4, " ")}|${line}`)
    .join("\n");
}

function numberedBuffer(buffer: string): string {
  return buffer
    .split(/\r?\n/)
    .map((line, index) => `${String(index + 1).padStart(4, " ")}|${line}`)
    .join("\n");
}

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
