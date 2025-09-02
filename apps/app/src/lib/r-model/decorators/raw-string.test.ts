import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, before, after } from 'node:test';

import Redis from 'ioredis';

import { RLoader } from '../../r-loader';
import { RawString } from './raw-string';
import { RModel } from '../r-model';

let redis: Redis;
before(() => {
  redis = new Redis({ host: 'localhost', port: 6379, db: 0 });
});

after(async () => {
  await redis.quit();
});

function getDocumentKey(model: RawStringModel): string {
  return `raw-string:${model.id}`;
}

function getNameKey(model: RawStringModel, name: string): string {
  return `${getDocumentKey(model)}:${name}`;
}

class RawStringModel extends RModel {
  @RawString({ key: (model) => getNameKey(model, 'name') })
  public accessor name!: string;

  @RawString({ key: (model) => getNameKey(model, 'text') })
  public accessor text!: string;

  constructor(public readonly id: string) {
    super();
  }
}

test('stores strings on a model', async () => {
  const id = randomUUID();

  const loader = new RLoader(redis);
  const model = new RawStringModel(id);
  model.name = 'charley';
  model.text = 'hello';
  assert.equal(model.name, 'charley');
  await loader.save(model);

  const model2 = new RawStringModel(id);
  await loader.load(model2);
  assert.equal(model2.name, model.name);

  test.after(() => loader.delete(model));
});
