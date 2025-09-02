import assert from 'node:assert/strict';

import { createDebug } from '../util/create-debug';
import { type RLoader } from '../r-loader';
import {
  getAfterOperation,
  getPrepareOperation,
  type RDocument,
  type RDocumentOperationName,
} from '../r-document';
import {
  type OperationCompleteCallback,
  type RDocumentOperationSpec,
} from './r-document-operation-spec';

const debug = createDebug('RDocumentOperation');

export class RDocumentOperation {
  private readonly spec: RDocumentOperationSpec;
  private children: Array<RDocumentOperation>;
  private parentRef?: WeakRef<RDocumentOperation>;
  readonly errors: Array<Error> = [];
  // Tracks commands emitted by the operation.
  private nPendingCommands = 0;
  // Commands emitted by the operation. Does not include children.
  private nCommandsSent = 0;
  // Tracks whether RTraverse has visited the operation's document.
  private visited = false;
  private postProcessComplete = false;

  constructor(spec: RDocumentOperationSpec) {
    this.spec = spec;
    this.children = [];
    const { parent } = this.spec;
    if (parent) {
      this.parentRef = new WeakRef(parent);
      delete this.spec.parent;
      parent.addChild(this);
    }
    debug('NewOperation');
  }

  public get nodeComplete(): boolean {
    return this.visited && this.nPendingCommands === 0 && this.postProcessComplete;
  }

  public get isReadyForPostProcessing(): boolean {
    return this.visited && this.nPendingCommands === 0 && !this.postProcessComplete;
  }

  public debugOperation(): void {
    debug('OperationStatus %o', {
      visited: this.visited,
      nPendingCommands: this.nPendingCommands,
      postProcessComplete: this.postProcessComplete,
      childrenComplete: this.children.every((child) => child.treeComplete),
      nCommandsSent: this.nCommandsSent,
    });
  }

  public get treeComplete(): boolean {
    return this.nodeComplete && this.children.every((child) => child.treeComplete);
  }

  public get isVisited(): boolean {
    return this.visited;
  }

  private markPostProcessed(): void {
    this.postProcessComplete = true;
  }

  public addPendingCommand(): VoidFunction {
    this.nPendingCommands++;
    this.nCommandsSent++;

    return () => {
      this.nPendingCommands--;
      if (this.nPendingCommands === 0) {
        debug('AllCommandsReturned');
      }
    };
  }

  public pushError(error: Error): void {
    this.errors.push(error);
  }

  public get document(): RDocument {
    return this.spec.document;
  }

  public get operationName(): RDocumentOperationName {
    return this.spec.operation;
  }

  public get operationCompleteCallback(): OperationCompleteCallback | undefined {
    return this.spec.onOperationComplete;
  }

  public get customData(): unknown {
    return this.spec.customData;
  }

  private addChild(node: RDocumentOperation): void {
    this.children.push(node);
  }

  public get parent(): RDocumentOperation | undefined {
    return this.parentRef?.deref();
  }

  public prepare(loader: RLoader): void {
    try {
      this.document[getPrepareOperation(this.operationName)](loader, this.customData);
    } catch (error) {
      debug('TraverseError', { error });
      this.pushError(error as Error);
    }
    this.visited = true;
  }

  public async postProcess(loader: RLoader): Promise<void> {
    assert(!this.postProcessComplete, 'PostProcessAlreadyComplete');
    await this.document[getAfterOperation(this.operationName)](loader, this.customData);
    this.markPostProcessed();
  }

  public notifyCompletionCallbacks(): void {
    // NB: depth first: children should receive callbacks before parents to
    // ensure parent has access to the completed child.
    this.children.forEach((child) => {
      child.notifyCompletionCallbacks();
    });
    if (this.operationCompleteCallback) {
      this.operationCompleteCallback(this.errors.length > 0 ? this.errors : undefined);
    }
  }
}
