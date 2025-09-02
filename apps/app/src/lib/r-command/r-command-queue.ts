import { createDebug } from '../util/create-debug';
import { CountDownLatch } from '../util/count-down-latch';
import { type RPipeline } from '../r-loader';
import { type RCommand } from './r-command';

const debug = createDebug('RCommandQueue');

export class RCommandQueue {
  #commands: Array<RCommand<unknown>> = [];

  public writeToPipeline(pipeline: RPipeline): Promise<void> {
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
        debug('Command name{%s} keys{%s} with [%d]', command.name, keys, pipeline.pipelineId);
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

  public enqueueParsedCommand<T>(command: RCommand<T>): void {
    this.#commands.push(command as RCommand<unknown>);
  }
}
