import { beforeEach, describe, expect, it } from "vitest";
import { useInterviewStore } from "./interviewStore";

describe("interviewStore", () => {
  beforeEach(() => {
    useInterviewStore.getState().stop();
  });

  it("locks hints while active before end", () => {
    useInterviewStore.getState().start("medium", 25);
    expect(useInterviewStore.getState().isHintLocked()).toBe(true);
  });

  it("unlocks after reveal", () => {
    useInterviewStore.getState().start("easy", 25);
    useInterviewStore.getState().unlockReveal();
    expect(useInterviewStore.getState().isHintLocked()).toBe(false);
  });

  it("unlocks after stop", () => {
    useInterviewStore.getState().start("hard", 25);
    useInterviewStore.getState().stop();
    expect(useInterviewStore.getState().isHintLocked()).toBe(false);
  });
});
