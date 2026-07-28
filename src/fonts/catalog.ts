export type FontGroup =
  "coding" | "retro" | "display" | "serif" | "system" | "workspace";

export type FontOption = {
  label: string;
  /** Primary family name used for detection and @font-face matching. */
  family: string;
  /** Full CSS font-family stack applied to the UI. */
  value: string;
  source: "system" | "workspace" | "web";
  group: FontGroup;
  /** Google Fonts family query, when we can load it as a web font. */
  google?: string;
};

export const FONT_GROUP_LABELS: Record<FontGroup, string> = {
  coding: "Coding mono",
  retro: "Retro / pixel",
  display: "Display / UI",
  serif: "Editorial serif",
  system: "System",
  workspace: "Workspace",
};

function web(
  label: string,
  family: string,
  google: string,
  group: FontGroup,
  fallback = "monospace",
): FontOption {
  const quoted = family.includes(" ") ? `"${family}"` : family;
  return {
    label,
    family,
    value: `${quoted}, Consolas, ${fallback}`,
    source: "web",
    group,
    google,
  };
}

function webSans(label: string, family: string, google: string): FontOption {
  return web(label, family, google, "display", "system-ui, sans-serif");
}

function webSerif(label: string, family: string, google: string): FontOption {
  return web(label, family, google, "serif", "Georgia, serif");
}

function webMono(label: string, family: string, google: string): FontOption {
  return web(label, family, google, "coding");
}

function webRetro(
  label: string,
  family: string,
  google: string,
  fallback = "monospace",
): FontOption {
  return web(label, family, google, "retro", fallback);
}

function systemFont(label: string, family: string, value: string): FontOption {
  return { label, family, value, source: "system", group: "system" };
}

