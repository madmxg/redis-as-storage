import { createDebug } from '../util/create-debug';
import { type DefaultHooks, type HookCallback, type TypedHooks } from './r-model-hooks';

const debug = createDebug('RClassManager');

export class RClassManager<THooks extends TypedHooks<THooks> = DefaultHooks> {
  #hooks: Map<PropertyKey, Set<HookCallback>> = new Map();

  addHook<TName extends keyof THooks>(hookName: TName, hookCallback: THooks[TName]): this {
    let hooks = this.#hooks.get(hookName);
    if (typeof hooks === 'undefined') {
      hooks = new Set();
      this.#hooks.set(hookName, hooks);
    }
    hooks.add(hookCallback);
    // TODO: sort hooks
    // this.#sortHookCallbacks(hookName);
    return this;
  }

  runHook<TName extends keyof THooks>(
    name: TName,
    ...args: Parameters<THooks[TName]>
  ): Promise<void> {
    const hookCallbacks = this.#hooks.get(name);
    const results = hookCallbacks
      ?.values()
      .map((hook) => hook(...args))
      .toArray();

    return Promise.all(results ?? []).then((value) =>
      debug('HookCompleted name{%s} value{%s}', name, value),
    );
  }
}
