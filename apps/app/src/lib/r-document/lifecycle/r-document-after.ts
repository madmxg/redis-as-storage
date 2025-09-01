import { type RDocumentLoader } from '../../rloader/RDocumentLoader';
import { type RAfterFunctionName } from './r-document-lifecycle';

type RAfterFunction = (loader: RDocumentLoader, customData?: unknown) => Promise<void>;

type RDocumentAfterT = { [TFunction in RAfterFunctionName]: RAfterFunction };

export interface RDocumentAfter extends RDocumentAfterT {}
