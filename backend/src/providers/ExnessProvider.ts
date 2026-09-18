import { MarketPriceProvider } from './MarketPriceProvider.js';
import { PollingPriceProvider } from './PollingProvider.js';

/**
 * EXNESS XAUUSD Provider
 *
 * IMPORTANT: Exness does NOT expose a public REST/WebSocket price feed for XAUUSD
 * without credentials. This provider is a strict abstraction that REQUIRES:
 *   - EXNESS_API_URL  (WebSocket or REST endpoint provided by Exness)
 *   - EXNESS_API_KEY  (or session token)
 *
 * If neither is configured, the provider will throw on startMonitoring()
 * and log a clear error. It will NOT silently fall back to another price source.
 *
 * Once credentials are supplied, you can replace the internal implementation
 * with a real Exness WebSocket feed without touching the AlertEngine.
 *
 * Current implementation: wraps PollingPriceProvider for REST polling if a URL is given,
 * otherwise refuses to start.
 *
 * To implement WebSocket later, replace `delegate` with a ws client.
 */
export class ExnessPriceProvider extends MarketPriceProvider {
  readonly name = 'exness';
  private delegate: PollingPriceProvider | null = null;
  private apiUrl: string;
  private apiKey: string;
  private intervalMs: number;

  constructor(apiUrl: string, apiKey: string, intervalMs = 5000) {
    super();
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.intervalMs = intervalMs;
    if (apiUrl) {
      this.delegate = new PollingPriceProvider({
        url: apiUrl,
        intervalMs,
        apiKey,
      });
      // forward emitted prices
      this.delegate.onPrice((u) => this.emit(u.price, u.symbol));
    }
  }

  static isConfigured(apiUrl: string, apiKey: string): boolean {
    return Boolean(apiUrl && apiUrl.length > 0);
  }

  async getCurrentPrice(): Promise<number | null> {
    if (!this.delegate) {
      throw new Error(
        'Exness price feed not configured. Set EXNESS_API_URL and EXNESS_API_KEY. See docs/EXNESS_FEED.md'
      );
    }
    return this.delegate.getCurrentPrice();
  }

  startMonitoring(): void {
    if (!this.delegate) {
      const msg =
        '❌ ExnessPriceProvider: EXNESS_API_URL is not set. ' +
        'Exness does not provide a public XAUUSD feed without credentials. ' +
        'Set EXNESS_API_URL and EXNESS_API_KEY in .env or switch PRICE_PROVIDER to "polling" or "mock". ' +
        'See docs/EXNESS_FEED.md for details.';
      console.error(msg);
      throw new Error(msg);
    }
    console.log(`[exness] starting monitoring via ${this.apiUrl}`);
    this.delegate.startMonitoring();
  }

  stopMonitoring(): void {
    this.delegate?.stopMonitoring();
  }

  // expose underlying for health checks
  getConfigStatus(): { configured: boolean; url: string } {
    return { configured: !!this.apiUrl, url: this.apiUrl };
  }
}
