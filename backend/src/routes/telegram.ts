import { FastifyInstance } from 'fastify';
import { TelegramService } from '../services/TelegramService.js';

export async function telegramRoutes(app: FastifyInstance, telegram: TelegramService): Promise<void> {
  app.post('/api/telegram/test', async (_req, reply) => {
    if (!telegram.isConfigured()) {
      return reply.code(400).send({ error: 'Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID' });
    }
    try {
      await telegram.sendTest();
      return { ok: true, message: 'Test message sent' };
    } catch (e: any) {
      return reply.code(502).send({ error: e.message || 'Telegram send failed' });
    }
  });

  app.get('/api/telegram/status', async () => {
    return { configured: telegram.isConfigured() };
  });
}
