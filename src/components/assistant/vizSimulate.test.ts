import { describe, expect, it } from "vitest";
import { buildLocalVizPlan, simulateVizPlan } from "./vizSimulate";
import { extractVizInputs } from "./vizExtract";

describe("simulateVizPlan", () => {
  it("two_pointers walks L/R on extracted nums", () => {
    const inputs = extractVizInputs(`
nums = [1, 2, 4, 6, 8]
target = 9
`);
    expect(inputs).not.toBeNull();
    const plan = simulateVizPlan("two_pointers", inputs!);
    expect(plan).not.toBeNull();
    expect(plan!.kind).toBe("two_pointers");
    expect(plan!.code.length).toBeGreaterThan(0);
    expect(plan!.steps.length).toBeGreaterThan(1);
    const first = plan!.steps[0]!;
    const values = first.arrays?.nums?.values;
    expect(values).toEqual([1, 2, 4, 6, 8]);
    for (const step of plan!.steps) {
      const arr = step.arrays?.nums;
      if (!arr?.highlights) continue;
      for (const key of Object.keys(arr.highlights)) {
        const idx = Number(key);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(arr.values.length);
      }
    }
  });

  it("binary_search finds target", () => {
    const inputs = extractVizInputs(`
nums = [1, 3, 4, 6, 7, 9, 12]
target = 7
`);
    const plan = simulateVizPlan("binary_search", inputs!);
    expect(plan).not.toBeNull();
    expect(
      plan!.steps.some((s) => s.note?.toLowerCase().includes("found")),
    ).toBe(true);
  });

  it("stack validates parentheses string", () => {
    const inputs = extractVizInputs(`s = "([])"`);
    const plan = simulateVizPlan("stack", inputs!);
    expect(plan).not.toBeNull();
    expect(plan!.kind).toBe("stack");
    expect(plan!.steps.length).toBeGreaterThan(2);
  });
});

describe("buildLocalVizPlan", () => {
  it("simulates from buffer when inputs exist", () => {
    const result = buildLocalVizPlan(`
# two pointers
nums = [2, 7, 11, 15]
target = 9
left, right = 0, len(nums) - 1
while left < right:
    pass
`);
    expect(result.source).toBe("simulated");
    expect(result.summary).toMatch(/nums=/);
    expect(result.plan.steps.length).toBeGreaterThan(0);
  });

  it("falls back to template without inputs", () => {
    const result = buildLocalVizPlan("todo: invent algorithm later");
    expect(result.source).toBe("template");
    expect(result.plan.code.length).toBeGreaterThan(0);
  });
});
