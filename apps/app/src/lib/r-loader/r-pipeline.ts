import assert from 'node:assert/strict';

import { type Redis, type ChainableCommander } from 'ioredis';
import { createDebug } from '../util/create-debug';

export type RedisCommanderInput = string | Buffer | number;
export type RCommandCallback<T> = (result: T | null) => void;

const debug = createDebug('RPipeline');

export class RPipeline {
  private static instanceCount = 0;

  #pipeline: ChainableCommander;
  private redis: Redis | null;
  private postWaits: Array<Promise<unknown>> = [];
  public readonly pipelineId: number;

  constructor(redis: Redis) {
    this.redis = redis;
    this.#pipeline = redis.pipeline();
    this.pipelineId = RPipeline.instanceCount++;
  }

  public waitAfterExec(promise: Promise<unknown>): void {
    this.postWaits.push(promise);
  }

  public async exec(): Promise<void> {
    if (this.#pipeline.length <= 0) {
      return;
    }

    try {
      assert(this.redis, 'PipelineAlreadyExecuted');
      await this.#pipeline.exec();
      await Promise.all(this.postWaits);
    } catch (error) {
      debug('FinalizePipelineError %s', error);
    } finally {
      this.redis = null;
    }
  }

  public enqueueCommand(
    command: string,
    args: RedisCommanderInput[] = [],
    callback?: RCommandCallback<unknown>,
  ): void {
    const wrapper = (error?: Error | null, result?: unknown): void => {
      if (error) {
        debug('PipelineCommandError command{%s}, args{%s}, error %s', command, args, error);
      }
      if (callback) {
        callback(result);
      }
    };

    const command_ = command.toLowerCase();
    if (this.redis && Object.hasOwn(this.redis.scriptsSet, command_)) {
      const pipeline: any = this.#pipeline;
      pipeline[command_](...args, wrapper);
    } else {
      this.#pipeline.call(command_, ...args, wrapper);
    }
  }

  public get length(): number {
    return this.#pipeline.length;
  }
}
