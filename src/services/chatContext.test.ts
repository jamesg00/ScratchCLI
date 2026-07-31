import { describe, expect, it } from "vitest";
import {
  buildChatContextPayload,
  createChatContextCache,
  hashChatBuffer,
  resolveClearedFileContext,
} from "./chatContext";

describe("buildChatContextPayload", () => {
  it("sends fresh code context on every local request", () => {
    const cache = createChatContextCache();
    const options = {
      cache,
      provider: "ollama" as const,
      model: "qwen",
      language: "python",
      buffer: "def contains(values, target):\n    return target in values\n",
      isLocal: true,
      fileKey: "demo.py",
      localMode: "balanced" as const,
      question: "Walk me through this.",
    };

    const first = buildChatContextPayload(options);
    const second = buildChatContextPayload(options);

    expect(first.contextOverride).toContain("return target in values");
    expect(second.contextOverride).toContain("return target in values");
    expect(second.contextOverride).not.toContain("Reuse the previously shared");
  });
});

describe("resolveClearedFileContext", () => {
  it("keeps file context paused until the buffer changes", () => {
    const buffer = "def f():\n    return 1\n";
    const pausedHash = hashChatBuffer(buffer);
    expect(
      resolveClearedFileContext({
        paused: true,
        pausedHash,
        buffer,
      }),
    ).toEqual({ includeFile: false, resume: false });
    expect(
      resolveClearedFileContext({
        paused: true,
        pausedHash,
        buffer: "def f():\n    return 2\n",
      }),
    ).toEqual({ includeFile: true, resume: true });
  });
});
