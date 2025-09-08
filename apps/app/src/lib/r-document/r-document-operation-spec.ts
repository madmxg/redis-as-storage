import { type RDocumentOperationName } from './lifecycle/r-document-lifecycle';
import { type RDocumentOperation } from './r-document-operation';
import { type RDocument } from './r-document';

export type OperationCompleteCallback = (errors?: Array<Error>) => void;

export type RDocumentOperationSpec = {
  document: RDocument;
  operation: RDocumentOperationName;
  onOperationComplete?: OperationCompleteCallback;
  parent?: RDocumentOperation;
};
