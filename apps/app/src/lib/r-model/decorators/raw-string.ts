import { annotateDecoratorContext } from '../utils';
import { type RLoader } from '../../r-loader';
import { type RModelHooks } from '../r-model-hooks';
import { type RModel } from '../r-model';

export type ClassAccessorDecorator<This = any, TValue = any> = (
  target: ClassAccessorDecoratorTarget<This, TValue>,
  context: ClassAccessorDecoratorContext<This, TValue>,
) => ClassAccessorDecoratorResult<This, TValue> | void;

export type RawStringOptions<TModel, TValue> = {
  key: (model: TModel) => string;
  command?: string;
  readonly?: boolean;
  required?: boolean;
  serialize?: (value: TValue) => string | undefined;
  deserialize?: (value: string | null) => TValue | undefined;
};

function fetchValue<TModel extends RModel, TValue>(
  name: PropertyKey,
  model: TModel,
  loader: RLoader,
  options: RawStringOptions<TModel, TValue>,
  callback?: (value: TValue | undefined) => void,
): void {
  const command = options.command ?? 'GET';
  const key = options.key(model);
  loader.enqueueCommand<string>(command, key, (value: string | null): void => {
    let parsedValue: TValue | undefined;
    if (options.deserialize) {
      parsedValue = options.deserialize(value);
    } else {
      parsedValue = value as TValue;
    }
    if (parsedValue == null && options.required) {
      throw new Error(`MissingRequiredPropertyError_${String(name)}`);
    } else {
      callback?.(parsedValue ?? undefined);
    }
  });
}

/**
 * RawString decorator directly handles a Redis String:
 * https://redis.io/docs/data-types/strings/
 */
export function RawString<TModel extends RModel, TValue = string>(
  options: RawStringOptions<TModel, TValue>,
): ClassAccessorDecorator<TModel, TValue> {
  return function ({ get, set }, context) {
    const { name } = context;
    const manager = annotateDecoratorContext<RModelHooks<TModel>>(context);

    manager
      .addHook('load', async (model, loader) => {
        // n.b. due to how RDocumentLoaders works, we don't want to reject any
        // thrown errors here, as they will be caught and logged by the loader
        return new Promise<void>((resolve) => {
          fetchValue(name, model, loader, options, (value) => {
            set.call(model, value as TValue);
            resolve();
          });
        });
      })
      .addHook('save', (model, loader) => {
        const value = get.call(model);
        if (options.required && value == undefined) {
          throw new Error(`MissingRequiredPropertyError_${String(name)}`);
        }

        // Non-loaded models should always save all properties
        // if (model.isLoaded && !model.unsavedProperties.has(name)) return;

        let serializedValue: string | undefined;
        if (options.serialize) {
          serializedValue = options.serialize(value);
        } else if (value != null) {
          serializedValue = String(value);
        }
        if (serializedValue == undefined) {
          return;
        }

        const { promise, resolve } = Promise.withResolvers<void>();
        const args: unknown[] = ['SET', options.key(model), serializedValue];
        if (options.readonly) {
          args.push('NX');
        }
        args.push(resolve);
        // typing gets a bit weird here, so resort to casting and hope for the best
        const castedFn = loader.enqueueCommand as unknown as (...args: unknown[]) => void;
        castedFn.apply(loader, args);
        return promise;
      })
      .addHook('delete', (model, loader) => {
        loader.enqueueCommand('DEL', options.key(model));
      });

    // Produce a getter only if we actually need to check for required
    let getter: ((this: TModel) => TValue) | undefined;
    if (options.required) {
      getter = function (): TValue {
        const value = get.call(this);
        if (this.isLoaded && value == undefined) {
          throw new Error(`MissingRequiredPropertyError_${String(name)}`);
        }
        return value;
      };
    }

    return {
      get: getter,
      set(value: TValue): void {
        if (get.call(this) !== value) {
          set.call(this, value);
        }
      },
    };
  };
}
