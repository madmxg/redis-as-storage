import { randomUUID } from 'node:crypto';
import { type Request, type Response, Router } from 'express';

import { getStoreValue } from '../lib/request-store';
import { Note, type NoteDocument } from '../models/note';

type NoteId = {
  noteId: string;
};

export async function createNote(
  req: Request<never, NoteDocument, Omit<NoteDocument, 'id'>>,
  res: Response<NoteDocument>,
): Promise<void> {
  const { text } = req.body;

  const loader = getStoreValue('loader');
  const id = randomUUID();
  const note = new Note(id);
  note.text = text;

  await loader.save(note);

  res.status(200).json(note.getDocument());
}

export async function readNote(
  req: Request<NoteId, NoteDocument, null>,
  res: Response<NoteDocument | {}>,
): Promise<void> {
  const { noteId } = req.params;

  const loader = getStoreValue('loader');
  const note = new Note(noteId);
  await loader.load(note);

  if (!note.exist) {
    res.status(404).json({});
    return;
  }

  res.status(200).json(note.getDocument());
}

export async function deleteNote(
  req: Request<NoteId, void, null>,
  res: Response<void | {}>,
): Promise<void> {
  const { noteId } = req.params;

  const loader = getStoreValue('loader');
  const note = new Note(noteId);
  await loader.delete(note);

  if (!note.deleted) {
    res.status(404).json({});
    return;
  }

  res.status(204).send();
}

export function notesRoute(): Router {
  const router = Router();

  router.post('/notes', createNote);
  router.get<NoteId>('/notes/:noteId', readNote);
  router.delete<NoteId>('/notes/:noteId', deleteNote);

  return router;
}
