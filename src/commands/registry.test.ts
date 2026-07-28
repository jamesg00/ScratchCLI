import { describe, expect, it } from "vitest";
import { COMMAND_REGISTRY, commandDefinition } from "./registry";

describe("command registry", () => {
  it("uses unique IDs and aliases", () => {
    const ids = COMMAND_REGISTRY.map((command) => command.id);
    const aliases = COMMAND_REGISTRY.flatMap((command) => command.aliases);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it("provides discoverability and safety metadata", () => {
    for (const command of COMMAND_REGISTRY) {
      expect(command.label).not.toBe("");
      expect(command.description).not.toBe("");
      expect(command.safety).toMatch(/^(safe|confirm|destructive)$/);
      expect(commandDefinition(command.id)).toBe(command);
    }
  });
});
