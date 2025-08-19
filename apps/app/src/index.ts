import { rootLogger } from './lib/log';
import { createWebServer } from './lib/web-server';

const log = rootLogger.child({ component: 'AppMain' });

async function main(): Promise<void> {
  await createWebServer();
  log.info('ProcessStarted');
}

void main();
