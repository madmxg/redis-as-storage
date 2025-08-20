import { rootLogger } from '../lib/log';

type AsyncVoidFunction = () => Promise<void> | void;

const log = rootLogger.child({ component: 'ExclusiveRunner' });

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
      log.warn('RunnerClosed');
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
      log.warn('ScheduleNextRunnerClosed');
      return;
    }
    this.currentRun = this.doRun();
  }

  private async doRun(): Promise<void> {
    try {
      await this.fn();
    } catch (error) {
      log.error('RunFailed', { error });
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
