import { describe, expect, it } from "vitest";
import { estimatePythonComplexity } from "./complexityEstimate";

describe("estimatePythonComplexity", () => {
  it("detects nested loops and linear auxiliary storage", () => {
    expect(
      estimatePythonComplexity(
        "seen = set()\nfor left in nums:\n    for right in nums:\n        seen.add(left + right)\n",
      ),
    ).toMatchObject({ time: "O(n^2)", space: "O(n)" });
  });
});
