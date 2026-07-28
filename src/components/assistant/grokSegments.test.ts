import { describe, expect, it } from "vitest";
import { parseGrokSegments } from "./grokSegments";

describe("parseGrokSegments", () => {
  it("keeps plain text", () => {
    expect(parseGrokSegments("try a hint first")).toEqual([
      { kind: "text", text: "try a hint first" },
    ]);
  });

  it("parses a python fence", () => {
    const source = "Here:\n```python\ndef foo():\n  return 1\n```\nNice.";
    expect(parseGrokSegments(source)).toEqual([
      { kind: "text", text: "Here:" },
      {
        kind: "code",
        lang: "python",
        code: "def foo():\n  return 1",
        complete: true,
        important: false,
      },
      { kind: "text", text: "Nice." },
    ]);
  });

  it("defaults untagged code to python when it looks like python", () => {
    const source = "```\ndef bar():\n  pass\n```";
    const [segment] = parseGrokSegments(source, "markdown");
    expect(segment).toMatchObject({
      kind: "code",
      lang: "python",
      complete: true,
      important: false,
    });
  });

  it("marks an open fence as incomplete while streaming", () => {
    const source = "```python\nx = 1";
    expect(parseGrokSegments(source)).toEqual([
      {
        kind: "code",
        lang: "python",
        code: "x = 1",
        complete: false,
        important: false,
      },
    ]);
  });

  it("marks python important fences", () => {
    const source = "```python important\nx = 1\n```";
    expect(parseGrokSegments(source)[0]).toMatchObject({
      kind: "code",
      lang: "python",
      important: true,
      complete: true,
    });
  });
});
