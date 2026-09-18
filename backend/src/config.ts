import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './data/alerts.db',
  pricePollIntervalMs: parseInt(process.env.PRICE_POLL_INTERVAL_MS || '5000', 10),
  priceProvider: (process.env.PRICE_PROVIDER || 'polling') as 'mock' | 'exness' | 'polling',
  exnessApiUrl: process.env.EXNESS_API_URL || '',
  exnessApiKey: process.env.EXNESS_API_KEY || '',
  pollingPriceUrl: process.env.POLLING_PRICE_URL || 'https://www.chartgoldprice.com/api/data',
  pollingApiKey: process.env.POLLING_API_KEY || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  displayTimezone: process.env.DISPLAY_TIMEZONE || 'Asia/Kolkata',
};

export function validateTelegramConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!config.telegramBotToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!config.telegramChatId) missing.push('TELEGRAM_CHAT_ID');
  return { valid: missing.length === 0, missing };
}
