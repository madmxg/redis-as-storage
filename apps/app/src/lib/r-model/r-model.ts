import { type RDocumentLoader } from '../r-loader';
import { type RDocument } from '../r-document';
import { type RTraverseOptions } from '../r-document';
import { type RClassManager } from './r-class-manager';
import { managerFor } from './utils';

export abstract class RModel implements RDocument {
  #isLoaded = false;

  get #manager(): RClassManager | undefined {
    return managerFor(this);
  }

  prepareLoad(loader: RDocumentLoader, options: RTraverseOptions): void {
    void this.#manager?.runHook('load', this, loader, options);
  }

  prepareSave(loader: RDocumentLoader, options: RTraverseOptions): void {
    void this.#manager?.runHook('save', this, loader);
    if (options.loadOnSave) {
      this.prepareLoad(loader, options);
    }
  }

  prepareDelete(loader: RDocumentLoader, _options: RTraverseOptions): void {
    void this.#manager?.runHook('delete', this, loader);
  }

  async postLoad(loader: RDocumentLoader, _customData: unknown): Promise<void> {
    await this.#manager?.runHook('postLoad', this, loader);
  }

  async postSave(loader: RDocumentLoader, _customData: unknown): Promise<void> {
    await this.#manager?.runHook('postSave', this, loader);
  }

  async postDelete(loader: RDocumentLoader, _customData: unknown): Promise<void> {
    await this.#manager?.runHook('postDelete', this, loader);
  }

  get isLoaded(): boolean {
    return this.#isLoaded;
  }
}
