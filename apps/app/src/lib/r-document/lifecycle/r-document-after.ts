import { type RLoader } from '../../r-loader';
import { type RAfterFunctionName } from './r-document-lifecycle';

type RAfterFunction = (loader: RLoader, customData?: unknown) => Promise<void>;

type RDocumentAfterT = { [TFunction in RAfterFunctionName]: RAfterFunction };

export interface RDocumentAfter extends RDocumentAfterT {}
