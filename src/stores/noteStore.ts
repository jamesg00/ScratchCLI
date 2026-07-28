import { create } from "zustand";
import { normalizeError, type AppError } from "../types/error";
import type { Note, NoteListItem, UpdateNoteInput } from "../types/note";
import { noteService } from "../services/notes";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type NoteState = {
  notes: NoteListItem[];
  activeNote: Note | null;
  loading: boolean;
  saveStatus: SaveStatus;
  error: AppError | null;
  loadNotes: () => Promise<void>;
  createNote: () => Promise<void>;
  selectNote: (id: string) => Promise<void>;
  patchActive: (patch: Partial<UpdateNoteInput>) => void;
  saveActive: () => Promise<void>;
  archiveActive: () => Promise<void>;
  clearError: () => void;
};

export type NoteDependencies = Pick<
  typeof noteService,
  "list" | "create" | "get" | "update" | "archive"
>;

function toListItem(note: Note): NoteListItem {
  const {
    id,
    title,
    content,
    color,
    isPinned,
    isArchived,
    createdAt,
    updatedAt,
  } = note;
  return {
    id,
    title,
    content,
    color,
    isPinned,
    isArchived,
    createdAt,
    updatedAt,
  };
}

function hasSameEditableFields(left: Note, right: Note) {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.content === right.content &&
    left.language === right.language &&
    left.color === right.color &&
    left.isPinned === right.isPinned
  );
}

export const createNoteStore = (service: NoteDependencies = noteService) =>
  create<NoteState>((set, get) => ({
    notes: [],
    activeNote: null,
    loading: false,
    saveStatus: "idle",
    error: null,

    loadNotes: async () => {
      set({ loading: true, error: null });
      try {
        const notes = await service.list(false);
        set({ notes, loading: false });
      } catch (error) {
        set({ loading: false, error: normalizeError(error) });
      }
    },

    createNote: async () => {
      if (get().saveStatus === "saving") return;
      if (get().saveStatus === "dirty") {
        await get().saveActive();
        if (get().saveStatus === "error") return;
      }
      set({ error: null });
      try {
        const note = await service.create({});
        set((state) => ({
          notes: [toListItem(note), ...state.notes],
          activeNote: note,
          saveStatus: "idle",
        }));
      } catch (error) {
        set({ error: normalizeError(error) });
      }
    },

    selectNote: async (id) => {
      if (get().activeNote?.id === id) return;
      if (get().saveStatus === "saving") return;
      if (get().saveStatus === "dirty") {
        await get().saveActive();
        if (get().saveStatus === "error") return;
      }
      set({ loading: true, error: null });
      try {
        const activeNote = await service.get(id);
        set({ activeNote, loading: false, saveStatus: "idle" });
      } catch (error) {
        set({ loading: false, error: normalizeError(error) });
      }
    },

    patchActive: (patch) => {
      set((state) => ({
        activeNote: state.activeNote
          ? { ...state.activeNote, ...patch }
          : state.activeNote,
        saveStatus: state.activeNote ? "dirty" : state.saveStatus,
      }));
    },

    saveActive: async () => {
      const note = get().activeNote;
      if (!note || get().saveStatus !== "dirty") return;

      set({ saveStatus: "saving", error: null });
      try {
        const saved = await service.update({
          id: note.id,
          title: note.title,
          content: note.content,
          language: note.language,
          color: note.color,
          isPinned: note.isPinned,
        });
        set((state) => {
          const sameActiveNote = state.activeNote?.id === saved.id;
          const changedDuringSave =
            sameActiveNote &&
            state.activeNote !== null &&
            !hasSameEditableFields(state.activeNote, note);

          return {
            activeNote:
              sameActiveNote && !changedDuringSave ? saved : state.activeNote,
            notes: state.notes.map((item) =>
              item.id === saved.id ? toListItem(saved) : item,
            ),
            saveStatus: sameActiveNote
              ? changedDuringSave
                ? "dirty"
                : "saved"
              : state.saveStatus,
          };
        });
      } catch (error) {
        set({ saveStatus: "error", error: normalizeError(error) });
      }
    },

    archiveActive: async () => {
      if (get().saveStatus === "saving") return;
      if (get().saveStatus === "dirty") {
        await get().saveActive();
        if (get().saveStatus === "error") return;
      }
      const note = get().activeNote;
      if (!note) return;
      try {
        await service.archive(note.id, true);
        set((state) => ({
          notes: state.notes.filter((item) => item.id !== note.id),
          activeNote: null,
          saveStatus: "idle",
        }));
        const next = get().notes[0];
        if (next) {
          await get().selectNote(next.id);
        } else {
          await get().createNote();
        }
      } catch (error) {
        set({ error: normalizeError(error) });
      }
    },

    clearError: () => set({ error: null }),
  }));

export const useNoteStore = createNoteStore();
