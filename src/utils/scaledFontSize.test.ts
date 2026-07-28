import { describe, expect, it } from "vitest";
import { scaledFontSize } from "./scaledFontSize";

describe("scaledFontSize", () => {
  it("keeps preferred size near the reference window", () => {
    expect(scaledFontSize(14, 960, 700)).toBe(14);
  });

  it("shrinks on a smaller window", () => {
    expect(scaledFontSize(14, 640, 480)).toBeLessThan(14);
  });

  it("grows on a larger window", () => {
    expect(scaledFontSize(14, 1600, 1000)).toBeGreaterThan(14);
  });

  it("stays within bounds", () => {
    expect(scaledFontSize(10, 400, 300)).toBeGreaterThanOrEqual(10);
    expect(scaledFontSize(30, 2400, 1600)).toBeLessThanOrEqual(36);
  });
});
