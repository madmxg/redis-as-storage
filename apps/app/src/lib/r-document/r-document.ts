import {
  type RDocumentOperationName,
  type RPrepareFunctionName,
  type RAfterFunctionName,
  type RDocumentPrepare,
  type RDocumentAfter,
} from './lifecycle';

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
