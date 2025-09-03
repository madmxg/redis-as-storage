import { randomUUID } from 'node:crypto';
import { type Request, type Response, Router } from 'express';

import { getStoreValue } from '../lib/request-store';
import { Planet, type PlanetDocument } from '../models/planet';

type PlanetId = {
  planetId: string;
};

export async function createPlanet(
  req: Request<never, PlanetDocument, Omit<Required<PlanetDocument>, 'id'>>,
  res: Response<PlanetDocument>,
): Promise<void> {
  const { name, gravity, diameter } = req.body;

  const loader = getStoreValue('loader');
  const id = randomUUID();
  const planet = new Planet(id);
  planet.name = name;
  planet.gravity = gravity;
  planet.diameter = diameter;

  await loader.save(planet);

  res.status(201).json(planet.getDocument());
}

export async function readPlanet(
  req: Request<PlanetId, PlanetDocument, null>,
  res: Response<PlanetDocument | {}>,
): Promise<void> {
  const { planetId } = req.params;

  const loader = getStoreValue('loader');
  const planet = new Planet(planetId);
  await loader.load(planet);

  if (!planet.exists) {
    res.status(404).json({});
    return;
  }

  res.status(200).json(planet.getDocument());
}

export async function deletePlanet(
  req: Request<PlanetId, void, null>,
  res: Response<void | {}>,
): Promise<void> {
  const { planetId } = req.params;

  const loader = getStoreValue('loader');
  const planet = new Planet(planetId);
  await loader.load(planet);

  if (!planet.exists) {
    res.status(404).json({});
    return;
  }

  await loader.delete(planet);

  res.status(204).send();
}

export function planetsRoute(): Router {
  const router = Router();

  router.post('/planets', createPlanet);
  router.get<PlanetId>('/planets/:planetId', readPlanet);
  router.delete<PlanetId>('/planets/:planetId', deletePlanet);

  return router;
}
