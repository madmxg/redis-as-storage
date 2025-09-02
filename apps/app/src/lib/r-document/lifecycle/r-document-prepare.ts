import { type RLoader } from '../../r-loader';
import { type RTraverseOptions } from '../traverse/r-traverse-options';
import { type RPrepareFunctionName } from './r-document-lifecycle';

type RPrepareFunction = (loader: RLoader, options: RTraverseOptions, customData?: unknown) => void;

type RDocumentPrepareT = { [TFunction in RPrepareFunctionName]: RPrepareFunction };

export interface RDocumentPrepare extends RDocumentPrepareT {}
