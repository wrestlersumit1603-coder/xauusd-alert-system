export type PriceUpdate = {
  symbol: string;
  price: number;
  timestamp: Date;
  source: string;
};

export type PriceListener = (update: PriceUpdate) => void;

/**
 * Abstraction for all XAUUSD price feeds.
 * Implementations: Exness, Mock, Polling HTTP.
 */
export abstract class MarketPriceProvider {
  abstract readonly name: string;
  protected listeners: Set<PriceListener> = new Set();
  protected lastPrice: number | null = null;

  abstract getCurrentPrice(): Promise<number | null>;
  abstract startMonitoring(): Promise<void> | void;
  abstract stopMonitoring(): Promise<void> | void;

  onPrice(listener: PriceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected emit(price: number, symbol = 'XAUUSD'): void {
    this.lastPrice = price;
    const update: PriceUpdate = {
      symbol,
      price,
      timestamp: new Date(),
      source: this.name,
    };
    for (const l of this.listeners) {
      try {
        l(update);
      } catch (e) {
        console.error(`[${this.name}] listener error`, e);
      }
    }
  }

  getLastPrice(): number | null {
    return this.lastPrice;
  }
}
