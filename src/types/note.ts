import { z } from "zod";

export const noteColorSchema = z.enum([
  "yellow",
  "blue",
  "green",
  "pink",
  "purple",
  "gray",
]);

export const noteSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  language: z.string(),
  color: noteColorSchema,
  isPinned: z.boolean(),
  isArchived: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  deletedAt: z.string().datetime({ offset: true }).nullable(),
});

export const noteListItemSchema = noteSchema
  .pick({
    id: true,
    title: true,
    content: true,
    color: true,
    isPinned: true,
    isArchived: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({ deletedAt: noteSchema.shape.deletedAt.optional() });

export const noteRevisionSchema = z.object({
  id: z.string().uuid(),
  noteId: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  language: z.string(),
  createdAt: z.string().datetime({ offset: true }),
});

export type Note = z.infer<typeof noteSchema>;
export type NoteListItem = z.infer<typeof noteListItemSchema>;
export type NoteColor = z.infer<typeof noteColorSchema>;
export type NoteRevision = z.infer<typeof noteRevisionSchema>;

export type CreateNoteInput = {
  title?: string;
  color?: NoteColor;
};

export type UpdateNoteInput = {
  id: string;
  title: string;
  content: string;
  language: string;
  color: NoteColor;
  isPinned: boolean;
};
