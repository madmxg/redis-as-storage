import { Redis, type RedisOptions } from 'ioredis';

const options: RedisOptions = {
  host: 'localhost',
  port: 6379,
  db: 0,
  lazyConnect: true,
};
export const redis = new Redis(options);
void redis.connect();
