import assert from 'node:assert';
import { test, before, after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';

import { RDocument } from '../r-document';
import { RLoader } from './r-loader';

let redis: Redis;
before(() => {
  redis = new Redis({ host: 'localhost', port: 6379, db: 0 });
});

after(async () => {
  await redis.quit();
});

test('ticks when passing commands within commands', async () => {
  // Make sure we're properly handling commands enqueued while processing
  // closures of other commands. The test only needs to run to completion.
  class CommandWithCommandDocument implements RDocument {
    constructor(readonly documentKey: string) {}

    prepareLoad(loader: RLoader): void {
      loader.enqueueCommand<number>('GET', `${this.documentKey}:increment_on_load`, (result) => {
        loader.enqueueCommand('GET', `${this.documentKey}:${result}`, (_) => {
          // noop
        });
      });
    }
    prepareSave(loader: RLoader): void {
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

  const loader = new RLoader(redis);
  const documentKey = randomUUID();
  const doc = new CommandWithCommandDocument(documentKey);
  await loader.save(doc);

  const doc2 = new CommandWithCommandDocument(documentKey);
  await loader.load(doc2);
});

test('Resolves documents only after all commands have returned', async () => {
  class CommandWithCommandDocument implements RDocument {
    innerLoadCommandReturned = false;
    outerLoadCommandReturned = false;
    postLoadInvoked = false;
    prepareLoadInvoked = false;

    isChild = false;
    children: CommandWithCommandDocument[] = [];

    constructor(readonly documentKey: string) {}

    prepareLoad(loader: RLoader): void {
      assert.equal(this.prepareLoadInvoked, false);
      assert.equal(this.innerLoadCommandReturned, false);
      assert.equal(this.outerLoadCommandReturned, false);

      if (!this.isChild) {
        const child = new CommandWithCommandDocument(`${this.documentKey}:child`);
        child.isChild = true;
        this.children.push(child);
        loader.enqueueOperation({ document: child, operation: 'load' });
        // traversal is immediate and on the same stack
        assert.equal(child.prepareLoadInvoked, true);
      }

      this.prepareLoadInvoked = true;
      loader.enqueueCommand<number>('INCR', `${this.documentKey}:increment_on_load`, () => {
        this.outerLoadCommandReturned = true;
        loader.enqueueCommand('GET', `${this.documentKey}:increment_on_load`, (_) => {
          this.innerLoadCommandReturned = true;
        });
      });
    }
    prepareSave(): void {}
    prepareDelete(): void {}

    postLoad(): Promise<void> {
      this.postLoadInvoked = true;
      assert.equal(this.innerLoadCommandReturned, true);
      assert.equal(this.outerLoadCommandReturned, true);
      this.children.forEach((child) => {
        assert.equal(child.innerLoadCommandReturned, true);
        assert.equal(child.outerLoadCommandReturned, true);
      });
      return Promise.resolve();
    }
    postSave(): Promise<void> {
      return Promise.resolve();
    }
    postDelete(): Promise<void> {
      return Promise.resolve();
    }
  }

  const loader = new RLoader(redis);
  const documentKey = randomUUID();
  const doc = new CommandWithCommandDocument(documentKey);
  const p = loader.load(doc);
  // checks traversal is synchronous
  assert.equal(doc.prepareLoadInvoked, true);
  assert.equal(doc.innerLoadCommandReturned, false);
  assert.equal(doc.outerLoadCommandReturned, false);
  assert.equal(doc.postLoadInvoked, false);
  await p;
  assert.equal(doc.innerLoadCommandReturned, true);
  assert.equal(doc.outerLoadCommandReturned, true);
  assert.equal(doc.postLoadInvoked, true);
});
