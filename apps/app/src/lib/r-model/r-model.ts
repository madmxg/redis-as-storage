import { type RLoader } from '../r-loader';
import { type RDocument } from '../r-document';
import { type RClassManager } from './r-class-manager';
import { managerFor } from './utils';

export abstract class RModel implements RDocument {
  #isLoaded = false;

  get #manager(): RClassManager | undefined {
    return managerFor(this);
  }

  prepareLoad(loader: RLoader): void {
    void this.#manager?.runHook('load', this, loader);
  }

  prepareSave(loader: RLoader): void {
    void this.#manager?.runHook('save', this, loader);
  }

  prepareDelete(loader: RLoader): void {
    void this.#manager?.runHook('delete', this, loader);
  }

  async postLoad(loader: RLoader, _customData: unknown): Promise<void> {
    await this.#manager?.runHook('postLoad', this, loader);
  }

  async postSave(loader: RLoader, _customData: unknown): Promise<void> {
    await this.#manager?.runHook('postSave', this, loader);
  }

  async postDelete(loader: RLoader, _customData: unknown): Promise<void> {
    await this.#manager?.runHook('postDelete', this, loader);
  }

  get isLoaded(): boolean {
    return this.#isLoaded;
  }
}
