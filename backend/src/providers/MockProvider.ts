import { MarketPriceProvider } from './MarketPriceProvider.js';

export class MockPriceProvider extends MarketPriceProvider {
  readonly name = 'mock';
  private interval: NodeJS.Timeout | null = null;
  private currentPrice: number;
  private intervalMs: number;

  constructor(initialPrice = 3650, intervalMs = 2000) {
    super();
    this.currentPrice = initialPrice;
    this.intervalMs = intervalMs;
  }

  async getCurrentPrice(): Promise<number> {
    return this.currentPrice;
  }

  /** Test helper: manually set/emit a price */
  setPrice(price: number): void {
    this.currentPrice = price;
    this.emit(price);
  }

  /** Test helper: simulate tick without emitting via interval */
  emitPrice(price: number): void {
    this.currentPrice = price;
    this.emit(price);
  }

  startMonitoring(): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      // small random walk if not manually driven
      // keep deterministic for tests when setPrice is used – interval still emits same price
      this.emit(this.currentPrice);
    }, this.intervalMs);
  }

  stopMonitoring(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
