import { describe, expect, it } from "vitest";
import { buildVizPrompt, extractVizPlanFromReply } from "./vizPrompt";

describe("buildVizPrompt", () => {
  it("asks for kind and a viz fence", () => {
    const prompt = buildVizPrompt();
    expect(prompt).toMatch(/```viz/);
    expect(prompt).toMatch(/kind/);
    expect(prompt).toMatch(/two_pointers/);
    expect(prompt).toMatch(/linked_list/);
    expect(prompt).toMatch(/asserts/);
  });
});

describe("extractVizPlanFromReply", () => {
  it("extracts a fenced plan with kind", () => {
    const reply = [
      "Sliding window walkthrough.",
      "```viz",
      JSON.stringify({
        kind: "sliding_window",
        title: "Max window",
        code: ["while r < n:"],
        steps: [{ line: 0, vars: { r: 0 }, note: "grow" }],
      }),
      "```",
    ].join("\n");
    const plan = extractVizPlanFromReply(reply);
    expect(plan?.kind).toBe("sliding_window");
    expect(plan?.title).toBe("Max window");
    expect(plan?.steps).toHaveLength(1);
  });
});
