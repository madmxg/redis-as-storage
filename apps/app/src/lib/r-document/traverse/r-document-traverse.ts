import assert from 'node:assert/strict';

import EventEmitter from 'events';

import { createDebug } from '../../util/create-debug';
import { LinkedQueue } from '../../util/linked-queue';
import { type RDocumentLoader } from '../../rloader';
import { type RDocumentOperation } from '../r-document-operation';

const debug = createDebug('RDocumentTraverse');

export class RDocumentTraverse extends EventEmitter {
  private loader: WeakRef<RDocumentLoader>;
  private unvisitedOperations: LinkedQueue<RDocumentOperation>;
  private visitedOperations: Set<RDocumentOperation>;

  constructor(loader: RDocumentLoader) {
    super();
    this.loader = new WeakRef(loader);
    this.unvisitedOperations = new LinkedQueue<RDocumentOperation>();
    this.visitedOperations = new Set<RDocumentOperation>();
  }

  public tick(): void {
    if (this.unvisitedOperations.size === 0) {
      // intentional noop to prevent reentrance. tick may be called many times
      // in a single generation but should only need to run once.
      return;
    }

    debug('BeginTraverse', { nDocuments: this.unvisitedOperations.size });

    let totalDocumentsVisited = 0;
    const loader = this.loader.deref();
    assert(loader);

    while (this.unvisitedOperations.size > 0) {
      const operation = this.unvisitedOperations.poll();
      assert(operation);
      if (!operation.isVisited) {
        this.prepareOperation(loader, operation);
        totalDocumentsVisited++;
        assert(operation.isVisited);
      } else {
        operation.debugOperation();
      }

      this.visitedOperations.add(operation);
    }

    this.emit('traverse');
  }

  private prepareOperation(loader: RDocumentLoader, operation: RDocumentOperation): void {
    debug('VisitDocument', {
      operationName: operation.operationName,
      documentType: operation.document.constructor.name,
    });
    loader.pushActiveOperation(operation);
    operation.prepare(loader);
    loader.popActiveOperation();
  }

  private async postProcessOperation(
    loader: RDocumentLoader,
    operation: RDocumentOperation,
  ): Promise<void> {
    debug('PostProcessDocument', {
      operationName: operation.operationName,
      documentType: operation.document.constructor.name,
    });
    loader.pushActiveOperation(operation);
    await operation.postProcess(loader);
    loader.popActiveOperation();
  }

  public async postProcessDocuments(): Promise<void> {
    const loader = this.loader.deref();
    assert(loader);

    const operationsReadyForPostProcessing = this.visitedOperations
      .values()
      .filter((operation) => operation.isReadyForPostProcessing)
      .toArray();

    if (operationsReadyForPostProcessing.length > 0) {
      debug('PostProcessDocuments', {
        nDocuments: operationsReadyForPostProcessing.length,
      });

      for (const operation of operationsReadyForPostProcessing) {
        try {
          await this.postProcessOperation(loader, operation);
        } catch (error) {
          debug('PostProcessingHandlerRejection', { error });
        }
      }
    }

    this.notifyCompletedOperations();
  }

  private notifyCompletedOperations(): void {
    const completedOperations = this.visitedOperations
      .values()
      .filter((operation) => operation.treeComplete);

    for (const operation of completedOperations) {
      this.visitedOperations.delete(operation);
      operation.notifyCompletionCallbacks();
    }
  }

  public get hasPendingOperations(): boolean {
    return this.unvisitedOperations.size > 0;
  }

  public enqueueOperation(operations: RDocumentOperation | RDocumentOperation[]): void {
    [operations].flat().forEach((operation) => {
      this.unvisitedOperations.push(operation);
    });
    // synchronously process the save operations
    // allows the parent to add their own commands after children are traversed
    this.tick();
  }
}
