import http from 'node:http';
import express from 'express';

import { rootLogger } from './log';
import { redis } from './redis';
import { getStoreValue } from './request-store';
import { initializeStoreMiddleware } from '../middlewares/initialize-store';
import { populateStoreMiddleware } from '../middlewares/populate-store';
import { type RDocument, type RDocumentLoader } from './loader';

const log = rootLogger.child({ component: 'WebServer' });

class MyDocument implements RDocument<object> {
  constructor(readonly documentKey: string) {}
  getDocument(): object {
    return {};
  }
  pushLoaderError(): void {}

  prepareLoad(loader: RDocumentLoader): void {
    loader.enqueueCommand<number>('GET', `${this.documentKey}:increment_on_load`, (result) => {
      loader.enqueueCommand('GET', `${this.documentKey}:${result}`, (_) => {
        // noop
      });
    });
  }
  prepareSave(loader: RDocumentLoader): void {
    loader.enqueueCommand<number>('INCR', `${this.documentKey}:increment_on_load`, (result) => {
      loader.enqueueCommand('SET', `${this.documentKey}:${result}`, 'foo', (_) => {
        // noop
      });
    });
  }
  prepareDelete(): void {}
  postLoad(): Promise<void> {
    return Promise.resolve();
  }
  postSave(): Promise<void> {
    return Promise.resolve();
  }
  postDelete(): Promise<void> {
    return Promise.resolve();
  }
}

export async function createWebServer(): Promise<void> {
  const bindHost = '0.0.0.0';
  const bindPort = 3001;

  const app = express();

  app.use(initializeStoreMiddleware);
  app.use(populateStoreMiddleware);

  app.get('/', async (_req, res) => {
    const requestId = getStoreValue('requestId');
    const loader = getStoreValue('loader');
    loader.enqueueCommand<'OK'>('SET', 'test', 'test', (setResult) => {
      console.log('s', setResult);
    });
    loader.enqueueCommand<string>('GET', 'test', (getResult) => {
      console.log('g', getResult);
    });
    res.status(200).send(`Hello World! ${requestId}`);
  });

  app.get('/document', async (_req, res) => {
    const requestId = getStoreValue('requestId');
    const loader = getStoreValue('loader');
    const doc = new MyDocument(requestId);
    await loader.save(doc);
    await loader.load(doc);
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
