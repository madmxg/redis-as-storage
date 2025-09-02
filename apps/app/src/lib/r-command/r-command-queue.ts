import { CountDownLatch } from '../util/count-down-latch';
import { createDebug } from '../util/create-debug';
import { type RedisPipeline } from '../r-loader';
import { RCommand, type RCommandCallback, type RCommandInput } from './r-command';

const debug = createDebug('RCommandQueue');

export class RCommandQueue {
  #commands: Array<RCommand<unknown>>;

  constructor() {
    this.#commands = [];
  }

  public get commands(): Array<RCommand<unknown>> {
    return new Array(...this.#commands);
  }

  public writeToPipeline(pipeline: RedisPipeline): Promise<void> {
    if (this.#commands.length === 0) {
      return Promise.resolve();
    }

    const commands = this.#commands;
    const latch = new CountDownLatch(commands.length);
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

        void runOnPipeline()
          .then((result) => {
            command.result = result;
          })
          .finally(() => {
            latch.countDown();
          });
      } finally {
        debug('Command', {
          commandName: command.name,
          keys,
          pipelineId: pipeline.pipelineId,
        });
      }
    });

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
