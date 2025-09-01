import { type RDocumentOperationName } from './lifecycle';
import { type RTraverseOptions } from '../rloader/RTraverseOptions';
import { type RDocumentOperation } from './r-document-operation';
import { type RDocument } from './r-document';

export type OperationCompleteCallback = (errors?: Array<Error>) => void;

export type RDocumentOperationSpec = {
  document: RDocument;
  operation: RDocumentOperationName;
  traverseOptions?: RTraverseOptions;
  customData?: unknown;
  onOperationComplete?: OperationCompleteCallback;
  parent?: RDocumentOperation;
};
