import { createDebug } from '../util/create-debug';

export type RCommandInput = string | Buffer | number;
export type RCommandCallback<T> = (result: T | null) => void;

type RCommandConfig<ReturnType> = {
  commandName: string;
  args?: RCommandInput[];
  userCallback?: RCommandCallback<ReturnType>;
};

const debug = createDebug('RCommand');

export class RCommand<ReturnType> {
  readonly name: string;
  readonly args?: RCommandInput[];

  #beforeCallbacks: VoidFunction[] = [];
  #resultCallbacks: RCommandCallback<ReturnType>[] = [];
  #afterCallbacks: VoidFunction[] = [];
  #completed = Promise.withResolvers<void>();
  #result: ReturnType | null = null;

  private constructor(config: RCommandConfig<ReturnType>) {
    this.name = config.commandName.toLowerCase();
    this.args = config.args;
    if (config.userCallback) {
      this.#resultCallbacks.push(config.userCallback);
    }
  }

  public static parse<T>(
    commandName: string,
    ...cArgs: [...args: RCommandInput[], callback: RCommandCallback<T>] | [...args: RCommandInput[]]
  ): RCommand<T> {
    let userCallback: RCommandCallback<T> | undefined = undefined;
    if (typeof cArgs[cArgs.length - 1] === 'function') {
      userCallback = cArgs.pop() as RCommandCallback<T>;
    }
    const commandArgs = cArgs as RCommandInput[];
    return new RCommand({ commandName, args: commandArgs, userCallback });
  }

  public set result(value: ReturnType) {
    this.#result = value;
  }

  public get result(): ReturnType | null {
    return this.#result;
  }

  public get completed(): Promise<void> {
    return this.#completed.promise;
  }

  public resolve(): void {
    try {
      this.#beforeCallbacks.forEach((beforeCallback) => {
        beforeCallback();
      });
      this.#resultCallbacks.forEach((callback) => {
        callback(this.result);
      });
      this.#afterCallbacks.forEach((afterCallback) => {
        afterCallback();
      });
      this.#completed.resolve();
    } catch (error) {
      debug('CallbackResolveError', { errorMessage: String(error) });
      this.#completed.reject(error);
    } finally {
      this.#beforeCallbacks = [];
      this.#resultCallbacks = [];
      this.#afterCallbacks = [];
    }
  }

  public addBeforeCallbacksListener(fn: VoidFunction): void {
    this.#beforeCallbacks.push(fn);
  }

  public addResultCallback(callback: RCommandCallback<ReturnType>): void {
    this.#resultCallbacks.push(callback);
  }

  public addAfterCallbacksListener(fn: VoidFunction): void {
    this.#afterCallbacks.push(fn);
  }

  public equals(other: RCommand<any>): boolean {
    if (!this.args) return this.name === other.name;
    return (
      this.args.length === other.args?.length &&
      this.args.every((arg, idx) => arg === other.args?.[idx])
    );
  }

  public toString(): string {
    const parts = [this.name];
    if (this.args) {
      parts.push(...this.args.map(String));
    }
    return parts.join(' ');
  }
}
