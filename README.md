# XAUUSD Price Alert System

**Single purpose:** User sets XAUUSD price levels → live price crosses target → instant Telegram alert. No trading, no signals, no indicators.

```
XAUUSD Live Feed → Cloud Backend (24/7) → Alert Engine (cross detection) → Telegram Bot → iPhone
Frontend can be CLOSED — backend keeps monitoring.
```

## Architecture

- **Backend:** Fastify + TypeScript + Node.js `node:sqlite` (built-in, WAL mode). Runs 24/7 on VPS.
- **Price Provider abstraction:** `MarketPriceProvider` interface with `getCurrentPrice()`, `startMonitoring()`, `stopMonitoring()`. Implementations: `MockProvider` (tests/dev), `PollingProvider` (HTTP polling), `ExnessProvider` (requires credentials — will FAIL FAST if not configured, never silently substitutes another feed).
- **Alert Engine:** Handles crossing between polling intervals (`prevPrice < target && currPrice >= target`). One-time alerts marked `TRIGGERED` atomically via `UPDATE ... WHERE status='ACTIVE'` to prevent duplicate Telegram sends.
- **Telegram:** `TelegramService` via Bot API. Credentials from env only.
- **Frontend:** Vite + React, mobile-friendly, polling every 5s.
- **Reliability:** PM2 autorestart, health check `/api/health`, WAL DB persists across restarts, active alerts auto-resumed.

## Files Created

```
xauusd-alert-system/
├── backend/
│   ├── src/
│   │   ├── config.ts
│   │   ├── index.ts              # Fastify bootstrap + engine start
│   │   ├── db/database.ts        # node:sqlite + migrations
│   │   ├── db/migrate.ts
│   │   ├── providers/
│   │   │   ├── MarketPriceProvider.ts
│   │   │   ├── MockProvider.ts
│   │   │   ├── PollingProvider.ts
│   │   │   └── ExnessProvider.ts
│   │   ├── services/
│   │   │   ├── AlertStore.ts
│   │   │   ├── AlertEngine.ts
│   │   │   └── TelegramService.ts
│   │   ├── routes/
│   │   │   ├── alerts.ts
│   │   │   ├── health.ts
│   │   │   └── telegram.ts
│   │   └── utils/time.ts
│   ├── tests/alertEngine.test.ts  # 18 tests covering 13 required scenarios
│   └── package.json / tsconfig.json / vitest.config.ts
├── frontend/
│   ├── src/App.tsx               # Minimal dashboard
│   ├── src/main.tsx / index.css
│   └── vite.config.ts
├── ecosystem.config.js           # PM2
├── Dockerfile
├── .env.example
├── README.md
└── docs/
    ├── TELEGRAM_SETUP.md
    ├── EXNESS_FEED.md
    └── DEPLOYMENT.md
```

## Setup — Local Dev

```bash
git clone <repo>
cd xauusd-alert-system
cp .env.example .env   # fill TELEGRAM_*

# Backend
cd backend && npm install && npm run dev   # http://localhost:3000

# Frontend (second terminal)
cd frontend && npm install && npm run dev  # http://localhost:5173 (proxies /api)
```

### Environment Variables

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `PORT` | no | `3000` | |
| `DATABASE_PATH` | no | `./data/alerts.db` | `:memory:` for tests |
| `PRICE_POLL_INTERVAL_MS` | no | `5000` | |
| `PRICE_PROVIDER` | no | `mock` | `mock` \| `polling` \| `exness` |
| `TELEGRAM_BOT_TOKEN` | **yes** | — | From @BotFather |
| `TELEGRAM_CHAT_ID` | **yes** | — | See TELEGRAM_SETUP.md |
| `POLLING_PRICE_URL` | if polling | `https://api.gold-api.com/price/XAU` | Any HTTP JSON price endpoint |
| `EXNESS_API_URL` | if exness | — | See EXNESS_FEED.md |
| `EXNESS_API_KEY` | if exness | — | |

## Telegram Setup

See `docs/TELEGRAM_SETUP.md`.

Quick:

1. Telegram → search `@BotFather` → `/newbot` → get token.
2. Search your bot → `/start`.
3. Get chat ID: `curl https://api.telegram.org/bot<TOKEN>/getUpdates` (send a message first) or use `@userinfobot`.
4. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`.
5. Test: `curl -X POST http://localhost:3000/api/telegram/test` or button in UI.

## Exness Price Feed Requirement

**Exness does not expose a public XAUUSD REST/WebSocket feed without an account/API agreement.** This app isolates the feed behind `MarketPriceProvider`.

- `ExnessPriceProvider` **requires** `EXNESS_API_URL` (+ key if needed). If not set, it throws at `startMonitoring()` with a clear error and does NOT silently fall back.
- For production without Exness credentials, use `PRICE_PROVIDER=polling` with any gold price HTTP endpoint (e.g., `gold-api.com`, TwelveData, Finnhub) and document the discrepancy vs Exness price.
- To add a real Exness WebSocket, implement a new `ExnessWsProvider extends MarketPriceProvider` and swap it in `src/providers/index.ts` — no AlertEngine changes.

Details: `docs/EXNESS_FEED.md`

## API

- `GET /api/health` — uptime, provider, current price, active count
- `GET /api/price` — `{ symbol, price, source }`
- `GET /api/alerts?status=ACTIVE|TRIGGERED|DISABLED|ALL`
- `POST /api/alerts` — `{ target_price, trigger_condition, symbol }`
- `PATCH /api/alerts/:id`
- `POST /api/alerts/:id/enable|disable|reset`
- `DELETE /api/alerts/:id` — soft delete
- `POST /api/telegram/test`

## Testing

```bash
cd backend && npm test
```

18 tests covering: price below, reaches, crosses, moves away, one-time only, disabled/deleted, multiple alerts, restart recovery, Telegram success/failure, feed failure, duplicate prevention, mock provider, message format, reset.

## Deployment (VPS)

See `docs/DEPLOYMENT.md`. TL;DR:

```bash
# On VPS (Ubuntu)
npm install --global pm2
git clone ...
cd xauusd-alert-system/backend && npm install && npm run build
pm2 start ../ecosystem.config.js && pm2 save && pm2 startup
# Health
curl http://localhost:3000/api/health
```

## Timezone

DB stores UTC (ISO). UI and Telegram show `Asia/Kolkata` (IST).

## Known Limitations

- `mock` provider is not a real market price — only for dev/tests.
- `polling` price may lag Exness by seconds and differ by spread; for tight alerts use Exness feed.
- Single VPS instance only; horizontal scaling would need distributed lock for `tryTrigger` (currently SQLite row-level CAS suffices for single instance).
- No auth on API — add reverse-proxy auth (Nginx basic auth / Cloudflare Tunnel) for public VPS.
- Telegram rate limits not queued — failed sends are logged but not retried (alert stays TRIGGERED to avoid duplicates).

## Verification Checklist

- [x] `npm test` passes (18/18)
- [x] `tsc --noEmit` passes (backend + frontend)
- [x] `npm run build` succeeds (both)
- [x] `/api/health` exists
- [x] Telegram test endpoint exists
- [x] Price-cross logic handles inter-poll crossing
- [x] Duplicate prevention via DB `WHERE status='ACTIVE'`
- [x] Restart resumes ACTIVE alerts
- [x] PM2 + Dockerfile + healthcheck included
