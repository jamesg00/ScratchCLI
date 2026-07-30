import { getIndentUnit } from "@codemirror/language";
import {
  RangeSetBuilder,
  EditorState,
  type Range,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

function leadingCols(text: string, tabSize: number): number {
  let cols = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") cols += 1;
    else if (ch === "\t") cols += tabSize - (cols % tabSize);
    else break;
  }
  return cols;
}

function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/** Map a visual column within leading whitespace to a document offset, or null. */
function colToOffset(
  text: string,
  targetCol: number,
  tabSize: number,
): number | null {
  let cols = 0;
  for (let i = 0; i < text.length; i++) {
    if (cols === targetCol) return i;
    const ch = text[i];
    if (ch === " ") cols += 1;
    else if (ch === "\t") cols += tabSize - (cols % tabSize);
    else return null;
  }
  if (cols === targetCol) return text.length;
  return null;
}

const inactiveMark = Decoration.mark({ class: "cm-indent-guide" });
const activeMark = Decoration.mark({
  class: "cm-indent-guide cm-indent-guide-active",
});

class EmptyLineGuideWidget extends WidgetType {
  constructor(
    readonly levels: number,
    readonly activeLevel: number,
    readonly unit: number,
  ) {
    super();
  }

  eq(other: EmptyLineGuideWidget) {
    return (
      other.levels === this.levels &&
      other.activeLevel === this.activeLevel &&
      other.unit === this.unit
    );
  }

  toDOM() {
    const root = document.createElement("span");
    root.className = "cm-indent-guide-layer";
    root.setAttribute("aria-hidden", "true");
    for (let level = 1; level <= this.levels; level += 1) {
      const tick = document.createElement("span");
      tick.className =
        level === this.activeLevel
          ? "cm-indent-guide cm-indent-guide-active"
          : "cm-indent-guide";
      tick.style.left = `${(level - 1) * this.unit}ch`;
      root.appendChild(tick);
    }
    return root;
  }

  ignoreEvent() {
    return true;
  }
}

function computeIndents(
  state: EditorState,
  unit: number,
  tabSize: number,
): number[] {
  const lineCount = state.doc.lines;
  const raw = new Array<number>(lineCount + 1);
  for (let i = 1; i <= lineCount; i += 1) {
    const text = state.doc.line(i).text;
    if (isBlank(text)) {
      raw[i] = -1;
    } else {
      raw[i] = Math.floor(leadingCols(text, tabSize) / unit);
    }
  }

  // Continue guides through blank lines like VS Code (use next non-empty indent).
  const indents = raw.slice();
  for (let i = 1; i <= lineCount; i += 1) {
    if (indents[i]! >= 0) continue;
    let next = i + 1;
    while (next <= lineCount && raw[next]! < 0) next += 1;
    if (next <= lineCount) {
      indents[i] = raw[next]!;
      continue;
    }
    let prev = i - 1;
    while (prev >= 1 && raw[prev]! < 0) prev -= 1;
    indents[i] = prev >= 1 ? raw[prev]! : 0;
  }
  return indents;
}

type ActiveGuide = {
  level: number;
  fromLine: number;
  toLine: number;
};

/**
 * Finds the single indentation guide that contains the cursor.  The old
 * implementation highlighted every guide at the cursor's depth, even when it
 * belonged to a completely different function.  VS Code highlights the guide
 * for the current block only.
 */
function getActiveGuide(
  indents: number[],
  cursorLine: number,
  lineCount: number,
): ActiveGuide | null {
  const level = Math.max(0, indents[cursorLine] ?? 0);
  if (level === 0) return null;

  let fromLine = cursorLine;
  while (fromLine > 1 && (indents[fromLine - 1] ?? 0) >= level) {
    fromLine -= 1;
  }

  let toLine = cursorLine;
  while (toLine < lineCount && (indents[toLine + 1] ?? 0) >= level) {
    toLine += 1;
  }

  return { level, fromLine, toLine };
}

function buildGuides(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const unit = Math.max(1, getIndentUnit(view.state));
  const tabSize = view.state.facet(EditorState.tabSize);
  const indents = computeIndents(view.state, unit, tabSize);
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const activeGuide = getActiveGuide(indents, cursorLine, view.state.doc.lines);

  const ranges: Array<Range<Decoration>> = [];

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const levelCount = indents[line.number] ?? 0;
      if (levelCount > 0) {
        if (isBlank(line.text)) {
          ranges.push({
            from: line.from,
            to: line.from,
            value: Decoration.widget({
              widget: new EmptyLineGuideWidget(
                levelCount,
                activeGuide !== null &&
                  line.number >= activeGuide.fromLine &&
                  line.number <= activeGuide.toLine
                  ? activeGuide.level
                  : 0,
                unit,
              ),
              side: -1,
              inlineOrder: true,
            }),
          });
        } else {
          for (let level = 1; level <= levelCount; level += 1) {
            // A guide belongs at the start of its indentation unit.  Using
            // `level * unit` placed it on the first code character when a
            // line had exactly that amount of indentation.
            const col = (level - 1) * unit;
            const offset = colToOffset(line.text, col, tabSize);
            if (offset == null) continue;
            const fromPos = line.from + offset;
            if (fromPos >= line.to && line.length > 0) continue;
            const markAt = Math.min(fromPos, line.to - 1);
            if (markAt < line.from) continue;
            const active =
              activeGuide !== null &&
              level === activeGuide.level &&
              line.number >= activeGuide.fromLine &&
              line.number <= activeGuide.toLine;
            ranges.push({
              from: markAt,
              to: markAt + 1,
              value: active ? activeMark : inactiveMark,
            });
          }
        }
      }
      pos = line.to + 1;
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  for (const range of ranges) {
    builder.add(range.from, range.to, range.value);
  }
  return builder.finish();
}

const indentGuidesTheme = EditorView.baseTheme({
  ".cm-line": {
    position: "relative",
  },
  ".cm-indent-guide": {
    position: "relative",
  },
  ".cm-indent-guide::before": {
    content: '""',
    position: "absolute",
    // Overlap slightly so guides look continuous across lines (no gaps).
    top: "-1px",
    bottom: "-1px",
    left: "0",
    width: "0",
    borderLeft:
      "1px solid color-mix(in srgb, var(--custom-fg, #ffffff) 16%, transparent)",
    pointerEvents: "none",
    zIndex: "0",
  },
  ".cm-indent-guide-active::before": {
    borderLeft:
      "1px solid color-mix(in srgb, var(--custom-fg, #ffffff) 78%, transparent)",
  },
  ".cm-indent-guide-layer": {
    position: "relative",
    display: "inline-block",
    width: "0",
    height: "1.2em",
    verticalAlign: "top",
    pointerEvents: "none",
  },
  ".cm-indent-guide-layer > .cm-indent-guide": {
    position: "absolute",
    top: "-1px",
    bottom: "-1px",
    width: "0",
  },
  ".cm-indent-guide-layer > .cm-indent-guide::before": {
    top: "0",
    bottom: "0",
  },
});

/** VS Code-style indent guides: subtle rails + bright active block guide. */
export function indentGuides() {
  return [
    indentGuidesTheme,
    ViewPlugin.fromClass(
      class {
        decorations = Decoration.none;

        constructor(view: EditorView) {
          this.decorations = buildGuides(view);
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.geometryChanged ||
            update.selectionSet
          ) {
            this.decorations = buildGuides(update.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
  ];
}
