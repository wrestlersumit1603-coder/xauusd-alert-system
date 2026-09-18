# Telegram Setup

Telegram credentials are NEVER hard-coded. Use env vars.

## 1. Create Bot

1. Open Telegram, search for `@BotFather`.
2. Send `/newbot`
3. Follow prompts: choose name (e.g., `My XAUUSD Alerts`) and username (must end with `bot`, e.g., `my_xauusd_alert_bot`).
4. BotFather replies with token like `1234567890:AAH...` — copy it.

## 2. Get Chat ID

### Option A — getUpdates (simplest)
1. Search your new bot by username, tap **Start** and send any message (e.g., `hi`).
2. In browser or curl:
   ```
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
3. JSON contains `message.chat.id` — that is your `TELEGRAM_CHAT_ID` (e.g., `987654321`).

### Option B — @userinfobot
1. Search `@userinfobot` on Telegram, send `/start`, it replies with your user ID.

> For group chats, invite the bot to the group and use the group chat ID (negative number).

## 3. Configure

`.env`:
```
TELEGRAM_BOT_TOKEN=1234567890:AAH...
TELEGRAM_CHAT_ID=987654321
```

## 4. Test

- Via UI: open dashboard → **Test Telegram** button.
- Via curl: `curl -X POST http://localhost:3000/api/telegram/test`
- Direct: `curl -X POST https://api.telegram.org/bot<TOKEN>/sendMessage -d chat_id=<CHAT_ID> -d text="hello"`

## 5. Alert Message Format

```
🔔 XAUUSD PRICE ALERT

Target: 3650.00
Current Price: 3650.20
Condition: Price Reached
Time: 18 Sep 2026, 22:42 IST
```

No Buy/Sell/TP/SL.

## 6. Troubleshooting

- `401 Unauthorized` → token wrong or revoked. Regenerate via BotFather `/token`.
- `400 Bad Request: chat not found` → chat ID wrong or bot not started (`/start` not sent).
- `403 Forbidden: bot was blocked` → unblock bot in Telegram.
- Logs: backend logs show `[telegram]` errors with HTTP status + body.

## 7. Security

- Never commit `.env`.
- Rotate token via BotFather `/revoke` if leaked.
- On VPS, set env via `pm2 env` or systemd `EnvironmentFile`, not in frontend.
