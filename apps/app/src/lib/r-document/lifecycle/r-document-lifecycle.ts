export type RDocumentOperationName = 'load' | 'save' | 'delete';

export type RPrepareFunctionName = `prepare${Capitalize<RDocumentOperationName>}`;
export type RAfterFunctionName = `post${Capitalize<RDocumentOperationName>}`;
