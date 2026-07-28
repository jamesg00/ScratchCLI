import { describe, expect, it } from "vitest";
import { CLI_BRAND_ASCII, createBrandOutputLine } from "./cliBrand";

describe("cliBrand", () => {
  it("uses aligned pure-ASCII lines", () => {
    const lines = CLI_BRAND_ASCII.split("\n");
    expect(lines.length).toBe(5);
    expect(CLI_BRAND_ASCII).toContain("____");
    expect(CLI_BRAND_ASCII).not.toMatch(/[█╔╗╚╝═║]/);
  });

  it("creates brand output line", () => {
    expect(createBrandOutputLine(1)).toEqual({
      id: 1,
      kind: "brand",
      text: "ScratchCLI",
    });
  });
});
