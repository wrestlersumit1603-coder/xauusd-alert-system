import { FastifyInstance } from 'fastify';
import { MarketPriceProvider } from '../providers/MarketPriceProvider.js';
import { AlertStore } from '../services/AlertStore.js';
import { TelegramService } from '../services/TelegramService.js';
import { config } from '../config.js';

export async function healthRoutes(
  app: FastifyInstance,
  deps: { priceProvider: MarketPriceProvider; store: AlertStore; telegram: TelegramService }
): Promise<void> {
  app.get('/api/health', async () => {
    const price = await deps.priceProvider.getCurrentPrice().catch(() => null);
    const telegramConfigured = deps.telegram.isConfigured();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      priceProvider: deps.priceProvider.name,
      currentPrice: price,
      telegramConfigured,
      activeAlerts: deps.store.list('ACTIVE').length,
      env: config.nodeEnv,
    };
  });

  app.get('/api/price', async () => {
    const price = await deps.priceProvider.getCurrentPrice().catch(() => null);
    return {
      symbol: 'XAUUSD',
      price,
      source: deps.priceProvider.name,
      timestamp: new Date().toISOString(),
    };
  });
}
