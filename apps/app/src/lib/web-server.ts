import http from 'node:http';
import express from 'express';

import { rootLogger } from './log';
import { redis } from './redis';
import { getStoreValue } from './request-store';
import { initializeStoreMiddleware } from '../middlewares/initialize-store';
import { populateStoreMiddleware } from '../middlewares/populate-store';
import { filmsRoute } from '../routes/films';
import { planetsRoute } from '../routes/planets';

const log = rootLogger.child({ component: 'WebServer' });

export async function createWebServer(): Promise<void> {
  const bindHost = '0.0.0.0';
  const bindPort = 3001;

  const app = express();

  app.use(express.json());
  app.use(initializeStoreMiddleware);
  app.use(populateStoreMiddleware);

  app.use(filmsRoute());
  app.use(planetsRoute());

  app.get('/', async (_req, res) => {
    const requestId = getStoreValue('requestId');
    const loader = getStoreValue('loader');
    loader.enqueueCommand<'OK'>('SET', 'test', 'test', (_setResult) => {
      //
    });
    loader.enqueueCommand<string>('GET', 'test', (_getResult) => {
      //
    });
    await loader['tick']();
    res.status(200).send(`Hello World! ${requestId}`);
  });

  app.get('/set', async (req, res) => {
    if (typeof req.query.key !== 'string') {
      res.status(400).send('Key must be a string');
      return;
    }
    if (typeof req.query.value !== 'string') {
      res.status(400).send('Value must be a string');
      return;
    }

    await redis.set(req.query.key, req.query.value);
    res.status(200).send('OK');
  });
  app.get('/get', async (req, res) => {
    if (typeof req.query.key !== 'string') {
      res.status(400).send('Key must be a string');
      return;
    }

    const value = await redis.get(req.query.key);

    res.status(200).send(value);
  });

  const httpServer = http.createServer(app);

  return new Promise((resolve) => {
    httpServer.listen(bindPort, bindHost, () => {
      log.info(
        {
          bindHost,
          bindPort,
        },
        'WebServerListening',
      );
      resolve();
    });
  });
}
