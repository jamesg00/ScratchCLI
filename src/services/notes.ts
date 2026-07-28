import { invoke } from "@tauri-apps/api/core";
import {
  noteListItemSchema,
  noteRevisionSchema,
  noteSchema,
  type CreateNoteInput,
  type Note,
  type NoteListItem,
  type NoteRevision,
  type UpdateNoteInput,
} from "../types/note";

export const noteService = {
  async create(input: CreateNoteInput = {}): Promise<Note> {
    const value = await invoke("create_note", { input });
    return noteSchema.parse(value);
  },

  async get(id: string): Promise<Note> {
    const value = await invoke("get_note", { id });
    return noteSchema.parse(value);
  },

  async list(includeArchived = false): Promise<NoteListItem[]> {
    const value = await invoke("list_notes", { includeArchived });
    return noteListItemSchema.array().parse(value);
  },

  async search(query: string): Promise<NoteListItem[]> {
    const value = await invoke("search_notes", { query });
    return noteListItemSchema.array().parse(value);
  },

  async listDeleted(): Promise<NoteListItem[]> {
    const value = await invoke("list_deleted_notes");
    return noteListItemSchema.array().parse(value);
  },

  async update(input: UpdateNoteInput): Promise<Note> {
    const value = await invoke("update_note", { input });
    return noteSchema.parse(value);
  },

  async archive(id: string, archived: boolean): Promise<Note> {
    const value = await invoke("archive_note", { id, archived });
    return noteSchema.parse(value);
  },

  async remove(id: string): Promise<void> {
    await invoke("delete_note", { id });
  },

  async restore(id: string): Promise<Note> {
    const value = await invoke("restore_note", { id });
    return noteSchema.parse(value);
  },

  async permanentlyRemove(id: string): Promise<void> {
    await invoke("permanently_delete_note", { id });
  },

  async revisions(noteId: string): Promise<NoteRevision[]> {
    const value = await invoke("list_note_revisions", { noteId });
    return noteRevisionSchema.array().parse(value);
  },
};
