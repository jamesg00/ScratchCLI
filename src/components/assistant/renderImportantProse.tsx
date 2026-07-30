import type { ReactNode } from "react";

const IMPORTANT_MARKER = /\\\{([\s\S]+?)\}\\?/g;

export function renderImportantProse(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = IMPORTANT_MARKER.exec(text)) !== null) {
    const start = match.index;
    const full = match[0] ?? "";
    const inner = match[1] ?? "";
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    parts.push(
      <span
        key={`important-${start}-${inner.length}`}
        className="grok-important-inline"
      >
        {inner}
      </span>,
    );
    lastIndex = start + full.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
