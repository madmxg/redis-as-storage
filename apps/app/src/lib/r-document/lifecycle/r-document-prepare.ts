import { type RPrepareFunctionName } from './r-document-lifecycle';
import { type RTraverseOptions } from '../traverse';
import { type RDocumentLoader } from '../../r-loader';

type RPrepareFunction = (
  loader: RDocumentLoader,
  options: RTraverseOptions,
  customData?: unknown,
) => void;

type RDocumentPrepareT = { [TFunction in RPrepareFunctionName]: RPrepareFunction };

export interface RDocumentPrepare extends RDocumentPrepareT {}
