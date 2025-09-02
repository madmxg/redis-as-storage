import { type RTraverseOptions } from '../r-document';
import { type RDocumentLoader } from '../r-loader';
import { type RModel } from './r-model';

// type HookCallbackOptions = {
//   priority?: number;
// };

export type HookCallback = (...args: Array<any>) => unknown;

export type TypedHooks<Hooks> = {
  [HKey in keyof Hooks]: HookCallback;
};

export type DefaultHooks = {
  [key: string]: HookCallback;
};

export type RModelHooks<TModel extends RModel = RModel> = {
  // TODO: deprecate passing the options, they could be part of RDocumentLoader if needed
  load: (model: TModel, loader: RDocumentLoader, options: RTraverseOptions) => void;
  save: (model: TModel, loader: RDocumentLoader) => void;
  delete: (model: TModel, loader: RDocumentLoader) => void;
  postLoad: (model: TModel, loader: RDocumentLoader) => Promise<void>;
  postSave: (model: TModel, loader: RDocumentLoader) => Promise<void>;
  postDelete: (model: TModel, loader: RDocumentLoader) => Promise<void>;
};
