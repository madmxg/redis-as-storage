import debug, { type Debugger } from 'debug';

export function createDebug(name: string): Debugger {
  return debug(`R:${name}`);
}