/** Cool web faces first so they show up immediately in pickers. */
export const SYSTEM_FONTS: FontOption[] = [
  // —— Coding monos ——
  webMono("JetBrains Mono", "JetBrains Mono", "JetBrains+Mono:wght@400;600"),
  webMono("Fira Code", "Fira Code", "Fira+Code:wght@400;600"),
  webMono("Victor Mono", "Victor Mono", "Victor+Mono:wght@400;600"),
  webMono("Space Mono", "Space Mono", "Space+Mono:wght@400;700"),
  webMono("Source Code Pro", "Source Code Pro", "Source+Code+Pro:wght@400;600"),
  webMono("IBM Plex Mono", "IBM Plex Mono", "IBM+Plex+Mono:wght@400;600"),
  webMono("Roboto Mono", "Roboto Mono", "Roboto+Mono:wght@400;600"),
  webMono("Inconsolata", "Inconsolata", "Inconsolata:wght@400;700"),
  webMono("Ubuntu Mono", "Ubuntu Mono", "Ubuntu+Mono:wght@400;700"),
  webMono("Anonymous Pro", "Anonymous Pro", "Anonymous+Pro:wght@400;700"),
  webMono("Overpass Mono", "Overpass Mono", "Overpass+Mono:wght@400;600"),
  webMono("Red Hat Mono", "Red Hat Mono", "Red+Hat+Mono:wght@400;600"),
  webMono("Noto Sans Mono", "Noto Sans Mono", "Noto+Sans+Mono:wght@400;600"),
  webMono("Martian Mono", "Martian Mono", "Martian+Mono:wght@400;600"),
  webMono("Azeret Mono", "Azeret Mono", "Azeret+Mono:wght@400;600"),
  webMono("Fragment Mono", "Fragment Mono", "Fragment+Mono"),
  webMono("Sometype Mono", "Sometype Mono", "Sometype+Mono:wght@400;600"),
  webMono("Courier Prime", "Courier Prime", "Courier+Prime:wght@400;700"),
  webMono("Share Tech Mono", "Share Tech Mono", "Share+Tech+Mono"),
  webMono("DM Mono", "DM Mono", "DM+Mono:wght@400;500"),
  webMono("Recursive", "Recursive", "Recursive:wght@400;600"),
  webMono("PT Mono", "PT Mono", "PT+Mono"),
  webMono("Nova Mono", "Nova Mono", "Nova+Mono"),
  webMono("Major Mono Display", "Major Mono Display", "Major+Mono+Display"),

  // —— Retro / pixel ——
  webRetro("VT323", "VT323", "VT323"),
  webRetro("Silkscreen", "Silkscreen", "Silkscreen:wght@400;700"),
  webRetro("Pixelify Sans", "Pixelify Sans", "Pixelify+Sans:wght@400;600"),
  webRetro("Press Start 2P", "Press Start 2P", "Press+Start+2P"),
  webRetro("Sixtyfour", "Sixtyfour", "Sixtyfour", "system-ui, sans-serif"),
  webRetro("Jersey 10", "Jersey 10", "Jersey+10", "system-ui, sans-serif"),
  webRetro("Jersey 15", "Jersey 15", "Jersey+15", "system-ui, sans-serif"),
  webRetro(
    "DotGothic16",
    "DotGothic16",
    "DotGothic16",
    "system-ui, sans-serif",
  ),
  webRetro("Share Tech", "Share Tech", "Share+Tech", "system-ui, sans-serif"),
  webRetro("Audiowide", "Audiowide", "Audiowide", "system-ui, sans-serif"),
  webRetro(
    "Electrolize",
    "Electrolize",
    "Electrolize",
    "system-ui, sans-serif",
  ),
  webRetro("Iceland", "Iceland", "Iceland", "system-ui, sans-serif"),
  webRetro("Wallpoet", "Wallpoet", "Wallpoet", "system-ui, sans-serif"),
  webRetro("Monofett", "Monofett", "Monofett"),
  webRetro(
    "Syncopate",
    "Syncopate",
    "Syncopate:wght@400;700",
    "system-ui, sans-serif",
  ),
  webRetro(
    "Handjet",
    "Handjet",
    "Handjet:wght@400;600",
    "system-ui, sans-serif",
  ),

  // —— Display / UI ——
  webSans("Space Grotesk", "Space Grotesk", "Space+Grotesk:wght@400;600"),
  webSans("Syne", "Syne", "Syne:wght@400;700"),
  webSans("Outfit", "Outfit", "Outfit:wght@400;600"),
  webSans("Manrope", "Manrope", "Manrope:wght@400;600"),
  webSans("Sora", "Sora", "Sora:wght@400;600"),
  webSans("Figtree", "Figtree", "Figtree:wght@400;600"),
  webSans(
    "Plus Jakarta Sans",
    "Plus Jakarta Sans",
    "Plus+Jakarta+Sans:wght@400;600",
  ),
  webSans(
    "Bricolage Grotesque",
    "Bricolage Grotesque",
    "Bricolage+Grotesque:wght@400;600",
  ),
  webSans("Chakra Petch", "Chakra Petch", "Chakra+Petch:wght@400;600"),
  webSans("Orbitron", "Orbitron", "Orbitron:wght@400;700"),
  webSans("Exo 2", "Exo 2", "Exo+2:wght@400;600"),
  webSans("Rajdhani", "Rajdhani", "Rajdhani:wght@400;600"),
  webSans("Archivo", "Archivo", "Archivo:wght@400;600"),
  webSans("Bebas Neue", "Bebas Neue", "Bebas+Neue"),
  webSans("Oswald", "Oswald", "Oswald:wght@400;600"),
  webSans("Righteous", "Righteous", "Righteous"),
  webSans("IBM Plex Sans", "IBM Plex Sans", "IBM+Plex+Sans:wght@400;600"),
  webSans("DM Sans", "DM Sans", "DM+Sans:wght@400;600"),
  webSans("Instrument Sans", "Instrument Sans", "Instrument+Sans:wght@400;600"),
  webSans(
    "Atkinson Hyperlegible",
    "Atkinson Hyperlegible",
    "Atkinson+Hyperlegible:wght@400;700",
  ),
  webSans("Libre Franklin", "Libre Franklin", "Libre+Franklin:wght@400;600"),

  // —— Editorial serif ——
  webSerif("Instrument Serif", "Instrument Serif", "Instrument+Serif"),
  webSerif("Fraunces", "Fraunces", "Fraunces:wght@400;600"),
  webSerif("Newsreader", "Newsreader", "Newsreader:wght@400;600"),
  webSerif("Literata", "Literata", "Literata:wght@400;600"),
  webSerif("Source Serif 4", "Source Serif 4", "Source+Serif+4:wght@400;600"),
  webSerif(
    "Playfair Display",
    "Playfair Display",
    "Playfair+Display:wght@400;700",
  ),
  webSerif("EB Garamond", "EB Garamond", "EB+Garamond:wght@400;600"),
  webSerif(
    "Cormorant Garamond",
    "Cormorant Garamond",
    "Cormorant+Garamond:wght@400;600",
  ),
  webSerif("Lora", "Lora", "Lora:wght@400;600"),
  webSerif("Merriweather", "Merriweather", "Merriweather:wght@400;700"),
  webSerif("Crimson Pro", "Crimson Pro", "Crimson+Pro:wght@400;600"),
  webSerif("Spectral", "Spectral", "Spectral:wght@400;600"),
  webSerif(
    "Libre Baskerville",
    "Libre Baskerville",
    "Libre+Baskerville:wght@400;700",
  ),
  webSerif("Special Elite", "Special Elite", "Special+Elite"),
  webSerif("DM Serif Display", "DM Serif Display", "DM+Serif+Display"),

  // —— System (Windows staples) ——
  systemFont(
    "Cascadia Code",
    "Cascadia Code",
    '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
  ),
  systemFont(
    "Cascadia Mono",
    "Cascadia Mono",
    '"Cascadia Mono", "Cascadia Code", Consolas, monospace',
  ),
  systemFont("Consolas", "Consolas", 'Consolas, "Courier New", monospace'),
  systemFont("Courier New", "Courier New", '"Courier New", Courier, monospace'),
  systemFont(
    "Lucida Console",
    "Lucida Console",
    '"Lucida Console", Monaco, monospace',
  ),
  systemFont(
    "Lucida Sans Unicode",
    "Lucida Sans Unicode",
    '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
  ),
  systemFont("MS Gothic", "MS Gothic", '"MS Gothic", "MS PGothic", monospace'),
  systemFont("Segoe UI", "Segoe UI", '"Segoe UI", system-ui, sans-serif'),
  systemFont(
    "Segoe UI Variable",
    "Segoe UI Variable",
    '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
  ),
  systemFont("Arial", "Arial", "Arial, Helvetica, sans-serif"),
  systemFont("Calibri", "Calibri", "Calibri, Candara, sans-serif"),
  systemFont("Cambria", "Cambria", 'Cambria, "Times New Roman", serif'),
  systemFont("Georgia", "Georgia", 'Georgia, "Times New Roman", serif'),
  systemFont(
    "Times New Roman",
    "Times New Roman",
    '"Times New Roman", Times, serif',
  ),
  systemFont("Tahoma", "Tahoma", "Tahoma, Geneva, sans-serif"),
  systemFont("Verdana", "Verdana", "Verdana, Geneva, sans-serif"),
  systemFont(
    "Trebuchet MS",
    "Trebuchet MS",
    '"Trebuchet MS", Helvetica, sans-serif',
  ),
  systemFont(
    "Comic Sans MS",
    "Comic Sans MS",
    '"Comic Sans MS", "Comic Sans", cursive',
  ),
  systemFont("Impact", "Impact", "Impact, Haettenschweiler, sans-serif"),
];

