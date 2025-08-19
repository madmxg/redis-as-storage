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
};

export const rootLogger = pino(loggerOptions);
