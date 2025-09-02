import { type DefaultHooks, type HookCallback, type TypedHooks } from './r-model-hooks';

export class RClassManager<THooks extends TypedHooks<THooks> = DefaultHooks> {
  #hooks: Map<PropertyKey, Set<HookCallback>> = new Map();
  #annotations: Array<[symbol, unknown]> = [];

  annotate<T>(tag: symbol, value: T): void {
    this.#annotations.push([tag, value]);
  }

  getAnnotations<T = unknown>(tag: symbol): Array<T> {
    return this.#annotations.filter(([t]) => t === tag).map(([, value]) => value as T);
  }

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
    return Promise.all(results ?? []).then((r) => console.log('r', r));
  }
}
