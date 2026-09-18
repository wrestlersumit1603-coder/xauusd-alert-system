import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { getDb } from './db/database.js';
import { AlertStore } from './services/AlertStore.js';
import { TelegramService } from './services/TelegramService.js';
import { AlertEngine } from './services/AlertEngine.js';
import { createPriceProvider } from './providers/index.js';
import { alertRoutes } from './routes/alerts.js';
import { healthRoutes } from './routes/health.js';
import { telegramRoutes } from './routes/telegram.js';
import path from 'path';
import fs from 'fs';

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  const db = getDb();
  const store = new AlertStore(db);
  const telegram = new TelegramService();
  const priceProvider = createPriceProvider();
  const engine = new AlertEngine(store, priceProvider, telegram);

  // Wire routes
  await alertRoutes(app, store);
  await healthRoutes(app, { priceProvider, store, telegram });
  await telegramRoutes(app, telegram);

  // Serve frontend static if exists
  const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    // Use fastify static would require plugin; simple fallback: serve via hook
    // For production we recommend nginx or separate static serving; this is minimal
    console.log(`[server] frontend dist found at ${frontendDist}`);
  }

  // Root info
  app.get('/', async () => ({
    name: 'XAUUSD Price Alert System',
    status: 'running',
    docs: '/api/health',
  }));

  // Start monitoring
  engine.start();
  try {
    priceProvider.startMonitoring();
    console.log(`[price] provider ${priceProvider.name} started`);
  } catch (e: any) {
    console.error(`[price] failed to start provider: ${e.message}`);
    console.error('[price] Set PRICE_PROVIDER=mock or polling, or configure EXNESS_API_URL');
    // Do not crash – health endpoint still works, user can fix env and restart
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[server] shutting down...');
    try {
      priceProvider.stopMonitoring();
    } catch {}
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Resume: log active alerts on startup
  const active = store.listActive();
  console.log(`[engine] resuming ${active.length} active alerts`);

  const port = config.port;
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[server] listening on http://0.0.0.0:${port}`);
  console.log(`[server] health: http://0.0.0.0:${port}/api/health`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
