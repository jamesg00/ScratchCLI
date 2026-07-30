import { useEffect, useMemo, useState } from "react";
import { useAppearanceStore } from "../../stores/appearanceStore";
import { groupFonts, type FontOption } from "../../fonts/catalog";
import { ensureWebFontsLoaded } from "../../fonts/availability";

type Props = {
  onClose: () => void;
  fonts: FontOption[];
};

const themeDefaults = {
  light: { background: "#fff7c7", foreground: "#2b271f" },
  dark: { background: "#242321", foreground: "#eee9de" },
  pro: { background: "#0b0c0d", foreground: "#f1f1f1" },
  comet: { background: "#071422", foreground: "#e6f3ff" },
} as const;

export function AppearanceDialog({ onClose, fonts }: Props) {
  const appearance = useAppearanceStore();
  const defaults = themeDefaults[appearance.theme];
  const [fontQuery, setFontQuery] = useState("");

  useEffect(() => {
    void ensureWebFontsLoaded(fonts);
  }, [fonts]);

  const options = useMemo(() => {
    const knownValues = new Set(fonts.map((font) => font.value));
    return knownValues.has(appearance.fontFamily)
      ? fonts
      : [
          ...fonts,
          {
            label: "Custom",
            family: "Custom",
            value: appearance.fontFamily,
            source: "workspace" as const,
            group: "workspace" as const,
          },
        ];
  }, [appearance.fontFamily, fonts]);

  const filtered = useMemo(() => {
    const q = fontQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (font) =>
        font.label.toLowerCase().includes(q) ||
        font.family.toLowerCase().includes(q) ||
        font.group.toLowerCase().includes(q),
    );
  }, [fontQuery, options]);

  const sections = useMemo(() => groupFonts(filtered), [filtered]);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="appearance-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="appearance-title">Appearance</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            x
          </button>
        </header>
        <div className="appearance-dialog-body">
          <div className="theme-buttons" aria-label="Theme">
            {(["light", "dark", "pro", "comet"] as const).map((theme) => (
              <button
                type="button"
                data-active={appearance.theme === theme}
                key={theme}
                onClick={() => appearance.setTheme(theme)}
              >
                {theme[0].toUpperCase() + theme.slice(1)}
              </button>
            ))}
          </div>

          <div className="font-picker">
            <div className="font-picker-header">
              <span>Font</span>
              <span className="font-picker-count">
                {filtered.length} / {options.length}
              </span>
            </div>
            <input
              type="search"
              className="font-picker-search"
              value={fontQuery}
              onChange={(event) => setFontQuery(event.target.value)}
              placeholder="Search JetBrains, VT323, Syne…"
              spellCheck={false}
            />
            <div className="font-picker-list" role="listbox" aria-label="Fonts">
              {sections.length === 0 ? (
                <p className="font-picker-empty">No fonts match.</p>
              ) : (
                sections.map((section) => (
                  <div key={section.group} className="font-picker-section">
                    <div className="font-picker-section-label">
                      {section.label}
                    </div>
                    {section.fonts.map((font) => {
                      const active = font.value === appearance.fontFamily;
                      return (
                        <button
                          key={`${font.source}-${font.family}-${font.value}`}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className="font-picker-item"
                          data-active={active ? "true" : "false"}
                          style={{ fontFamily: font.value }}
                          onClick={() => appearance.setFontFamily(font.value)}
                        >
                          <span className="font-picker-name">{font.label}</span>
                          <span className="font-picker-sample">Aa 123 ≠ π</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          <p
            className="font-preview"
            style={{ fontFamily: appearance.fontFamily }}
          >
            The quick brown fox jumps over the lazy dog — 1234567890
          </p>
          <label>
            Size
            <div className="range-row">
              <input
                type="range"
                min="10"
                max="30"
                value={appearance.fontSize}
                onChange={(event) =>
                  appearance.setFontSize(Number(event.target.value))
                }
              />
              <output>{appearance.fontSize}px</output>
            </div>
          </label>
          <p className="settings-hint">
            Also scales with the window. Ctrl+= / Ctrl+- nudge size.
          </p>
          <div className="color-row">
            <label>
              Editor background
              <input
                type="color"
                value={appearance.backgroundColor ?? defaults.background}
                onChange={(event) =>
                  appearance.setBackgroundColor(event.target.value)
                }
              />
            </label>
            <label>
              Text
              <input
                type="color"
                value={appearance.foregroundColor ?? defaults.foreground}
                onChange={(event) =>
                  appearance.setForegroundColor(event.target.value)
                }
              />
            </label>
          </div>
          <label>
            Opacity
            <div className="range-row">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={appearance.opacity}
                onChange={(event) =>
                  appearance.setOpacity(Number(event.target.value))
                }
              />
              <output>{Math.round(appearance.opacity * 100)}%</output>
            </div>
          </label>
          <label className="toggle-row">
            <span>Pretty symbols (≠ π ≤)</span>
            <input
              type="checkbox"
              checked={appearance.prettySymbols}
              onChange={(event) =>
                appearance.setPrettySymbols(event.target.checked)
              }
            />
          </label>
          <label className="toggle-row">
            <span>Matrix rain</span>
            <input
              type="checkbox"
              checked={appearance.matrixRain}
              onChange={(event) =>
                appearance.setMatrixRain(event.target.checked)
              }
            />
          </label>
        </div>
        <footer>
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
