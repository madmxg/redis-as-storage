export class CountingSemaphore {
  #buffer: SharedArrayBuffer;
  #view: Int32Array;

  /** Shared buffer holding the semaphore state */
  get buffer(): SharedArrayBuffer {
    return this.#buffer;
  }

  /** Whether the semaphore is currently at full capacity or not */
  get blocked(): boolean {
    return Atomics.load(this.#view, 0) <= 0;
  }

  constructor(limit: number);
  constructor(buffer: SharedArrayBuffer);
  constructor(limitOrBuffer?: number | SharedArrayBuffer) {
    if (limitOrBuffer instanceof SharedArrayBuffer) {
      this.#buffer = limitOrBuffer;
      this.#view = new Int32Array(this.#buffer);
    } else {
      this.#buffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
      this.#view = new Int32Array(this.#buffer);
      Atomics.store(this.#view, 0, limitOrBuffer ?? 1);
    }
  }

  /**
   * Waits for a resource to be available, or until a timeout is reached.
   *
   * The return value indicates whether the resource was taken or not (timed out).
   */
  async take({ timeout = undefined }: { timeout?: number } = {}): Promise<boolean> {
    // ensures any waiting "threads" have a chance to wake up even when one
    // thread keeps acquiring and releasing the semaphore in a sync loop
    await Promise.resolve();

    const startedAt = performance.now();
    while (true) {
      // acquire a resource
      const previous = Atomics.sub(this.#view, 0, 1);
      if (previous > 0) {
        return true;
      }
      // undo the acquiring since we exceeded the limit
      // n.b. there is a very small risk that the thread gets killed in between
      Atomics.add(this.#view, 0, 1);

      const elapsed = performance.now() - startedAt;
      const remaining = timeout !== undefined ? timeout - elapsed : undefined;
      if (remaining !== undefined && remaining <= 0) break;

      const result = Atomics.waitAsync(this.#view, 0, previous, remaining);
      if (!result.async && result.value === 'not-equal') {
        continue;
      }

      const value = await result.value;
      if (value === 'timed-out') break;
    }

    // reaching this point means we timed out, avoid a deadlock by waking up
    // the next waiting thread, otherwise it might wait forever since no more
    // notify calls might be made.
    Atomics.notify(this.#view, 0, 1);
    return false;
  }

  /**
   * Signals that a resource is available again.
   */
  notify(): void {
    Atomics.add(this.#view, 0, 1);
    Atomics.notify(this.#view, 0, 1);
  }
}
