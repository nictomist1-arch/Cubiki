import { env } from './config/env.js';
import { connectDatabase } from './db/index.js';
import { createApp } from './app.js';
import { getLocalAddresses } from './utils/network.js';

async function start() {
  await connectDatabase();

  const { httpServer } = createApp();

  httpServer.listen(env.port, '0.0.0.0', () => {
    console.log(`\n  Cubiki — мультиплеер запущен!\n`);
    console.log(`  Локально:    http://localhost:${env.port}`);
    for (const ip of getLocalAddresses()) {
      console.log(`  В сети:      http://${ip}:${env.port}`);
    }
    console.log(`\n  Откройте ссылку «В сети» на телефоне в той же Wi‑Fi сети.`);
    console.log(`  Если телефон не подключается — разрешите порт ${env.port} в брандмауэре Windows.\n`);
  });
}

start().catch((err) => {
  console.error('Ошибка запуска сервера:', err);
  process.exit(1);
});
