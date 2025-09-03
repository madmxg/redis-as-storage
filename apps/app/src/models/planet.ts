import { RawString, RModel } from '../lib/r-model';

export type PlanetDocument = {
  id: string;
  name?: string;
  gravity?: string;
  diameter?: number;
};

function buildModelKey(model: Planet, keyProperty: string): string {
  return `${model.id}:${keyProperty}`;
}

export class Planet extends RModel {
  public readonly id: string;

  @RawString({ key: (model) => buildModelKey(model, 'name') })
  public accessor name: string | undefined;

  @RawString({ key: (model) => buildModelKey(model, 'gravity') })
  public accessor gravity: string | undefined;

  @RawString({
    key: (model) => buildModelKey(model, 'diameter'),
    serialize: (value) => {
      if (typeof value === 'number') {
        return String(value);
      }
    },
    deserialize: (value) => {
      if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      }
    },
  })
  public accessor diameter: number | undefined;

  constructor(id: string) {
    super();
    this.id = id;
  }

  public get exists(): boolean {
    if (!this.isLoaded) {
      return false;
    }
    return typeof this.name !== 'undefined';
  }

  public getDocument(): PlanetDocument {
    return {
      id: this.id,
      name: this.name,
      gravity: this.gravity,
      diameter: this.diameter,
    };
  }
}
