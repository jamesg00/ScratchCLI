import { describe, expect, it } from "vitest";
import { looksLikePracticeFile, parseTestOutput } from "./parseTestOutput";

describe("parseTestOutput", () => {
  it("parses PASS/FAIL lines and summary", () => {
    const raw = ["PASS case1", "FAIL case2", "PASS case3", "2/3 passed"].join(
      "\n",
    );
    const summary = parseTestOutput(raw);
    expect(summary?.passed).toBe(2);
    expect(summary?.total).toBe(3);
    expect(summary?.cases).toHaveLength(3);
  });

  it("returns null for empty noise", () => {
    expect(parseTestOutput("hello world")).toBeNull();
  });
});

describe("looksLikePracticeFile", () => {
  it("detects main block", () => {
    expect(
      looksLikePracticeFile('if __name__ == "__main__":\n  print("PASS")'),
    ).toBe(true);
  });
});
