import { describe, expect, it } from "vitest";
import {
  applyLineNumberHints,
  codeSkeleton,
  extractGuideAnnotation,
  isExplicitSolutionRequest,
  isGuideOnlyAnnotation,
  mergeHintCommentsIntoBuffer,
  resolveGuideFromReply,
  stripFullFileFencesFromReply,
  wrapFreeformCoachPrompt,
} from "./hintGuide";

const stub = `def two_sum(nums, target):
    pass
`;

describe("isGuideOnlyAnnotation", () => {
  it("accepts comment-only additions", () => {
    const annotated = `def two_sum(nums, target):
    # HINT: try a hash map of value -> index
    pass
`;
    expect(isGuideOnlyAnnotation(stub, annotated)).toBe(true);
  });

  it("rejects when pass is replaced with a solution", () => {
    const solved = `def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []
`;
    expect(isGuideOnlyAnnotation(stub, solved)).toBe(false);
  });
});

describe("extractGuideAnnotation", () => {
  it("pulls a guide fence and counts hints", () => {
    const reply = [
      "Try hashing.",
      "```python",
      "def two_sum(nums, target):",
      "    # HINT: map complements",
      "    pass",
      "```",
    ].join("\n");
    const result = extractGuideAnnotation(reply, stub);
    expect(result?.hintCount).toBe(1);
    expect(result?.annotated).toContain("# HINT:");
    expect(codeSkeleton(result!.annotated)).toBe(codeSkeleton(stub));
  });

  it("returns null for a full rewrite fence", () => {
    const reply = [
      "```python",
      "def two_sum(nums, target):",
      "    return [0, 1]",
      "```",
    ].join("\n");
    expect(extractGuideAnnotation(reply, stub)).toBeNull();
  });
});

describe("applyLineNumberHints", () => {
  it("injects HINT comments above referenced lines", () => {
    const code = ["a = 1", "b = 2", "c = 3"].join("\n");
    const reply = "L2: check this assignment\nline 3: off-by-one risk";
    const result = applyLineNumberHints(code, reply);
    expect(result?.hintCount).toBe(2);
    expect(result?.annotated).toContain("# HINT: check this assignment");
    expect(result?.annotated.split("\n")[2]).toBe("b = 2");
  });
});

describe("mergeHintCommentsIntoBuffer", () => {
  it("injects fence hints into the existing buffer without replacing it", () => {
    const annotated = `def two_sum(nums, target):
    # HINT: map complements
    pass
`;
    const result = mergeHintCommentsIntoBuffer(stub, annotated);
    expect(result?.hintCount).toBe(1);
    expect(result?.annotated).toContain("# HINT: map complements");
    expect(result?.annotated).toContain("def two_sum");
    expect(codeSkeleton(result!.annotated)).toBe(codeSkeleton(stub));
  });
});

describe("resolveGuideFromReply", () => {
  it("prefers L#: line hints over a full fence", () => {
    const reply = [
      "Try a hash map.",
      "L2: track seen values",
      "```python",
      "def two_sum(nums, target):",
      "    # HINT: ignored when L# present",
      "    pass",
      "```",
    ].join("\n");
    const result = resolveGuideFromReply(reply, stub);
    expect(result?.hintCount).toBe(1);
    expect(result?.annotated).toContain("# HINT: track seen values");
  });

  it("merges fence hints when no L#: lines", () => {
    const reply =
      "```python\ndef two_sum(nums, target):\n    # HINT: hash\n    pass\n```";
    expect(resolveGuideFromReply(reply, stub)?.hintCount).toBe(1);
  });
});

describe("stripFullFileFencesFromReply", () => {
  it("drops full-file guide fences from chat text", () => {
    const reply = [
      "Use a hash map for complements.",
      "```python",
      "def two_sum(nums, target):",
      "    # HINT: hash",
      "    pass",
      "```",
      "L2: track seen values",
    ].join("\n");
    const stripped = stripFullFileFencesFromReply(reply, stub);
    expect(stripped).toContain("Use a hash map");
    expect(stripped).toContain("L2:");
    expect(stripped).not.toContain("```python");
  });
});

describe("wrapFreeformCoachPrompt", () => {
  it("blocks full code for normal questions and stays chat-only", () => {
    const wrapped = wrapFreeformCoachPrompt("why is my two sum failing?");
    expect(wrapped.allowFullCode).toBe(false);
    expect(wrapped.guideBuffer).toBe(false);
    expect(wrapped.prompt).toMatch(/2–8 lines|2-8 lines|small part/i);
    expect(wrapped.prompt).toMatch(/whole file/i);
  });

  it("allows full code only when explicitly requested", () => {
    expect(isExplicitSolutionRequest("solution")).toBe(true);
    expect(isExplicitSolutionRequest("give me the full code")).toBe(true);
    expect(isExplicitSolutionRequest("what data structure should I use?")).toBe(
      false,
    );
    const wrapped = wrapFreeformCoachPrompt("write the full solution for me");
    expect(wrapped.allowFullCode).toBe(true);
    expect(wrapped.guideBuffer).toBe(false);
  });
});
