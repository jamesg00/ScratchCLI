import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  WidgetType,
  type ViewUpdate,
} from "@codemirror/view";

/** Operator / compound token → display glyph (source stays ASCII). */
export const OPERATOR_GLYPHS: Array<{ from: string; to: string }> = [
  { from: "!=", to: "≠" },
  { from: "==", to: "≡" },
  { from: "<=", to: "≤" },
  { from: ">=", to: "≥" },
  { from: "->", to: "→" },
  { from: "=>", to: "⇒" },
];

/** Whole-word identifier → glyph. `lambda` keyword is excluded by caller. */
export const IDENTIFIER_GLYPHS: Record<string, string> = {
  pi: "π",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  theta: "θ",
  sigma: "σ",
  omega: "ω",
  mu: "μ",
  phi: "φ",
  infty: "∞",
  infinity: "∞",
};

/** Qualified names (substring, not inside strings). */
export const QUALIFIED_GLYPHS: Array<{ from: string; to: string }> = [
  { from: "math.pi", to: "π" },
  { from: "np.pi", to: "π" },
  { from: "math.e", to: "e" },
  { from: "math.inf", to: "∞" },
  { from: "np.inf", to: "∞" },
];

export function glyphForIdentifier(name: string): string | null {
  if (name === "lambda") return null;
  return IDENTIFIER_GLYPHS[name] ?? null;
}

/** Ranges to skip: strings and comments (naive Python-ish scan). */
export function maskedRanges(
  text: string,
): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === "#") {
      const start = i;
      while (i < text.length && text[i] !== "\n") i += 1;
      ranges.push({ from: start, to: i });
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      const triple = text.slice(i, i + 3) === quote.repeat(3);
      if (triple) {
        i += 3;
        while (i < text.length && text.slice(i, i + 3) !== quote.repeat(3)) {
          if (text[i] === "\\") i += 2;
          else i += 1;
        }
        i = Math.min(text.length, i + 3);
      } else {
        i += 1;
        while (i < text.length && text[i] !== quote && text[i] !== "\n") {
          if (text[i] === "\\") i += 2;
          else i += 1;
        }
        if (i < text.length) i += 1;
      }
      ranges.push({ from: start, to: i });
      continue;
    }
    i += 1;
  }
  return ranges;
}

function overlapsMask(
  from: number,
  to: number,
  masks: Array<{ from: number; to: number }>,
): boolean {
  return masks.some((m) => from < m.to && to > m.from);
}

export type PrettyMatch = { from: number; to: number; glyph: string };

/** Find all pretty-symbol matches in `text` (document ASCII). */
export function findPrettyMatches(text: string): PrettyMatch[] {
  const masks = maskedRanges(text);
  const matches: PrettyMatch[] = [];

  const tryAdd = (from: number, to: number, glyph: string) => {
    if (overlapsMask(from, to, masks)) return;
    // Prefer longer matches: skip if already covered
    if (matches.some((m) => from < m.to && to > m.from)) return;
    matches.push({ from, to, glyph });
  };

  // Longer qualified names first
  for (const { from: needle, to: glyph } of [...QUALIFIED_GLYPHS].sort(
    (a, b) => b.from.length - a.from.length,
  )) {
    let idx = 0;
    while (idx < text.length) {
      const found = text.indexOf(needle, idx);
      if (found < 0) break;
      tryAdd(found, found + needle.length, glyph);
      idx = found + needle.length;
    }
  }

  for (const { from: needle, to: glyph } of [...OPERATOR_GLYPHS].sort(
    (a, b) => b.from.length - a.from.length,
  )) {
    let idx = 0;
    while (idx < text.length) {
      const found = text.indexOf(needle, idx);
      if (found < 0) break;
      tryAdd(found, found + needle.length, glyph);
      idx = found + needle.length;
    }
  }

  const identRe = /\b([A-Za-z_][\w]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = identRe.exec(text)) !== null) {
    const name = m[1]!;
    const glyph = glyphForIdentifier(name);
    if (!glyph) continue;
    tryAdd(m.index, m.index + name.length, glyph);
  }

  return matches.sort((a, b) => a.from - b.from);
}

class PrettySymWidget extends WidgetType {
  constructor(readonly glyph: string) {
    super();
  }

  eq(other: PrettySymWidget) {
    return other.glyph === this.glyph;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-pretty-sym";
    span.textContent = this.glyph;
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

function buildDeco(view: EditorView) {
  const text = view.state.doc.toString();
  const matches = findPrettyMatches(text);
  const ranges = matches.map((match) =>
    Decoration.replace({
      widget: new PrettySymWidget(match.glyph),
    }).range(match.from, match.to),
  );
  return Decoration.set(ranges, true);
}

/** CodeMirror extension: display-only pretty symbols for Python-like buffers. */
export function prettySymbols() {
  return ViewPlugin.fromClass(
    class {
      decorations;

      constructor(view: EditorView) {
        this.decorations = buildDeco(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDeco(update.view);
        }
      }
    },
    {
      decorations: (value) => value.decorations,
    },
  );
}

/** Unused MatchDecorator export kept for tests / alt wiring. */
export function prettyOperatorDecorator() {
  return new MatchDecorator({
    regexp: /!=|==|<=|>=|->|=>/g,
    decoration: (match) => {
      const glyph =
        OPERATOR_GLYPHS.find((item) => item.from === match[0])?.to ?? match[0];
      return Decoration.replace({ widget: new PrettySymWidget(glyph) });
    },
  });
}
