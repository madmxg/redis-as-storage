import { type RDocument } from '../lib/r-document';
import { type RLoader } from '../lib/r-loader';

export type FilmDocument = {
  id: string;
  title?: string;
  director?: string;
};

export class Film implements RDocument {
  #exist = false;
  #deleted = false;

  public readonly id: string;
  public title: string | undefined;
  public director: string | undefined;

  constructor(id: string) {
    this.id = id;
  }

  prepareLoad(loader: RLoader): void {
    loader.enqueueCommand<string>('GET', `${this.id}:title`, (title) => {
      loader.enqueueCommand<string>('GET', `${this.id}:director`, (director) => {
        if (typeof title === 'string') {
          this.#exist = true;
          this.title = title;
        }
        if (typeof director === 'string') {
          this.#exist = true;
          this.director = director;
        }
      });
    });
  }

  prepareSave(loader: RLoader): void {
    if (typeof this.title !== 'undefined') {
      loader.enqueueCommand<'OK'>('SET', `${this.id}:title`, this.title, (result) => {
        if (result === 'OK') {
          this.#exist = true;
        }
      });
    }
    if (typeof this.director !== 'undefined') {
      loader.enqueueCommand<'OK'>('SET', `${this.id}:director`, this.director, (result) => {
        if (result === 'OK') {
          this.#exist = true;
        }
      });
    }
  }

  prepareDelete(loader: RLoader): void {
    loader.enqueueCommand<2>('DEL', `${this.id}:title`, `${this.id}:director`, (result) => {
      this.#deleted = result === 2;
      this.title = undefined;
      this.director = undefined;
    });
  }

  public getDocument(): FilmDocument {
    return {
      id: this.id,
      title: this.title,
      director: this.director,
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
