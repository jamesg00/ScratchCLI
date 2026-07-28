import { describe, expect, it } from "vitest";
import type { WorkspaceConfig } from "./workspaceConfig";

describe("WorkspaceConfig", () => {
  it("keeps secrets out of the public workspace contract", () => {
    const config: WorkspaceConfig = {
      preferredShell: "powershell",
      environment: ["OPENAI_API_KEY"],
      snippets: ["./snippets"],
      ignoredPaths: [".git", "node_modules"],
    };
    expect(config.environment).toEqual(["OPENAI_API_KEY"]);
    expect(config).not.toHaveProperty("secrets");
    expect(config).not.toHaveProperty("apiKey");
  });
});
