import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "./useAutosave";

describe("useAutosave", () => {
  afterEach(() => vi.useRealTimers());

  it("debounces dirty changes", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ status }) => useAutosave(status, save, 500),
      { initialProps: { status: "idle" } },
    );

    rerender({ status: "dirty" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
