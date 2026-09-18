import { config } from '../config.js';

export type AlertPayload = {
  symbol: string;
  targetPrice: number;
  currentPrice: number;
  condition: string;
  timeIST: string;
};

function conditionLabel(c: string): string {
  if (c === 'PRICE_ABOVE') return 'Price Above';
  if (c === 'PRICE_BELOW') return 'Price Below';
  return 'Price Reached';
}

export function formatAlertMessage(p: AlertPayload): string {
  return `🔔 ${p.symbol} PRICE ALERT

Target: ${p.targetPrice.toFixed(2)}
Current Price: ${p.currentPrice.toFixed(2)}
Condition: ${conditionLabel(p.condition)}
Time: ${p.timeIST}`;
}

export class TelegramService {
  private botToken: string;
  private chatId: string;

  constructor(botToken = config.telegramBotToken, chatId = config.telegramChatId) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.isConfigured()) {
      const err = new Error('Telegram not configured: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID');
      console.error('[telegram]', err.message);
      throw err;
    }
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Telegram API error ${res.status}: ${body}`);
      console.error('[telegram] send failed', err.message);
      throw err;
    }
    console.log('[telegram] message sent');
  }

  async sendAlert(payload: AlertPayload): Promise<void> {
    const msg = formatAlertMessage(payload);
    await this.sendMessage(msg);
  }

  async sendTest(): Promise<void> {
    const now = new Date();
    const ist = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const text = `✅ XAUUSD Alert System – Test Message\n\nYour Telegram integration is working!\nTime: ${ist} IST`;
    await this.sendMessage(text);
  }
}
