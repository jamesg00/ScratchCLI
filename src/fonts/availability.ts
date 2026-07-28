import { SYSTEM_FONTS, type FontOption } from "./catalog";

const availabilityCache = new Map<string, boolean>();

function measureWidth(fontSpec: string): number {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return 0;
  context.font = fontSpec;
  return context.measureText("mmmmmmmmmmlliWw@|0O").width;
}

/** Best-effort check that a named family is usable in this WebView. */
export function isFontAvailable(family: string): boolean {
  const cached = availabilityCache.get(family);
  if (cached != null) return cached;

  const quoted = family.includes(" ") ? `"${family}"` : family;
  let available = false;

  try {
    if (document.fonts?.check?.(`16px ${quoted}`)) {
      available = true;
    }
  } catch {
    /* ignore */
  }

  if (!available) {
    const baseline = measureWidth('16px "Courier New", monospace');
    const candidate = measureWidth(`16px ${quoted}, "Courier New", monospace`);
    // Also compare against sans baseline — catches fonts identical to Courier.
    const sansBaseline = measureWidth("16px Arial, sans-serif");
    const sansCandidate = measureWidth(`16px ${quoted}, Arial, sans-serif`);
    available =
      (candidate !== 0 && candidate !== baseline) ||
      (sansCandidate !== 0 && sansCandidate !== sansBaseline);
  }

  // Always trust these Windows staples even if measurement is flaky.
  if (
    !available &&
    /^(Consolas|Courier New|Arial|Segoe UI|Tahoma|Verdana|Georgia|Times New Roman|Trebuchet MS|Comic Sans MS|Impact|Calibri|Cambria|Lucida Console)$/i.test(
      family,
    )
  ) {
    available = true;
  }

  availabilityCache.set(family, available);
  return available;
}

export function clearFontAvailabilityCache(): void {
  availabilityCache.clear();
}

export async function ensureWebFontsLoaded(
  fonts: FontOption[] = SYSTEM_FONTS,
): Promise<void> {
  const google = fonts
    .filter((font) => font.google)
    .map((font) => font.google!)
    .filter((value, index, all) => all.indexOf(value) === index);

  if (!google.length) return;

  // Chunk so the CSS URL stays under browser / CDN limits.
  const chunks: string[][] = [];
  let current: string[] = [];
  let length = 0;
  for (const family of google) {
    const extra = family.length + 8;
    if (current.length && length + extra > 1600) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(family);
    length += extra;
  }
  if (current.length) chunks.push(current);

  chunks.forEach((chunk, index) => {
    const id = `scratchcli-google-fonts-${index}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${chunk
      .map((family) => `family=${family}`)
      .join("&")}&display=swap`;
    document.head.appendChild(link);
  });

  // Wait briefly so document.fonts can settle for web faces.
  try {
    await document.fonts.ready;
    await Promise.all(
      fonts
        .filter((font) => font.google)
        .map((font) =>
          document.fonts.load(`16px "${font.family}"`).catch(() => undefined),
        ),
    );
  } catch {
    /* offline / blocked — system fallbacks still apply */
  }

  clearFontAvailabilityCache();
}

export function listUsableFonts(fonts: FontOption[]): FontOption[] {
  return fonts.filter(
    (font) =>
      font.source === "workspace" ||
      font.google ||
      isFontAvailable(font.family),
  );
}
