import { createDebug } from '../util/create-debug';

export type RCommandInput = string | Buffer | number;
export type RCommandCallback<T> = (result: T | null) => void;

type RCommandConfig<ReturnType> = {
  commandName: string;
  args?: Array<RCommandInput>;
  userCallback?: RCommandCallback<ReturnType>;
};

const debug = createDebug('RCommand');

export class RCommand<ReturnType> {
  public readonly name: string;
  public readonly args?: Array<RCommandInput>;
  public result: ReturnType | null = null;

  #beforeCallbacks: Array<VoidFunction> = [];
  #resultCallbacks: Array<RCommandCallback<ReturnType>> = [];
  #afterCallbacks: Array<VoidFunction> = [];
  #completed = Promise.withResolvers<void>();

  private constructor(config: RCommandConfig<ReturnType>) {
    this.name = config.commandName.toLowerCase();
    this.args = config.args;
    if (config.userCallback) {
      this.#resultCallbacks.push(config.userCallback);
    }
  }

  public static parse<T>(
    commandName: string,
    ...cArgs:
      | [...args: Array<RCommandInput>, callback: RCommandCallback<T>]
      | [...args: Array<RCommandInput>]
  ): RCommand<T> {
    let userCallback: RCommandCallback<T> | undefined = undefined;
    if (typeof cArgs[cArgs.length - 1] === 'function') {
      userCallback = cArgs.pop() as RCommandCallback<T>;
    }
    const commandArgs = cArgs as Array<RCommandInput>;
    return new RCommand({ commandName, args: commandArgs, userCallback });
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
      debug('CallbackResolveError %s', error);
      this.#completed.reject(error);
    } finally {
      debug('CommandResolved name{%s} result[%s]', this.name, this.result);
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

  public toString(): string {
    const parts = [this.name];
    if (this.args) {
      parts.push(...this.args.map(String));
    }
    return parts.join(' ');
  }
}
