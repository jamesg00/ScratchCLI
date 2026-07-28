import { describe, expect, it, vi } from "vitest";
import { extractPracticeFile } from "./practiceFile";
import {
  parseSealStdout,
  rebuildSealedClassContent,
  rebuildSealedContent,
  sealPracticeFile,
  toPythonLiteral,
} from "./sealPracticeTests";

const VOWEL_REF = `# FILE: vowel_swap.py
"""
Title: Vowel Swap
Difficulty: Easy

Problem:
Cycle each vowel to the next vowel in the string (wrap).

Examples:
Example 1:
Input: s = "hello"
Output: "WRONG"
"""

def vowel_swap(s: str) -> str:
    vowels = [c for c in s if c in "aeiou"]
    if not vowels:
        return s
    out = []
    i = 0
    for c in s:
        if c in "aeiou":
            out.append(vowels[(i + 1) % len(vowels)])
            i += 1
        else:
            out.append(c)
    return "".join(out)


if __name__ == "__main__":
    CASES = [
        ("hello",),
        ("aei",),
        ("bcd",),
        ("a",),
        ("aeiou",),
    ]
`;

describe("toPythonLiteral", () => {
  it("maps JSON-ish values to Python", () => {
    expect(toPythonLiteral(null)).toBe("None");
    expect(toPythonLiteral(true)).toBe("True");
    expect(toPythonLiteral("hi")).toBe('"hi"');
    expect(toPythonLiteral([1, 2])).toBe("[1, 2]");
  });
});

describe("rebuildSealedContent", () => {
  it("stubs pass and seals expecteds from computed results", () => {
    const content = rebuildSealedContent({
      fileName: "vowel_swap.py",
      preamble: `# FILE: vowel_swap.py
"""
Title: Vowel Swap
Examples:
Example 1:
    Input: bad
    Output: bad
"""`,
      fnName: "vowel_swap",
      signature: "vowel_swap(s: str) -> str",
      cases: [["hello"], ["aei"], ["aeiou"]],
      results: ["holle", "eia", "eioua"],
    });

    expect(content).toContain("def vowel_swap(s: str) -> str:");
    expect(content).toMatch(/\n\s+pass\s*\n/);
    expect(content).toContain('("hello", "holle")');
    expect(content).toContain('("aei", "eia")');
    expect(content).toContain('("aeiou", "eioua")');
    expect(content).toContain('Output: "holle"');
    expect(content).not.toContain("CASES");
  });
});

describe("rebuildSealedClassContent", () => {
  it("stubs class methods and seals ops/args expecteds", () => {
    const content = rebuildSealedClassContent({
      fileName: "find_median_from_data_stream.py",
      preamble: `# FILE: find_median_from_data_stream.py
"""MedianFinder"""`,
      className: "MedianFinder",
      methods: [
        { name: "__init__", signature: "__init__(self)" },
        { name: "addNum", signature: "addNum(self, num: int) -> None" },
        { name: "findMedian", signature: "findMedian(self) -> float" },
      ],
      cases: [
        [
          [
            "MedianFinder",
            "addNum",
            "addNum",
            "findMedian",
            "addNum",
            "findMedian",
          ],
          [[], [1], [2], [], [3], []],
        ],
      ],
      results: [[null, null, null, 1.5, null, 2.0]],
    });

    expect(content).toContain("class MedianFinder:");
    expect(content).toContain("def addNum(self, num: int) -> None:");
    expect(content).toContain("def findMedian(self) -> float:");
    expect(content).toMatch(/\n\s+pass\s*\n/);
    expect(content).toContain('"MedianFinder"');
    expect(content).toContain("1.5");
    expect(content).toContain("ops=");
  });
});

describe("parseSealStdout", () => {
  it("rebuilds from runner JSON payload", () => {
    const payload = {
      ok: true,
      fileName: "vowel_swap.py",
      fnName: "vowel_swap",
      signature: "vowel_swap(s: str) -> str",
      preamble: `# FILE: vowel_swap.py\n"""Vowel Swap"""`,
      cases: [["hello"], ["aei"]],
      results: ["holle", "eia"],
    };
    const sealed = parseSealStdout(JSON.stringify(payload));
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(sealed.file.content).toContain('("hello", "holle")');
      expect(sealed.file.content).toContain("pass");
    }
  });

  it("surfaces sealer errors", () => {
    const sealed = parseSealStdout(
      JSON.stringify({ ok: false, error: "CASES missing" }),
    );
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) expect(sealed.error).toMatch(/CASES/);
  });
});

describe("extractPracticeFile + CASES", () => {
  it("accepts reference solution + CASES without pass", () => {
    const reply = ["Here you go.", "```python", VOWEL_REF, "```"].join("\n");
    const file = extractPracticeFile(reply);
    expect(file?.fileName).toBe("vowel_swap.py");
    expect(file?.content).toContain("CASES");
    expect(file?.content).toContain("def vowel_swap");
  });
});

