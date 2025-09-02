import { type RDocument } from '../lib/r-document';
import { type RLoader } from '../lib/r-loader';

export type FilmDocument = {
  id: string;
  text?: string;
};

export class Film implements RDocument {
  #exist = false;
  #deleted = false;

  public readonly id: string;
  public text: string | undefined;

  constructor(id: string) {
    this.id = id;
  }

  prepareLoad(loader: RLoader): void {
    loader.enqueueCommand<string>('GET', `${this.id}:text`, (result) => {
      if (typeof result === 'string') {
        this.#exist = true;
        this.text = result;
      }
    });
  }

  prepareSave(loader: RLoader): void {
    if (typeof this.text !== 'undefined') {
      loader.enqueueCommand<'OK'>('SET', `${this.id}:text`, this.text, (result) => {
        if (result === 'OK') {
          this.#exist = true;
        }
      });
    }
  }

  prepareDelete(loader: RLoader): void {
    loader.enqueueCommand<1>('DEL', `${this.id}:text`, (result) => {
      this.#deleted = result === 1;
    });
  }

  public getDocument(): FilmDocument {
    return {
      id: this.id,
      text: this.text,
    };
  }

  public get exist(): boolean {
    return this.#exist;
  }

  public get deleted(): boolean {
    return this.#deleted;
  }

  async postLoad(): Promise<void> {}
  async postSave(): Promise<void> {}
  async postDelete(): Promise<void> {}
}
