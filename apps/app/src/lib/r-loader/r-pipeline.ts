import assert from 'node:assert/strict';

import * as commandParser from '@ioredis/commands';
import { type Redis, ChainableCommander } from 'ioredis';
import { createDebug } from '../util/create-debug';

export type RedisCommanderInput = string | Buffer | number;
export type RCommandCallback<T> = (result: T | null) => void;

const debug = createDebug('RPipeline');

export class RPipeline {
  private static instanceCount = 0;

  #pipeline: ChainableCommander;
  private redis: Redis | null;
  public readonly pipelineId: number;
  private postWaits: Array<Promise<unknown>> = [];

  constructor(redis: Redis) {
    this.redis = redis;
    this.#pipeline = redis.pipeline();
    this.pipelineId = RPipeline.instanceCount++;
  }

  #getCustomCommand(name: string): { numberOfKeys: number; readOnly: boolean } | undefined {
    if (this.redis && name in this.redis.scriptsSet) {
      return this.redis.scriptsSet[name as keyof typeof this.redis.scriptsSet];
    }
  }

  public getCommandKeys(name: string, args: Array<RedisCommanderInput>): string[] {
    const name_ = name.toLowerCase();
    const customCommand = this.#getCustomCommand(name_);
    if (customCommand) {
      return args.slice(0, customCommand.numberOfKeys).map(String);
    }
    if (!commandParser.exists(name_)) {
      return args.filter((arg) => typeof arg === 'string');
    }

    const indices = commandParser.getKeyIndexes(name_, args);
    return indices.map((i) => String(args[i]));
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
