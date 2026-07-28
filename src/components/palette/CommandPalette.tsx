import { useEffect, useMemo, useRef, useState } from "react";
import { fuzzyFilter } from "./fuzzy";

export type PaletteItem = {
  id: string;
  label: string;
  section: string;
  keywords?: string;
  description?: string;
  shortcut?: string;
  safety?: "safe" | "confirm" | "destructive";
  run: () => void;
};

type Props = {
  items: PaletteItem[];
  onClose: () => void;
};

export function CommandPalette({ items, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      fuzzyFilter(
        items,
        query,
        (item) => `${item.label} ${item.keywords ?? ""} ${item.section}`,
      ),
    [items, query],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const runSelected = () => {
    const item = filtered[index];
    if (!item) return;
    onClose();
    queueMicrotask(() => item.run());
  };

  const sections = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const item of filtered) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return [...map.entries()];
  }, [filtered]);

  let flatIndex = -1;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="command-palette-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a command…"
          spellCheck={false}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((i) =>
                Math.min(i + 1, Math.max(0, filtered.length - 1)),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              runSelected();
            }
          }}
        />
        <div className="command-palette-list">
          {filtered.length === 0 ? (
            <p className="command-palette-empty">No matches</p>
          ) : (
            sections.map(([section, rows]) => (
              <div key={section} className="command-palette-section">
                <div className="command-palette-section-label">{section}</div>
                {rows.map((item) => {
                  flatIndex += 1;
                  const active = flatIndex === index;
                  const myIndex = flatIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="command-palette-item"
                      data-active={active ? "true" : "false"}
                      onMouseEnter={() => setIndex(myIndex)}
                      onClick={() => {
                        onClose();
                        queueMicrotask(() => item.run());
                      }}
                    >
                      <span className="command-palette-copy">
                        <strong>{item.label}</strong>
                        {item.description && <small>{item.description}</small>}
                      </span>
                      {item.shortcut && <kbd>{item.shortcut}</kbd>}
                      {item.safety && item.safety !== "safe" && (
                        <span className="command-palette-safety">
                          {item.safety}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
