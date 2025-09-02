import { type RLoader } from '../../r-loader';
import { type RPrepareFunctionName } from './r-document-lifecycle';

// TODO: customData?
type RPrepareFunction = (loader: RLoader, customData?: unknown) => void;

type RDocumentPrepareT = { [TFunction in RPrepareFunctionName]: RPrepareFunction };

export interface RDocumentPrepare extends RDocumentPrepareT {}
