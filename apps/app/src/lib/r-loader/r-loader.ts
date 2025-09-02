import { type Redis } from 'ioredis';

import { ExclusiveRunner } from '../util/exclusive-runner';

import { createDebug } from '../util/create-debug';
import { RDocumentOperationError } from './errors/RDocumentOperationError';
import { RCommand, RCommandQueue, type RCommandCallback, type RCommandInput } from '../r-command';
import {
  RDocumentOperation,
  RDocumentTraverse,
  type RDocument,
  type RTraverseOptions,
  type RDocumentOperationSpec,
  type RDocumentOperationName,
} from '../r-document';
import { RPipeline } from './r-pipeline';

const debug = createDebug('RDocumentOperation');

/**
 * Loads documents from redis using a generational pipeline strategy:
 * Once per generation, a pipeline accumulates commands to send to the redis
 * server, and completes at the end of the round trip. Commands are enqueued
 * to the loader while traversing through the set of known documents
 * (operations) that have been declared to the loader. There is an opportunity
 * for recursion across the known document tree before the pipeline is
 * sent/executed, as well as during post-processing the results returned by
 * the pipeline.
 *
 * Loading is considered complete when there are no further operations to send
 * to the redis server.
 */
export class RLoader {
  private readonly redis: Redis;
  private readonly traverse: RDocumentTraverse;
  private readonly commandQueue: RCommandQueue;
  private readonly activeOperationStack: Array<RDocumentOperation>;
  private readonly tickRunner: ExclusiveRunner;

  private constructor(redis: Redis) {
    this.redis = redis;
    this.traverse = new RDocumentTraverse(this);
    const pThis = new WeakRef(this);
    this.traverse.on('traverse', () => pThis.deref()?.tickRunner.run());
    this.tickRunner = new ExclusiveRunner(() => pThis.deref()?.tick());
    this.commandQueue = new RCommandQueue();
    this.activeOperationStack = [];
  }

  public static createInstance(withRedis: Redis): RLoader {
    return new RLoader(withRedis);
  }

  private async multi(
    documents: RDocument | RDocument[],
    operation: RDocumentOperationName,
    traverseOptions?: RTraverseOptions,
  ): Promise<void> {
    const errors: Error[] = [];
    await Promise.all(
      [documents].flat().map(
        (document) =>
          new Promise<void>((resolve) => {
            this.enqueueOperation({
              document,
              operation,
              traverseOptions,
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
      throw new RDocumentOperationError(errors);
    }
  }

  /**
   * Convenience method for enqueuing multiple loads at once. Take care not to
   * await this Promise until all operations are enqueued.
   *
   * @returns Promise that will resolve after all documents have completed load.
   */
  public load(
    documents: RDocument | RDocument[],
    traverseOptions?: RTraverseOptions,
  ): Promise<void> {
    return this.multi(documents, 'load', traverseOptions);
  }

  /**
   * Convenience method for enqueuing multiple saves at once. Take care not to
   * await this Promise until all operations are enqueued.
   *
   * @returns Promise that will resolve after all documents have completed save.
   */
  public async save(
    documents: RDocument | RDocument[],
    traverseOptions?: RTraverseOptions,
  ): Promise<void> {
    return this.multi(documents, 'save', traverseOptions);
  }

  public async delete(
    documents: RDocument | RDocument[],
    traverseOptions?: RTraverseOptions,
  ): Promise<void> {
    return this.multi(documents, 'delete', traverseOptions);
  }

  /**
   * Sets the operation while it's invoking an RDocument function or command
   * callback. Documents discovered while in these contexts will be
   * attached as children to the active document. It is imperative that a
   * corresponding call to popActiveOperation is sent immediately after leaving
   * the document's context.
   */
  public pushActiveOperation(operation: RDocumentOperation): void {
    this.activeOperationStack.push(operation);
  }

  /**
   * @see pushActiveOperation
   */
  public popActiveOperation(): void {
    this.activeOperationStack.pop();
  }

  private get activeOperation(): RDocumentOperation | undefined {
    if (this.activeOperationStack.length === 0) {
      return undefined;
    }
    return this.activeOperationStack[this.activeOperationStack.length - 1];
  }

  /**
   * Kicks off a pipeline RT whenever the traverse has exhausted document
   * discovery. This is expected to run in the background.
   * Function is triggered by tickRunner -- do not invoke directly.
   */
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
      debug('TickFailed', { error });
    }
  }

  private async flushCommandQueue(): Promise<void> {
    if (this.commandQueue.length === 0) {
      return;
    }
    const pipeline = new RPipeline({ redis: this.redis, disposeRedisAfterExec: true });
    const donePromise = this.commandQueue.writeToPipeline(pipeline);
    void pipeline.exec();
    await donePromise;
    // await SharedRedisPipeline.execShared(this.commandQueue);
  }

  /**
   * Add an operation to the loader. If called from within an RDocument function
   * or command callback, the calling document will link this operation as a
   * child. Only once all children have finished their load phases will the
   * onOperationComplete callback be invoked.
   */
  public enqueueOperation(spec: RDocumentOperationSpec): void {
    const operation = new RDocumentOperation({
      parent: this.activeOperation,
      ...spec,
    });
    debug('EnqueueOperation', {
      operationName: operation.operationName,
      parentClass: operation.parent?.document.constructor.name,
    });
    this.traverse.enqueueOperation(operation);
  }

  /**
   * Restores the current state of the loader before invoking a command
   * callback. If documents are discovered while in a callback closure, the
   * loader automatically links the activeOperation as a parent to the
   * discovered document.
   */
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

  #enqueueCommand<T>(command: RCommand<T>, { once = false } = {}): boolean {
    const { activeOperation } = this;
    if (!activeOperation) {
      const accepted = this.commandQueue.enqueueParsedCommand(command, { once });
      if (!accepted) return false;
      // it's unusual to receive commands outside the context of an operation,
      // but possible.
      // Defer the tick call in case there's a bunch of commands that need to
      // be entered before flushing
      process.nextTick(() => this.tickRunner.run());
      this.captureCommandCallbackContext(command);
      return true;
    }

    const accepted = this.commandQueue.enqueueParsedCommand(command, { once });
    if (accepted) {
      this.captureCommandCallbackContext(command);
    }
    return accepted;
  }

  /**
   * Schedule a Redis command to execute in the next outgoing pipeline batch.
   * Any enqueueOperation calls from within the command callback will be
   * attached to the caller's document/operation.
   *
   * Returns true if the was successfully enqueued, false otherwise.
   */
  enqueueCommand<T>(
    commandName: string,
    ...cArgs: [...args: RCommandInput[], callback: RCommandCallback<T>] | [...args: RCommandInput[]]
  ): boolean {
    const command = RCommand.parse(commandName, ...cArgs);
    return this.#enqueueCommand(command);
  }

  /**
   * Exactly like enqueueCommand, but will check if the command is already in the
   * pending queue, if so this becomes a no-op.
   *
   * Note that there are no guarantees about when the internal command queue
   * will be flushed, hence callers should expect that multiple duplicate commands
   * might be actually sent to Redis even when using this method.
   */
  // TODO: rid
  enqueueCommandOnce<T>(
    commandName: string,
    ...cArgs: [...args: RCommandInput[], callback: RCommandCallback<T>] | [...args: RCommandInput[]]
  ): boolean {
    const command = RCommand.parse(commandName, ...cArgs);
    return this.#enqueueCommand(command, { once: true });
  }
}
