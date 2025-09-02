import { type Redis } from 'ioredis';

import { createDebug } from '../util/create-debug';
import { ExclusiveRunner } from '../util/exclusive-runner';

import { RCommand, RCommandQueue, type RCommandCallback, type RCommandInput } from '../r-command';
import {
  RDocumentOperation,
  RDocumentTraverse,
  type RDocument,
  type RDocumentOperationSpec,
  type RDocumentOperationName,
} from '../r-document';
import { RPipeline } from './r-pipeline';

const debug = createDebug('RLoader');

export class RLoader {
  private readonly redis: Redis;
  private readonly traverse: RDocumentTraverse;
  private readonly commandQueue: RCommandQueue;
  private readonly tickRunner: ExclusiveRunner;
  private readonly activeOperationStack: Array<RDocumentOperation> = [];

  constructor(redis: Redis) {
    this.redis = redis;
    this.traverse = new RDocumentTraverse(this);
    this.commandQueue = new RCommandQueue();
    const pThis = new WeakRef(this);
    this.traverse.on('traverse', () => pThis.deref()?.tickRunner.run());
    this.tickRunner = new ExclusiveRunner(() => pThis.deref()?.tick());
  }

  private async multi(
    documents: RDocument | Array<RDocument>,
    operation: RDocumentOperationName,
  ): Promise<void> {
    const errors: Error[] = [];
    await Promise.all(
      [documents].flat().map(
        (document) =>
          new Promise<void>((resolve) => {
            this.enqueueOperation({
              document,
              operation,
              onOperationComplete: (errs?: Error[]) => {
                if (errs) {
                  errors.push(...errs);
                }
                resolve();
              },
            });
          }),
      ),
    );

    if (errors.length > 0) {
      debug('RLoaderError %s', errors);
      throw new Error('RLoaderError', { cause: errors });
    }
  }

  public load(documents: RDocument | Array<RDocument>): Promise<void> {
    return this.multi(documents, 'load');
  }

  public save(documents: RDocument | Array<RDocument>): Promise<void> {
    return this.multi(documents, 'save');
  }

  public delete(documents: RDocument | Array<RDocument>): Promise<void> {
    return this.multi(documents, 'delete');
  }

  public pushActiveOperation(operation: RDocumentOperation): void {
    this.activeOperationStack.push(operation);
  }

  public popActiveOperation(): void {
    this.activeOperationStack.pop();
  }

  private get activeOperation(): RDocumentOperation | undefined {
    if (this.activeOperationStack.length === 0) {
      return undefined;
    }
    return this.activeOperationStack[this.activeOperationStack.length - 1];
  }

  private async tick(): Promise<void> {
    debug('Tick');
    try {
      do {
        await this.flushCommandQueue();
        await this.traverse.postProcessDocuments();
        if (this.traverse.hasPendingOperations) {
          process.nextTick(() => this.traverse.tick());
          return;
        }
      } while (this.commandQueue.length > 0);
    } catch (error) {
      debug('TickFailed %s', error);
    }
  }

  private async flushCommandQueue(): Promise<void> {
    if (this.commandQueue.length === 0) {
      return;
    }
    const pipeline = new RPipeline(this.redis);
    const pipelinePromise = this.commandQueue.writeToPipeline(pipeline);
    void pipeline.exec();
    await pipelinePromise;
  }

  public enqueueOperation(spec: RDocumentOperationSpec): void {
    const operation = new RDocumentOperation({
      parent: this.activeOperation,
      ...spec,
    });
    debug(
      'EnqueueOperation name{%s} parent{%s}',
      operation.operationName,
      this.activeOperation?.operationName ?? '-',
    );
    this.traverse.enqueueOperation(operation);
  }

  captureCommandCallbackContext<T>(command: RCommand<T>): void {
    const { activeOperation } = this;
    if (!activeOperation) {
      return;
    }
    const pThis = new WeakRef(this);
    const pActiveOperation = new WeakRef(activeOperation);
    const pendingCommand = activeOperation.addPendingCommand();
    command.addBeforeCallbacksListener(() => {
      const activeOperation = pActiveOperation.deref();
      if (activeOperation) {
        pThis.deref()?.pushActiveOperation(activeOperation);
      }
    });
    command.addAfterCallbacksListener(() => {
      pThis.deref()?.popActiveOperation();
    });
    void command.completed
      .catch((error) => {
        pActiveOperation.deref()?.pushError(error);
      })
      .finally(pendingCommand);
  }

  #enqueueCommand<T>(command: RCommand<T>): void {
    this.commandQueue.enqueueParsedCommand(command);
    this.captureCommandCallbackContext(command);
  }

  enqueueCommand<T>(
    commandName: string,
    ...cArgs: [...args: RCommandInput[], callback: RCommandCallback<T>] | [...args: RCommandInput[]]
  ): void {
    const command = RCommand.parse(commandName, ...cArgs);
    this.#enqueueCommand(command);
  }
}
