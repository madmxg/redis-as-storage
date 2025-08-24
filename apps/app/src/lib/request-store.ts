import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

import { type RDocumentLoader } from '../lib/rloader';

type RequestState = {
  requestId: string;
  loader: RDocumentLoader;
};

const localStorage = new AsyncLocalStorage<Partial<RequestState>>();

export function initializeStore(next: VoidFunction): void {
  const listParams: Partial<RequestState> = {};
  localStorage.run(listParams, next);
}

export function setStoreValue<TIdentifier extends keyof RequestState>(
  key: TIdentifier,
  value: RequestState[TIdentifier],
): void {
  const store = localStorage.getStore();
  if (typeof store === 'undefined') {
    throw new Error('RequestStateNotInitialized');
  }
  const currentValue = store[key];
  if (typeof currentValue !== 'undefined') {
    throw new Error(`RequestStateKeyAlreadyInitialized_[${key}]`);
  }
  store[key] = value;
}

export function getStoreValue<TIdentifier extends keyof RequestState>(
  key: TIdentifier,
): RequestState[TIdentifier] {
  const store = localStorage.getStore();
  if (typeof store === 'undefined') {
    throw new Error('RequestStateNotInitialized');
  }
  const value = store[key];
  assert(value, `RequestStateKeyNotFound_[${key}]`);
  return value;
}