export const DEFAULT_FONT =
  SYSTEM_FONTS.find((font) => font.family === "Consolas") ?? SYSTEM_FONTS[0]!;

export function workspaceFontOption(family: string): FontOption {
  const quoted = family.includes(" ") ? `"${family}"` : family;
  return {
    label: family,
    family,
    value: `${quoted}, Consolas, monospace`,
    source: "workspace",
    group: "workspace",
  };
}

export function findFontByLabel(
  fonts: FontOption[],
  query: string,
): FontOption | undefined {
  const normalized = query.trim().toLowerCase();
  return (
    fonts.find((font) => font.label.toLowerCase() === normalized) ??
    fonts.find((font) => font.family.toLowerCase() === normalized) ??
    fonts.find((font) => font.label.toLowerCase().includes(normalized)) ??
    fonts.find((font) => font.value.toLowerCase().includes(normalized))
  );
}

export function findFontByValue(
  fonts: FontOption[],
  value: string,
): FontOption | undefined {
  return fonts.find((font) => font.value === value);
}

export function groupFonts(fonts: FontOption[]): Array<{
  group: FontGroup;
  label: string;
  fonts: FontOption[];
}> {
  const order: FontGroup[] = [
    "coding",
    "retro",
    "display",
    "serif",
    "system",
    "workspace",
  ];
  return order
    .map((group) => ({
      group,
      label: FONT_GROUP_LABELS[group],
      fonts: fonts.filter((font) => font.group === group),
    }))
    .filter((section) => section.fonts.length > 0);
}
