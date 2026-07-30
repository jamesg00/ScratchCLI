import { describe, expect, it } from "vitest";
import {
  extractPracticeFile,
  expandPracticeCommand,
  extractPracticeKey,
  ensurePracticeTrackingLines,
} from "./practiceFile";

describe("extractPracticeFile", () => {
  it("pulls a fenced practice scaffold and file name", () => {
    const reply = [
      "Here is an Easy problem.",
      "```python",
      "# FILE: pair_sum.py",
      '"""Title: Pair Sum',
      "Difficulty: Easy",
      '"""',
      "",
      "def pair_sum(nums: list[int], target: int) -> bool:",
      "    pass",
      "",
      'if __name__ == "__main__":',
      "    passed = 0",
      "    total = 1",
      "    try:",
      "        ok = pair_sum([1, 2], 3) is True",
      '        print("PASS" if ok else "FAIL", "example")',
      "        passed += int(ok)",
      "    except Exception:",
      '        print("FAIL", "example")',
      '    print(f"{passed}/{total} passed")',
      "```",
    ].join("\n");

    const file = extractPracticeFile(reply);
    expect(file?.fileName).toBe("pair_sum.py");
    expect(file?.content).toContain("def pair_sum");
    expect(file?.content).toContain("pass");
    expect(file?.content).toContain('if __name__ == "__main__"');
    expect(file?.content.startsWith("# FILE: pair_sum.py")).toBe(true);
  });

  it("accepts reference + CASES without pass", () => {
    const reply = [
      "Try this.",
      "```python",
      "# FILE: cycle_vowels.py",
      '"""Cycle vowels."""',
      "",
      "def cycle_vowels(s: str) -> str:",
      "    return s[::-1]",
      "",
      'if __name__ == "__main__":',
      "    CASES = [",
      '        ("ab",),',
      "    ]",
      "```",
    ].join("\n");
    const file = extractPracticeFile(reply);
    expect(file?.fileName).toBe("cycle_vowels.py");
    expect(file?.content).toContain("CASES");
  });
});

describe("expandPracticeCommand", () => {
  it("routes easy/medium/oa/next to invent + seal (not LeetCode fetch)", () => {
    for (const cmd of ["easy", "medium", "oa", "next"] as const) {
      const result = expandPracticeCommand(cmd, cmd);
      expect(result?.kind).toBe("grok");
      if (result?.kind === "grok") {
        expect(result.createFile).toBe(true);
        expect(result.prompt).toMatch(/CASES/);
        expect(result.prompt).toMatch(/INPUTS ONLY/);
      }
    }
  });

  it("routes invent to Grok create-file", () => {
    const result = expandPracticeCommand("invent", "invent");
    expect(result?.kind).toBe("grok");
    if (result?.kind === "grok") {
      expect(result.createFile).toBe(true);
      expect(result.prompt).toMatch(/CASES/);
      expect(result.prompt).toMatch(/INPUTS ONLY/);
    }
  });

  it("parses leetcode slug and done", () => {
    expect(
      expandPracticeCommand("leetcode two-sum", "leetcode two-sum"),
    ).toEqual({
      kind: "leetcode",
      mode: "slug",
      slugOrId: "two-sum",
    });
    expect(expandPracticeCommand("done", "done")).toEqual({ kind: "done" });
    expect(expandPracticeCommand("done reset", "done reset")).toEqual({
      kind: "done-reset",
    });
    expect(expandPracticeCommand("done list", "done list")).toEqual({
      kind: "done-list",
    });
    expect(expandPracticeCommand("progress", "progress")).toEqual({
      kind: "done-list",
    });
    expect(expandPracticeCommand("submit", "submit")).toEqual({
      kind: "submit",
    });
    expect(expandPracticeCommand("grade", "grade")).toEqual({
      kind: "submit",
    });
  });

  it("marks hint as guide-only (no file, annotate buffer)", () => {
    const result = expandPracticeCommand("hint", "hint");
    expect(result?.kind).toBe("grok");
    if (result?.kind === "grok") {
      expect(result.createFile).toBe(false);
      expect(result.guideBuffer).toBe(true);
      expect(result.prompt).toMatch(/L12:/);
      expect(result.prompt).toMatch(/Do NOT paste my whole file/);
    }
  });

  it("marks advice and review as guide-only too", () => {
    expect(expandPracticeCommand("advice", "advice")).toMatchObject({
      kind: "grok",
      guideBuffer: true,
    });
    expect(expandPracticeCommand("review", "review")).toMatchObject({
      kind: "grok",
      guideBuffer: true,
    });
  });

  it("expands viz into a focused visualization prompt", () => {
    const result = expandPracticeCommand("viz", "viz");
    expect(result?.kind).toBe("grok");
    if (result?.kind === "grok") {
      expect(result.createFile).toBe(false);
      expect(result.prompt).toMatch(/```viz/);
      expect(result.prompt).toMatch(/kind/);
    }
  });
});

describe("extractPracticeKey / ensurePracticeTrackingLines", () => {
  it("prefers # LC: then falls back to # FILE stem", () => {
    expect(extractPracticeKey("# LC: two-sum\n")).toBe("two-sum");
    expect(extractPracticeKey("# FILE: pair_sum.py\n")).toBe("pair-sum");
  });

  it("injects # LC from file stem when missing", () => {
    const out = ensurePracticeTrackingLines({
      fileName: "pair_sum.py",
      content: "# FILE: pair_sum.py\ndef f():\n    pass\n",
    });
    expect(out.content).toMatch(/# LC: pair-sum/);
  });
});
