import { rootLogger } from '../lib/log';

export class CountDownLatch {
  static #instanceCount = 0;

  #count: number;
  readonly #promise: PromiseWithResolvers<void>;
  readonly #instanceId = CountDownLatch.#instanceCount++;
  protected log = rootLogger.child({ component: 'CountDownLatch', instanceId: this.#instanceId });

  constructor(count: number) {
    this.#count = count;
    this.#promise = Promise.withResolvers();
    this.log.debug('NewCountdownLatch');
  }

  async #resolve(): Promise<void> {
    this.log.debug('WillResolveLatch');
    this.#promise.resolve();
  }

  public get count(): number {
    return this.#count;
  }

  public countDown(): void {
    this.log.debug('CountDown', { priorCount: this.count });
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