describe("sealPracticeFile", () => {
  it("uses runPython and rebuilds a sealed harness", async () => {
    const runPython = vi.fn(async () => ({
      stdout: JSON.stringify({
        ok: true,
        fileName: "vowel_swap.py",
        fnName: "vowel_swap",
        signature: "vowel_swap(s: str) -> str",
        preamble: `# FILE: vowel_swap.py\n"""Vowel Swap"""`,
        cases: [["hello"], ["aei"], ["aeiou"]],
        results: ["holle", "eia", "eioua"],
      }),
      stderr: "",
      exitCode: 0,
      durationMs: 1,
      truncated: false,
    }));

    const sealed = await sealPracticeFile(
      { fileName: "vowel_swap.py", content: VOWEL_REF },
      runPython as never,
    );
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(sealed.file.content).toContain('("hello", "holle")');
      expect(sealed.file.content).toContain('("aeiou", "eioua")');
      expect(sealed.file.content).toMatch(/\n\s+pass\s*\n/);
    }
    expect(runPython).toHaveBeenCalledOnce();
  });

  it("rejects files without CASES", async () => {
    const sealed = await sealPracticeFile({
      fileName: "x.py",
      content: `def f():\n    pass\n\nif __name__ == "__main__":\n    print("hi")\n`,
    });
    expect(sealed.ok).toBe(false);
  });

  it("rejects pass-only class stubs with a clear error", async () => {
    const stub = `# FILE: find_median_from_data_stream.py
"""MedianFinder stub"""
class MedianFinder:
    def __init__(self):
        pass
    def addNum(self, num: int) -> None:
        pass
    def findMedian(self) -> float:
        pass

if __name__ == "__main__":
    CASES = [
        (["MedianFinder", "addNum", "findMedian"], [[], [1], []]),
    ]
`;
    const runPython = vi.fn(async () => ({
      stdout: JSON.stringify({
        ok: false,
        error:
          "reference class is only pass stubs — need a WORKING implementation to seal tests",
      }),
      stderr: "",
      exitCode: 0,
      durationMs: 1,
      truncated: false,
    }));
    const sealed = await sealPracticeFile(
      { fileName: "find_median_from_data_stream.py", content: stub },
      runPython as never,
    );
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) expect(sealed.error).toMatch(/pass stubs|WORKING/i);
  });

  it("seals MedianFinder class ops/args harness", async () => {
    const runPython = vi.fn(async () => ({
      stdout: JSON.stringify({
        ok: true,
        kind: "class",
        fileName: "find_median_from_data_stream.py",
        className: "MedianFinder",
        methods: [
          { name: "__init__", signature: "__init__(self)" },
          { name: "addNum", signature: "addNum(self, num: int) -> None" },
          { name: "findMedian", signature: "findMedian(self) -> float" },
        ],
        preamble: `# FILE: find_median_from_data_stream.py\n"""MedianFinder"""`,
        cases: [
          [
            [
              "MedianFinder",
              "addNum",
              "addNum",
              "findMedian",
              "addNum",
              "findMedian",
            ],
            [[], [1], [2], [], [3], []],
          ],
        ],
        results: [[null, null, null, 1.5, null, 2.0]],
      }),
      stderr: "",
      exitCode: 0,
      durationMs: 1,
      truncated: false,
    }));

    const sealed = await sealPracticeFile(
      {
        fileName: "find_median_from_data_stream.py",
        content: `# FILE: find_median_from_data_stream.py
class MedianFinder:
    def __init__(self):
        self.x = []
    def addNum(self, num: int) -> None:
        self.x.append(num)
    def findMedian(self) -> float:
        return 1.5

if __name__ == "__main__":
    CASES = [
        (["MedianFinder", "addNum", "addNum", "findMedian", "addNum", "findMedian"], [[], [1], [2], [], [3], []]),
    ]
`,
      },
      runPython as never,
    );
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(sealed.file.content).toContain("class MedianFinder:");
      expect(sealed.file.content).toContain("ops=");
      expect(sealed.file.content).toContain("1.5");
      expect(sealed.file.content).toMatch(/\n\s+pass\s*\n/);
    }
  });

  it("e2e: seals MedianFinder via real Python runner", async () => {
    const { spawnSync } = await import("node:child_process");
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { buildSealRunner } = await import("./sealPracticeTests");

    const source = `# FILE: find_median_from_data_stream.py
"""Find Median from Data Stream"""
import heapq

class MedianFinder:
    def __init__(self):
        self.lo = []
        self.hi = []

    def addNum(self, num: int) -> None:
        heapq.heappush(self.lo, -num)
        heapq.heappush(self.hi, -heapq.heappop(self.lo))
        if len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def findMedian(self) -> float:
        if len(self.lo) > len(self.hi):
            return float(-self.lo[0])
        return (-self.lo[0] + self.hi[0]) / 2.0

if __name__ == "__main__":
    CASES = [
        (["MedianFinder", "addNum", "addNum", "findMedian", "addNum", "findMedian"], [[], [1], [2], [], [3], []]),
        (["MedianFinder", "addNum", "findMedian"], [[], [5], []]),
    ]
`;
    const runner = buildSealRunner(source, "find_median_from_data_stream.py");
    const path = join(tmpdir(), `scratchcli-seal-${Date.now()}.py`);
    writeFileSync(path, runner, "utf8");
    try {
      const r = spawnSync("python", [path], {
        encoding: "utf8",
        maxBuffer: 10_000_000,
      });
      expect(r.status).toBe(0);
      const sealed = parseSealStdout(r.stdout || "");
      expect(sealed.ok).toBe(true);
      if (sealed.ok) {
        expect(sealed.file.content).toContain("class MedianFinder:");
        expect(sealed.file.content).toContain("1.5");
        expect(sealed.file.content).toMatch(/,\s*5\s*\]/);
        expect(sealed.file.content).toMatch(/\n\s+pass\s*\n/);
        expect(sealed.file.content).not.toContain("heapq");
      }
    } finally {
      try {
        unlinkSync(path);
      } catch {
        /* ignore */
      }
    }
  });
});
