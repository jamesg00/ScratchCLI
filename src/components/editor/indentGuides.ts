import { getIndentUnit } from "@codemirror/language";
import { RangeSetBuilder, EditorState } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

const guideMark = Decoration.mark({ class: "cm-indent-guide" });

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
  return null;
}

function buildGuides(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();
  const unit = Math.max(1, getIndentUnit(view.state));
  const tabSize = view.state.facet(EditorState.tabSize);

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const cols = leadingCols(line.text, tabSize);
      for (let col = unit; col < cols; col += unit) {
        const offset = colToOffset(line.text, col, tabSize);
        if (offset == null) continue;
        const fromPos = line.from + offset;
        if (fromPos < line.to) {
          builder.add(fromPos, fromPos + 1, guideMark);
        }
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const indentGuidesTheme = EditorView.baseTheme({
  ".cm-indent-guide": {
    position: "relative",
  },
  ".cm-indent-guide::before": {
    content: '""',
    position: "absolute",
    top: "0",
    bottom: "0",
    left: "0",
    borderLeft:
      "1px solid color-mix(in srgb, var(--muted, #888) 42%, transparent)",
    pointerEvents: "none",
  },
});

/** Vertical indent guides at each indent-unit boundary (Python-friendly). */
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
            update.geometryChanged
          ) {
            this.decorations = buildGuides(update.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
  ];
}
