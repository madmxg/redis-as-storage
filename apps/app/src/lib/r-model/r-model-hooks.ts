import { type RLoader } from '../r-loader';
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
  load: (model: TModel, loader: RLoader) => void;
  save: (model: TModel, loader: RLoader) => void;
  delete: (model: TModel, loader: RLoader) => void;
  postLoad: (model: TModel, loader: RLoader) => Promise<void>;
  postSave: (model: TModel, loader: RLoader) => Promise<void>;
  postDelete: (model: TModel, loader: RLoader) => Promise<void>;
};
