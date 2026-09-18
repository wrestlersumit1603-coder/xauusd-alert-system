# Exness Price Feed Requirement

## Summary

**There is no public Exness XAUUSD price API without credentials.** This system does NOT silently substitute another source. It fails fast and tells you what to configure.

## Provider Abstraction

```ts
abstract class MarketPriceProvider {
  abstract getCurrentPrice(): Promise<number | null>
  abstract startMonitoring(): void
  abstract stopMonitoring(): void
  onPrice(listener): () => void
}
```

Swap providers in `backend/src/providers/index.ts` or via `PRICE_PROVIDER` env.

| Provider | Env `PRICE_PROVIDER` | Requires | Notes |
|----------|----------------------|----------|-------|
| `MockProvider` | `mock` | nothing | Random walk / manual `setPrice()` — dev & tests only |
| `PollingProvider` | `polling` | `POLLING_PRICE_URL` | HTTP GET poll, parse price from JSON |
| `ExnessProvider` | `exness` | `EXNESS_API_URL` + `EXNESS_API_KEY` (if needed) | Wraps polling for REST; extend for WebSocket |

## Exness — What You Need

Exness price data is available via:

1. **Exness Web API / Partner API** — requires a live Exness account + API approval. Endpoint & credentials are provided by Exness account manager. Example (illustrative, may vary):
   ```
   EXNESS_API_URL=wss://api.exness.com/ws/prices
   EXNESS_API_KEY=...
   ```
2. **MT4/MT5 bridge** — some users bridge MT5 `XAUUSD` quotes via a custom EA → WebSocket/HTTP push to this backend. In that case set `EXNESS_API_URL` to your bridge URL.

If you have either, set:

```
PRICE_PROVIDER=exness
EXNESS_API_URL=https://your-exness-endpoint/prices/XAUUSD
EXNESS_API_KEY=...
PRICE_POLL_INTERVAL_MS=2000
```

The `ExnessProvider` will poll that URL with `Authorization: Bearer <key>` and emit `price` extracted via `defaultParser` (looks for `price`, `XAUUSD`, `data.price`). Override parser in code if your JSON differs.

### Fail-Fast Behavior

If `EXNESS_API_URL` is empty and `PRICE_PROVIDER=exness`:

```
❌ ExnessPriceProvider: EXNESS_API_URL is not set.
Exness does not provide a public XAUUSD feed without credentials.
Set EXNESS_API_URL and EXNESS_API_KEY in .env or switch PRICE_PROVIDER to "polling" or "mock".
```

The process logs this and does NOT start price monitoring. `/api/health` still works so you can diagnose via `priceProvider=exness` + `currentPrice=null`.

## Using Polling as Fallback (Without Exness)

If you don't have Exness access:

```
PRICE_PROVIDER=polling
POLLING_PRICE_URL=https://api.gold-api.com/price/XAU
# or TwelveData: https://api.twelvedata.com/price?symbol=XAU/USD&apikey=...
# or Finnhub: https://finnhub.io/api/v1/quote?symbol=OANDA:XAU_USD&token=...
PRICE_POLL_INTERVAL_MS=5000
```

**Warning:** Non-Exness feeds will differ from Exness by spread/aggregator. Alerts may trigger a few seconds early/late or at slightly different prices. For production, note this in your trading workflow.

## Implementing a Real Exness WebSocket

Create `backend/src/providers/ExnessWsProvider.ts`:

```ts
import { MarketPriceProvider } from './MarketPriceProvider';
import WebSocket from 'ws';
export class ExnessWsProvider extends MarketPriceProvider {
  readonly name = 'exness-ws';
  private ws: WebSocket | null = null;
  async getCurrentPrice() { return this.getLastPrice(); }
  startMonitoring() {
    this.ws = new WebSocket(process.env.EXNESS_API_URL!, { headers: { Authorization: process.env.EXNESS_API_KEY! }});
    this.ws.on('message', (data) => {
      const json = JSON.parse(data.toString());
      // json example: { symbol: 'XAUUSD', bid: 3650.12, ask: 3650.34 }
      this.emit(json.bid); // or mid
    });
    this.ws.on('close', () => setTimeout(() => this.startMonitoring(), 5000));
  }
  stopMonitoring() { this.ws?.close(); }
}
```

Then in `src/providers/index.ts`:

```ts
case 'exness': return new ExnessWsProvider();
```

No changes to `AlertEngine` needed.

## Verification

```bash
curl http://localhost:3000/api/price
# { symbol: "XAUUSD", price: 3650.21, source: "exness"|"polling"|"mock" }

curl http://localhost:3000/api/health
# check priceProvider and currentPrice
```
