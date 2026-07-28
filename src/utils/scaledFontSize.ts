/** Map preferred font size through current window size (Ctrl+/- still changes the base). */
export function scaledFontSize(
  preferredPx: number,
  width = typeof window !== "undefined" ? window.innerWidth : 960,
  height = typeof window !== "undefined" ? window.innerHeight : 700,
): number {
  const widthScale = width / 960;
  const heightScale = height / 700;
  const scale = Math.min(
    1.35,
    Math.max(0.78, Math.sqrt(widthScale * heightScale)),
  );
  return Math.min(36, Math.max(10, Math.round(preferredPx * scale)));
}
