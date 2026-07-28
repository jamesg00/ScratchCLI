import { describe, expect, it } from "vitest";
import { extractVizInputs } from "./vizExtract";

describe("extractVizInputs", () => {
  it("extracts named list and target", () => {
    const inputs = extractVizInputs(`
nums = [1, 2, 4, 6, 8]
target = 9
def two_sum_sorted(nums, target):
    pass
`);
    expect(inputs).not.toBeNull();
    expect(inputs!.arrays[0]?.name).toBe("nums");
    expect(inputs!.arrays[0]?.values).toEqual([1, 2, 4, 6, 8]);
    expect(inputs!.target).toBe(9);
    expect(inputs!.summary).toMatch(/nums=/);
  });

  it("extracts list from assert-style call", () => {
    const inputs = extractVizInputs(`
assert pair_sum([2, 7, 11, 15], 9) == [0, 1]
`);
    expect(inputs).not.toBeNull();
    expect(inputs!.arrays[0]?.values).toEqual([2, 7, 11, 15]);
    expect(inputs!.target).toBe(9);
  });

  it("extracts parentheses string", () => {
    const inputs = extractVizInputs(`
def is_valid(s):
    stack = []
    for ch in s:
        pass

assert is_valid("([])") is True
`);
    expect(inputs).not.toBeNull();
    expect(inputs!.strings.some((s) => s.includes("("))).toBe(true);
  });

  it("returns null for empty prose", () => {
    expect(extractVizInputs("just some notes without lists")).toBeNull();
  });
});
