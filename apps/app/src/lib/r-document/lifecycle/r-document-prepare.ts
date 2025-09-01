import { type RDocumentLoader } from '../../rloader/RDocumentLoader';
import { type RTraverseOptions } from '../../rloader/RTraverseOptions';
import { type RPrepareFunctionName } from './r-document-lifecycle';

type RPrepareFunction = (
  loader: RDocumentLoader,
  options: RTraverseOptions,
  customData?: unknown,
) => void;

type RDocumentPrepareT = { [TFunction in RPrepareFunctionName]: RPrepareFunction };

export interface RDocumentPrepare extends RDocumentPrepareT {}
