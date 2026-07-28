import { describe, expect, it, vi } from "vitest";
import type { Note } from "../types/note";
import { createNoteStore, type NoteDependencies } from "./noteStore";

const note: Note = {
  id: "94af61f2-98db-45e3-a6fb-7caef82fcb4d",
  title: "First note",
  content: "hello",
  language: "markdown",
  color: "yellow",
  isPinned: false,
  isArchived: false,
  createdAt: "2026-07-24T12:00:00Z",
  updatedAt: "2026-07-24T12:00:00Z",
  deletedAt: null,
};

function mockService(): NoteDependencies {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(note),
    get: vi.fn().mockResolvedValue(note),
    update: vi
      .fn()
      .mockImplementation(async (input) => ({ ...note, ...input })),
    archive: vi.fn().mockImplementation(async (_id, archived) => ({
      ...note,
      isArchived: archived,
    })),
  };
}

describe("note store", () => {
  it("creates and selects a note", async () => {
    const store = createNoteStore(mockService());
    await store.getState().createNote();

    expect(store.getState().activeNote).toEqual(note);
    expect(store.getState().notes).toHaveLength(1);
  });

  it("marks edits dirty and persists them", async () => {
    const service = mockService();
    const store = createNoteStore(service);
    await store.getState().createNote();

    store.getState().patchActive({ content: "updated" });
    expect(store.getState().saveStatus).toBe("dirty");

    await store.getState().saveActive();
    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: note.id, content: "updated" }),
    );
    expect(store.getState().saveStatus).toBe("saved");
  });

  it("keeps unsaved editor content when a save fails", async () => {
    const service = mockService();
    service.update = vi.fn().mockRejectedValue({
      code: "DATABASE_ERROR",
      message: "Could not save.",
      retryable: true,
    });
    const store = createNoteStore(service);
    await store.getState().createNote();
    store.getState().patchActive({ content: "still here" });

    await store.getState().saveActive();

    expect(store.getState().activeNote?.content).toBe("still here");
    expect(store.getState().saveStatus).toBe("error");
  });

  it("does not overwrite a newer edit when a slow save completes", async () => {
    let finishSave: ((value: Note) => void) | undefined;
    const service = mockService();
    service.update = vi.fn().mockImplementation(
      (input) =>
        new Promise<Note>((resolve) => {
          finishSave = resolve;
          expect(input.content).toBe("first edit");
        }),
    );
    const store = createNoteStore(service);
    await store.getState().createNote();
    store.getState().patchActive({ content: "first edit" });

    const save = store.getState().saveActive();
    store.getState().patchActive({ content: "newer edit" });
    finishSave?.({ ...note, content: "first edit" });
    await save;

    expect(store.getState().activeNote?.content).toBe("newer edit");
    expect(store.getState().saveStatus).toBe("dirty");
  });
});
