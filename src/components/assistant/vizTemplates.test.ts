import { describe, expect, it } from "vitest";
import {
  detectVizKind,
  getLocalVizTemplate,
  listVizTemplates,
} from "./vizTemplates";
import { buildLocalVizPlan } from "./vizSimulate";
import { VIZ_CATEGORIES } from "./vizCatalog";

describe("detectVizKind", () => {
  it("detects binary search", () => {
    expect(
      detectVizKind("lo, hi = 0, n-1\nmid = (lo+hi)//2\nbinary search"),
    ).toBe("binary_search");
  });

  it("detects two pointers", () => {
    expect(detectVizKind("left, right = 0, n-1\nwhile left < right:")).toBe(
      "two_pointers",
    );
  });

  it("detects linked list", () => {
    expect(
      detectVizKind(
        "class ListNode:\n    def __init__(self, val=0, next=None):",
      ),
    ).toBe("linked_list");
  });
});

describe("getLocalVizTemplate", () => {
  it("returns a playable plan for each listed template", () => {
    for (const item of listVizTemplates()) {
      const plan = getLocalVizTemplate(item.kind);
      expect(plan.code.length).toBeGreaterThan(0);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.kind).toBe(item.kind);
    }
  });
});

describe("categories", () => {
  it("covers every non-other template kind", () => {
    const covered = new Set(VIZ_CATEGORIES.flatMap((c) => c.kinds));
    for (const item of listVizTemplates()) {
      expect(covered.has(item.kind)).toBe(true);
    }
  });
});

describe("buildLocalVizPlan fallback", () => {
  it("returns template when buffer has no extractable inputs", () => {
    const result = buildLocalVizPlan("");
    expect(result.source).toBe("template");
  });
});
