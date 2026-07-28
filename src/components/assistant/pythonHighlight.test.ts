import { describe, expect, it } from "vitest";
import { parsePythonLines, tokenizePythonLine } from "./pythonHighlight";

describe("tokenizePythonLine", () => {
  it("colors keywords and strings", () => {
    const tokens = tokenizePythonLine('def foo(): return "hi"');
    expect(tokens.map((token) => token.kind)).toContain("keyword");
    expect(tokens.map((token) => token.kind)).toContain("defname");
    expect(tokens.map((token) => token.kind)).toContain("string");
  });
});

describe("parsePythonLines", () => {
  it("marks #! prefixed lines as important and strips the marker", () => {
    const [line] = parsePythonLines("#! return total");
    expect(line.important).toBe(true);
    expect(line.tokens.map((token) => token.text).join("")).toBe(
      "return total",
    );
  });

  it("marks return lines as important", () => {
    const [line] = parsePythonLines("    return total");
    expect(line.important).toBe(true);
  });
});
