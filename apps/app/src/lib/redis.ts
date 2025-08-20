import { Redis, type RedisOptions } from 'ioredis';

const options: RedisOptions = {
  host: 'localhost',
  port: 6379,
  db: 0,
};
export const redis = new Redis(options);
