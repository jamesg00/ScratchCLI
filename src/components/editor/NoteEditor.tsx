import CodeMirror from "@uiw/react-codemirror";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  indentLess,
  indentMore,
  indentWithTab,
  redo as cmRedo,
  selectAll as cmSelectAll,
  undo as cmUndo,
} from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { openSearchPanel } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useMemo, useRef } from "react";
import { isEditorSlashCommand } from "../terminal/commands";
import { useAppearanceStore } from "../../stores/appearanceStore";
import { indentGuides } from "./indentGuides";
import { prettySymbols } from "./prettySymbols";

export type EditorCommand =
  | "undo"
  | "redo"
  | "find"
  | "selectAll"
  | "indent"
  | "outdent"
  | "focus"
  | "insert";

export type EditorActions = {
  execute: (command: EditorCommand, payload?: string) => void;
};

export type EditorDocument = {
  content: string;
  language: string;
  color?: string;
  title?: string;
};

type Props = {
  document: EditorDocument;
  dark: boolean;
  fontFamily: string;
  fontSize: number;
  showFooter?: boolean;
  onChange: (patch: {
    content?: string;
    language?: string;
    title?: string;
  }) => void;
  onActionsReady?: (actions: EditorActions) => void;
  onSlashCommand: (command: string, content: string) => void;
  onNanoExit: () => void;
  onActivateCommand?: (seed?: string) => void;
};

export function NoteEditor({
  document: doc,
  dark,
  fontFamily,
  fontSize,
  showFooter = false,
  onChange,
  onActionsReady,
  onSlashCommand,
  onNanoExit,
  onActivateCommand,
}: Props) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const prettyOn = useAppearanceStore((state) => state.prettySymbols);

  const fontTheme = useMemo(
    () =>
      EditorView.theme({
        "&": {
          fontFamily,
          fontSize: `${fontSize}px`,
        },
        ".cm-scroller": {
          fontFamily,
          fontSize: `${fontSize}px`,
        },
        ".cm-content": {
          fontFamily,
          fontSize: `${fontSize}px`,
        },
        ".cm-gutters": {
          fontFamily,
          fontSize: `${fontSize}px`,
        },
      }),
    [fontFamily, fontSize],
  );

  useEffect(() => {
    onActionsReady?.({
      execute(command, payload) {
        const view = editorRef.current?.view;
        if (!view) return;
        switch (command) {
          case "undo":
            cmUndo(view);
            break;
          case "redo":
            cmRedo(view);
            break;
          case "find":
            openSearchPanel(view);
            break;
          case "selectAll":
            cmSelectAll(view);
            break;
          case "indent":
            indentMore(view);
            break;
          case "outdent":
            indentLess(view);
            break;
          case "focus":
            view.focus();
            break;
          case "insert": {
            const text = payload ?? "";
            if (!text) return;
            const { from, to } = view.state.selection.main;
            const cursorMark = text.indexOf("$0");
            const clean = text.replace(/\$0/g, "");
            const insertAt = from;
            view.dispatch({
              changes: { from, to, insert: clean },
              selection: {
                anchor:
                  cursorMark >= 0
                    ? insertAt + cursorMark
                    : insertAt + clean.length,
              },
            });
            view.focus();
            break;
          }
        }
      },
    });
  }, [onActionsReady]);

  const extensions = useMemo(() => {
    const list = [
      doc.language === "python" ? python() : markdown(),
      indentUnit.of("    "),
      fontTheme,
      Prec.high(
        keymap.of([
          {
            key: "Enter",
            run(view) {
              const cursor = view.state.selection.main;
              if (!cursor.empty) return false;
              const line = view.state.doc.lineAt(cursor.head);
              const value = line.text.trim();
              if (!isEditorSlashCommand(value)) return false;

              let from = line.from;
              let to = line.to;
              if (to < view.state.doc.length) {
                to += 1;
              } else if (from > 0) {
                from -= 1;
              }
              view.dispatch({
                changes: { from, to },
                selection: { anchor: from },
              });
              const content = view.state.doc.toString();
              queueMicrotask(() => onSlashCommand(value, content));
              return true;
            },
          },
          {
            key: "/",
            run(view) {
              const cursor = view.state.selection.main;
              if (!cursor.empty) return false;
              const line = view.state.doc.lineAt(cursor.head);
              const before = line.text.slice(0, cursor.head - line.from);
              if (before.trim() !== "") return false;
              queueMicrotask(() => onActivateCommand?.("/"));
              return true;
            },
          },
          {
            key: "Mod-Shift-z",
            run(view) {
              return cmRedo(view);
            },
          },
          {
            key: "Mod-y",
            run(view) {
              return cmRedo(view);
            },
          },
          {
            key: "Mod-x",
            run() {
              queueMicrotask(() => onNanoExit());
              return true;
            },
          },
          {
            key: "Escape",
            run() {
              queueMicrotask(() => onNanoExit());
              return true;
            },
          },
          indentWithTab,
        ]),
      ),
      EditorView.lineWrapping,
    ];
    if (doc.language === "python") {
      list.push(...indentGuides());
    }
    if (
      prettyOn &&
      (doc.language === "python" || doc.language === "plaintext")
    ) {
      list.push(prettySymbols());
    }
    return list;
  }, [
    doc.language,
    fontTheme,
    onActivateCommand,
    onNanoExit,
    onSlashCommand,
    prettyOn,
  ]);

  const isPython = doc.language === "python";

  return (
    <section className="editor-pane" data-color={doc.color ?? "gray"}>
      <CodeMirror
        ref={editorRef}
        className="note-editor"
        value={doc.content}
        height="100%"
        extensions={extensions}
        theme={dark ? oneDark : "light"}
        basicSetup={{
          lineNumbers: isPython,
          // Python's language support exposes fold ranges for classes and
          // functions; this adds the VS Code-style expand/collapse controls.
          foldGutter: isPython,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          searchKeymap: true,
        }}
        onChange={(content) => {
          const looksLikePython =
            /^\s*(async\s+def|def|class|import|from\s+\S+\s+import)\s+/m.test(
              content,
            );
          const firstLine =
            content
              .split(/\r?\n/)
              .map((line) => line.trim())
              .find(Boolean)
              ?.replace(/^#+\s*/, "")
              .slice(0, 80) ?? "";
          onChange({
            content,
            title:
              firstLine || (doc.language === "python" ? "Python note" : ""),
            ...(looksLikePython && doc.language !== "python"
              ? { language: "python" }
              : {}),
          });
        }}
        aria-label="Editor content"
      />
      <footer className="editor-footer" hidden={!showFooter}>
        <span>{doc.content.length.toLocaleString()} characters</span>
        <label>
          <span className="sr-only">Language</span>
          <select
            value={doc.language}
            onChange={(event) => onChange({ language: event.target.value })}
          >
            <option value="python">Python</option>
            <option value="markdown">Markdown</option>
            <option value="plaintext">Plain text</option>
          </select>
        </label>
      </footer>
    </section>
  );
}
