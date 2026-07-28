import { describe, expect, it } from "vitest";
import { parseGrokSegments } from "./grokSegments";
import { parseVizPlan } from "./vizPlan";

describe("parseVizPlan", () => {
  it("parses a valid viz plan", () => {
    const plan = parseVizPlan(
      JSON.stringify({
        title: "Two pointers",
        code: ["def f(a):", "  i = 0"],
        steps: [
          {
            line: 1,
            vars: { i: 0 },
            arrays: { a: { values: [1, 2], highlights: { "0": "i" } } },
            note: "start",
          },
        ],
      }),
    );
    expect(plan?.title).toBe("Two pointers");
    expect(plan?.steps).toHaveLength(1);
    expect(plan?.steps[0]?.arrays?.a.highlights?.["0"]).toBe("i");
  });

  it("parses kind", () => {
    const plan = parseVizPlan(
      JSON.stringify({
        kind: "sliding_window",
        title: "Window",
        code: ["for r in range(n):"],
        steps: [{ line: 0, vars: { r: 0 } }],
      }),
    );
    expect(plan?.kind).toBe("sliding_window");
  });

  it("rejects invalid JSON", () => {
    expect(parseVizPlan("not json")).toBeNull();
  });
});

describe("parseGrokSegments viz", () => {
  it("parses a complete viz fence", () => {
    const source = [
      "Here is a walkthrough",
      "```viz",
      JSON.stringify({
        title: "Demo",
        code: ["x = 1"],
        steps: [{ line: 0, vars: { x: 1 } }],
      }),
      "```",
    ].join("\n");
    const segments = parseGrokSegments(source);
    expect(segments[0]).toMatchObject({ kind: "text" });
    expect(segments[1]).toMatchObject({
      kind: "viz",
      complete: true,
    });
    if (segments[1]?.kind === "viz") {
      expect(segments[1].plan?.title).toBe("Demo");
    }
  });

  it("keeps incomplete viz as loading placeholder data", () => {
    const segments = parseGrokSegments('```viz\n{"title"');
    expect(segments[0]).toMatchObject({
      kind: "viz",
      complete: false,
      plan: null,
    });
  });
});
