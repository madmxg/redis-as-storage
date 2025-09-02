import assert from 'node:assert/strict';

import { type RedisValue } from 'ioredis';

import { CountDownLatch } from '../util/count-down-latch';
import { createDebug } from '../util/create-debug';
import { type RedisPipeline } from '../r-loader';
import { RCommand, type RCommandCallback, type RCommandInput } from './r-command';

type RCommandQueueConfig = {
  atomic: boolean;
};

const debug = createDebug('RCommandQueue');

export class RCommandQueue {
  #commands: Array<RCommand<unknown>>;
  readonly #multi: boolean;

  constructor(config?: RCommandQueueConfig) {
    this.#commands = [];
    this.#multi = Boolean(config?.atomic);
  }

  public get commands(): Array<RCommand<unknown>> {
    return new Array(...this.#commands);
  }

  public writeToPipeline(pipeline: RedisPipeline): Promise<void> {
    if (this.#commands.length === 0) {
      return Promise.resolve();
    }
    if (this.#multi) {
      pipeline.enqueueCommand('MULTI');
    }

    const commands = this.#commands;
    const latch = new CountDownLatch(commands.length + (this.#multi ? 1 : 0));
    this.#commands = [];

    commands.forEach((command: RCommand<unknown>) => {
      const keys = pipeline.getCommandKeys(command.name, command.args ?? []);
      try {
        const runOnPipeline = (): Promise<unknown> =>
          new Promise<unknown>((resolve) => {
            pipeline.enqueueCommand(command.name, command.args ?? [], (result?: unknown) => {
              resolve(result);
            });
          });

        if (!this.#multi) {
          void runOnPipeline()
            .then((result) => {
              command.result = result;
            })
            .finally(() => {
              latch.countDown();
            });
        } else {
          void runOnPipeline();
        }
      } finally {
        debug('Command', {
          commandName: command.name,
          keys,
          pipelineId: pipeline.pipelineId,
        });
      }
    });

    if (this.#multi) {
      pipeline.enqueueCommand('EXEC', [], (result?: unknown): void => {
        latch.countDown();
        if (result === null) {
          // transaction failed.
          debug('MultiDidAbort', { remaining: latch.count });
          // drain the latch flags that are waiting for a result to come back
          while (latch.count > 0) {
            latch.countDown();
          }
          return;
        }
        assert(Array.isArray(result));
        const results = result as RedisValue[];
        results.forEach((result: RedisValue, index: number) => {
          const command = commands[index];
          command.result = result;
          latch.countDown();
        });
        if (latch.count !== 0) {
          // this should never happen, but if it does, we need to know about it
          debug('MultiLatchMismatch', { remaining: latch.count });
        }
      });
    }

    const done = Promise.withResolvers<void>();
    pipeline.waitAfterExec(done.promise);

    return latch.await().finally(() => {
      commands.forEach((command) => {
        command.resolve();
      });
      done.resolve();
    });
  }

  public get length(): number {
    return this.#commands.length;
  }

  public enqueueCommand<T>(
    commandName: string,
    args: RCommandInput[],
    callback?: RCommandCallback<T>,
    { once = false } = {},
  ): boolean {
    const command = RCommand.parse<T>(commandName, ...args);
    if (callback) {
      command.addResultCallback(callback);
    }
    return this.enqueueParsedCommand(command, { once });
  }

  public enqueueParsedCommand<T>(command: RCommand<T>, { once = false } = {}): boolean {
    if (once) {
      const existing = this.#commands.find((c) => c.equals(command));
      if (existing) {
        debug('IgnoringDuplicatedCommand', { command: String(command) });
        return false;
      }
    }

    this.#commands.push(command as RCommand<unknown>);
    return true;
  }
}
