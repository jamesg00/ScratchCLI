import { describe, expect, it } from "vitest";
import {
  findPrettyMatches,
  glyphForIdentifier,
  maskedRanges,
} from "./prettySymbols";

describe("glyphForIdentifier", () => {
  it("maps pi and greek names", () => {
    expect(glyphForIdentifier("pi")).toBe("π");
    expect(glyphForIdentifier("alpha")).toBe("α");
    expect(glyphForIdentifier("theta")).toBe("θ");
  });

  it("does not map lambda keyword", () => {
    expect(glyphForIdentifier("lambda")).toBeNull();
  });
});

describe("maskedRanges", () => {
  it("masks comments and strings", () => {
    const text = `x = 1 # hi\ns = "pi != 3"`;
    const masks = maskedRanges(text);
    expect(masks.some((m) => text.slice(m.from, m.to).includes("#"))).toBe(
      true,
    );
    expect(masks.some((m) => text.slice(m.from, m.to).includes('"'))).toBe(
      true,
    );
  });
});

describe("findPrettyMatches", () => {
  it("maps operators outside strings", () => {
    const matches = findPrettyMatches("if a != b and c == d:\n  pass");
    const glyphs = matches.map((m) => m.glyph);
    expect(glyphs).toContain("≠");
    expect(glyphs).toContain("≡");
  });

  it("skips operators inside strings", () => {
    const matches = findPrettyMatches(`s = "a != b"`);
    expect(matches.filter((m) => m.glyph === "≠")).toHaveLength(0);
  });

  it("maps math.pi and bare pi", () => {
    const matches = findPrettyMatches("r = 2 * math.pi\narea = pi * r");
    expect(matches.some((m) => m.glyph === "π")).toBe(true);
  });

  it("does not replace lambda keyword", () => {
    const matches = findPrettyMatches("f = lambda x: x");
    expect(matches.some((m) => m.from === 4)).toBe(false);
  });

  it("maps <= >= ->", () => {
    const matches = findPrettyMatches("def f(x) -> int:\n  return x <= 1");
    const glyphs = matches.map((m) => m.glyph);
    expect(glyphs).toContain("→");
    expect(glyphs).toContain("≤");
  });
});
