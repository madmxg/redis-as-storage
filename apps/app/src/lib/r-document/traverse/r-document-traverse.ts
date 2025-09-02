import assert from 'node:assert/strict';
import EventEmitter from 'node:events';

import { createDebug } from '../../util/create-debug';
import { LinkedQueue } from '../../util/linked-queue';
import { type RLoader } from '../../r-loader';
import { type RDocumentOperation } from '../r-document-operation';

const debug = createDebug('RDocumentTraverse');

export class RDocumentTraverse extends EventEmitter {
  private loader: WeakRef<RLoader>;
  private unvisitedOperations: LinkedQueue<RDocumentOperation>;
  private visitedOperations: Set<RDocumentOperation>;

  constructor(loader: RLoader) {
    super();
    this.loader = new WeakRef(loader);
    this.unvisitedOperations = new LinkedQueue<RDocumentOperation>();
    this.visitedOperations = new Set<RDocumentOperation>();
  }

  public tick(): void {
    if (this.unvisitedOperations.size === 0) {
      return;
    }

    debug('BeginTraverse size{%d}', this.unvisitedOperations.size);

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

    debug('EndTraverse size{%d}', totalDocumentsVisited);
    this.emit('traverse');
  }

  private prepareOperation(loader: RLoader, operation: RDocumentOperation): void {
    debug(
      'VisitDocument operationName{%s} documentType{%s}',
      operation.operationName,
      operation.document.constructor.name,
    );
    loader.pushActiveOperation(operation);
    operation.prepare(loader);
    loader.popActiveOperation();
  }

  private async postProcessOperation(
    loader: RLoader,
    operation: RDocumentOperation,
  ): Promise<void> {
    debug(
      'PostProcessDocument operationName{%s} documentType{%s}',
      operation.operationName,
      operation.document.constructor.name,
    );
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
      debug('PostProcessDocuments size{%d}', operationsReadyForPostProcessing.length);

      for (const operation of operationsReadyForPostProcessing) {
        try {
          await this.postProcessOperation(loader, operation);
        } catch (error) {
          debug('PostProcessingHandlerRejection %s', error);
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
