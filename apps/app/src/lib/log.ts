import { type LoggerOptions, pino } from 'pino';

const loggerOptions: LoggerOptions = {
  level: 'debug',
  messageKey: 'message',
  errorKey: 'error',
  redact: ['hostname'],
  serializers: {
    err: pino.stdSerializers.errWithCause,
    error: pino.stdSerializers.errWithCause,
  },
  hooks: {
    logMethod(inputArgs, method, _levelNumber) {
      if (
        inputArgs.length >= 2 &&
        typeof inputArgs[0] === 'string' &&
        typeof inputArgs[1] === 'object'
      ) {
        // swap the first two arguments, resulting in `(context, message)`
        const args = inputArgs as unknown[];
        [args[0], args[1]] = [args[1], args[0]];
      }

      return method.apply(this, inputArgs);
    },
  },
};

export const rootLogger = pino(loggerOptions);
