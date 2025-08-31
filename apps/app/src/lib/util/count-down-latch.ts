import { setImmediate } from 'node:timers';

export class CountDownLatch {
  #count: number;
  readonly #promise: PromiseWithResolvers<void>;

  constructor(count: number) {
    this.#count = count;
    this.#promise = Promise.withResolvers();
  }

  async #resolve(): Promise<void> {
    this.#promise.resolve();
  }

  public get count(): number {
    return this.#count;
  }

  public countDown(): void {
    if (this.#count <= 0) {
      return;
    }
    this.#count--;
    if (this.#count === 0) {
      setImmediate(() => {
        void this.#resolve();
      });
    }
  }

  public async await(): Promise<void> {
    await this.#promise.promise;
  }
}
