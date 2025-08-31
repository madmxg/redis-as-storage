type AsyncVoidFunction = () => Promise<void> | void;

export class ExclusiveRunner {
  private open = true;
  private currentRun: Promise<void> | null = null;
  private runRequested = false;
  private readonly fn: AsyncVoidFunction;

  constructor(fn: AsyncVoidFunction) {
    this.fn = fn;
  }

  public run(): void {
    if (!this.open) {
      return;
    }
    if (this.currentRun) {
      this.runRequested = true;
    } else {
      this.scheduleNext();
    }
  }

  private scheduleNext(): void {
    if (!this.open) {
      return;
    }
    this.currentRun = this.doRun();
  }

  private async doRun(): Promise<void> {
    try {
      await this.fn();
    } catch (error) {
    } finally {
      this.currentRun = null;
      if (this.runRequested) {
        this.runRequested = false;
        this.scheduleNext();
      }
    }
  }

  public close(): Promise<void> {
    this.open = false;
    return this.currentRun ?? Promise.resolve();
  }
}
