import { randomUUID } from 'node:crypto';
import { type Request, type Response, Router } from 'express';

import { getStoreValue } from '../lib/request-store';
import { Film, type FilmDocument } from '../models/film';

type FilmId = {
  filmId: string;
};

export async function createFilm(
  req: Request<never, FilmDocument, Omit<Required<FilmDocument>, 'id'>>,
  res: Response<FilmDocument>,
): Promise<void> {
  const { title, director } = req.body;

  const loader = getStoreValue('loader');
  const id = randomUUID();
  const film = new Film(id);
  film.title = title;
  film.director = director;

  await loader.save(film);

  res.status(201).json(film.getDocument());
}

export async function readFilm(
  req: Request<FilmId, FilmDocument, null>,
  res: Response<FilmDocument | {}>,
): Promise<void> {
  const { filmId } = req.params;

  const loader = getStoreValue('loader');
  const film = new Film(filmId);
  await loader.load(film);

  if (!film.exists) {
    res.status(404).json({});
    return;
  }

  res.status(200).json(film.getDocument());
}

export async function deleteFilm(
  req: Request<FilmId, void, null>,
  res: Response<void | {}>,
): Promise<void> {
  const { filmId } = req.params;

  const loader = getStoreValue('loader');
  const film = new Film(filmId);
  await loader.delete(film);

  if (!film.deleted) {
    res.status(404).json({});
    return;
  }

  res.status(204).send();
}

export function filmsRoute(): Router {
  const router = Router();

  router.post('/films', createFilm);
  router.get<FilmId>('/films/:filmId', readFilm);
  router.delete<FilmId>('/films/:filmId', deleteFilm);

  return router;
}
