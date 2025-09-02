export class RDocumentOperationError extends Error {
  constructor(errors: Error[]) {
    super('Errors occurred during RDocumentOperation', { cause: errors });
  }
}
