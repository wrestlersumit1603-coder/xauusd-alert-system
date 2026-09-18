import { MarketPriceProvider } from './MarketPriceProvider.js';

export type PollingOptions = {
  url: string;
  intervalMs: number;
  apiKey?: string;
  parser?: (json: any) => number | null;
};

function defaultParser(json: any): number | null {
  // xaus.com: { spot_usd_oz: 4007.20, xau: { price: 4007.20 } }
  if (typeof json.spot_usd_oz === 'number') return json.spot_usd_oz;
  if (typeof json.xau?.price === 'number') return json.xau.price;
  if (typeof json.price === 'number') return json.price;
  if (typeof json.XAUUSD === 'number') return json.XAUUSD;
  if (typeof json.xauPrice === 'number') return json.xauPrice;
  if (json.data?.price) return Number(json.data.price);
  // chartgoldprice: { prices: { gold: { troy_ounce: 4395 } } }
  if (typeof json.prices?.gold?.troy_ounce === 'number') return json.prices.gold.troy_ounce;
  if (json.price) return Number(json.price);
  // gold-api.com format: { price: 2650.12 }
  if (json.gold?.price) return Number(json.gold.price);
  return null;
}

export class PollingPriceProvider extends MarketPriceProvider {
  readonly name = 'polling';
  private timer: NodeJS.Timeout | null = null;
  private opts: PollingOptions;
  private consecutiveErrors = 0;

  constructor(opts: PollingOptions) {
    super();
    this.opts = opts;
  }

  async getCurrentPrice(): Promise<number | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.opts.apiKey) headers['Authorization'] = `Bearer ${this.opts.apiKey}`;
      const res = await fetch(this.opts.url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const price = (this.opts.parser || defaultParser)(json);
      if (price !== null && !isNaN(price)) {
        this.lastPrice = price;
        return price;
      }
      throw new Error('parser returned null');
    } catch (e) {
      console.error('[polling] fetch error', e);
      return null;
    }
  }

  startMonitoring(): void {
    if (this.timer) return;
    const tick = async () => {
      const price = await this.getCurrentPrice();
      if (price !== null) {
        this.consecutiveErrors = 0;
        this.emit(price);
      } else {
        this.consecutiveErrors++;
        console.warn(`[polling] failed to fetch price (${this.consecutiveErrors} consecutive)`);
      }
    };
    // immediate then interval
    tick();
    this.timer = setInterval(tick, this.opts.intervalMs);
  }

  stopMonitoring(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
