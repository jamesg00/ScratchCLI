import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyScore } from "./fuzzy";

describe("fuzzyScore", () => {
  it("ranks exact and prefix higher", () => {
    expect(fuzzyScore("run", "run")).toBeGreaterThan(
      fuzzyScore("run", "rerun"),
    );
    expect(fuzzyScore("sa", "save")).toBeGreaterThan(
      fuzzyScore("sa", "visual"),
    );
  });

  it("returns -1 when characters missing", () => {
    expect(fuzzyScore("xyz", "abc")).toBe(-1);
  });
});

describe("fuzzyFilter", () => {
  it("orders by score", () => {
    const items = ["visualize", "save", "run buffer"];
    expect(fuzzyFilter(items, "sa", (s) => s)[0]).toBe("save");
  });
});
