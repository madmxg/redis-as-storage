import {
  type RDocumentOperationName,
  type RPrepareFunctionName,
  type RAfterFunctionName,
} from './lifecycle/r-document-lifecycle';
import { type RDocumentPrepare } from './lifecycle/r-document-prepare';
import { type RDocumentAfter } from './lifecycle/r-document-after';

export interface RDocument extends RDocumentPrepare, RDocumentAfter {}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getPrepareOperation(operation: RDocumentOperationName): RPrepareFunctionName {
  return `prepare${capitalizeFirst(operation)}` as RPrepareFunctionName;
}

export function getAfterOperation(operation: RDocumentOperationName): RAfterFunctionName {
  return `post${capitalizeFirst(operation)}` as RAfterFunctionName;
}
