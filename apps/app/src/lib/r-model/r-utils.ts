import assert from 'node:assert/strict';

import { RClassManager } from './r-class-manager';
import { type DefaultHooks, type TypedHooks } from './r-model-hooks';
import { RSymbol } from './r-symbols';

if (!Symbol.metadata) {
  Object.assign(Symbol, { metadata: Symbol.for('Symbol.metadata') });
}

export function annotateDecoratorContext<THooks extends TypedHooks<DefaultHooks> = DefaultHooks>(
  context: DecoratorContext,
): RClassManager<THooks> {
  const { metadata } = context;
  if (!Object.hasOwn(metadata, RSymbol)) {
    const manager = new RClassManager();
    metadata[RSymbol] = manager;
  }
  return metadata[RSymbol] as RClassManager;
}

export function managerFor<THooks extends TypedHooks<DefaultHooks> = DefaultHooks>(
  classOrInstance: object,
): RClassManager<THooks> {
  const ctor =
    typeof classOrInstance === 'function' ? classOrInstance : classOrInstance.constructor;

  assert(Symbol.metadata, 'SymbolMetadataNotExist');
  if (Symbol.metadata in ctor) {
    const metadata = ctor[Symbol.metadata];
    if (metadata && RSymbol in metadata) {
      return metadata[RSymbol] as RClassManager;
    }
  }
  throw new Error('NotRDecoratedError');
}
