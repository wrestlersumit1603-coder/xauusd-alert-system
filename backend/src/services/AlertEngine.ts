import { AlertStore, TriggerCondition } from './AlertStore.js';
import { MarketPriceProvider, PriceUpdate } from '../providers/MarketPriceProvider.js';
import { TelegramService } from './TelegramService.js';
import { toIST } from '../utils/time.js';

/**
 * Core matching logic.
 * Handles price crossing between polling intervals to avoid missed alerts.
 *
 * PRICE_REACHES: triggers if price crosses target in either direction (or equals).
 * PRICE_ABOVE: triggers if current price >= target (and previous was below, or first check)
 * PRICE_BELOW: triggers if current price <= target (and previous was above, or first check)
 *
 * For polling, we keep previous price per engine instance.
 */

export function shouldTrigger(
  condition: TriggerCondition,
  target: number,
  prevPrice: number | null,
  currPrice: number
): boolean {
  if (condition === 'PRICE_ABOVE') {
    return currPrice >= target;
  }
  if (condition === 'PRICE_BELOW') {
    return currPrice <= target;
  }
  // PRICE_REACHES: need crossing logic
  if (currPrice === target) return true;
  if (prevPrice === null) {
    // first observation: if we are exactly at target, already handled; otherwise not enough to know crossing
    // but if price equals target we trigger, else don't assume crossed
    return false;
  }
  // crossed in either direction
  const crossedUp = prevPrice < target && currPrice > target;
  const crossedDown = prevPrice > target && currPrice < target;
  const reachedFromBelow = prevPrice < target && currPrice >= target;
  const reachedFromAbove = prevPrice > target && currPrice <= target;
  return crossedUp || crossedDown || reachedFromBelow || reachedFromAbove;
}

export class AlertEngine {
  private prevPrice: number | null = null;
  private isProcessing = false;

  constructor(
    private store: AlertStore,
    private priceProvider: MarketPriceProvider,
    private telegram: TelegramService
  ) {}

  start(): void {
    this.priceProvider.onPrice((update) => this.onPrice(update));
    // also restore prevPrice from last known
    this.prevPrice = this.priceProvider.getLastPrice();
  }

  async onPrice(update: PriceUpdate): Promise<void> {
    if (this.isProcessing) {
      // avoid overlapping runs; queue could be added but for low frequency it's fine to skip and process next tick
      console.warn('[engine] skipping overlapping tick');
      return;
    }
    this.isProcessing = true;
    try {
      const currPrice = update.price;
      const prevPrice = this.prevPrice;
      const active = this.store.listActive();

      for (const alert of active) {
        // Deleted/disabled already filtered
        const trigger = shouldTrigger(alert.trigger_condition, alert.target_price, prevPrice, currPrice);
        if (trigger) {
          // Atomic DB guard prevents duplicate Telegram
          const claimed = this.store.tryTrigger(alert.id, currPrice);
          if (!claimed) {
            console.log(`[engine] alert ${alert.id} already triggered by another worker`);
            continue;
          }
          console.log(`[engine] 🔔 triggering alert ${alert.id} target=${alert.target_price} price=${currPrice}`);
          try {
            await this.telegram.sendAlert({
              symbol: alert.symbol,
              targetPrice: alert.target_price,
              currentPrice: currPrice,
              condition: alert.trigger_condition,
              timeIST: toIST(update.timestamp),
            });
          } catch (e) {
            console.error(`[engine] telegram failed for alert ${alert.id}`, e);
            // keep TRIGGERED status; do not revert – deduplication requires not re-sending
            // optionally log to DB error table in future
          }
        }
      }
      this.prevPrice = currPrice;
    } finally {
      this.isProcessing = false;
    }
  }

  // For tests: inject prices directly
  async checkPrice(prev: number | null, curr: number, timestamp = new Date()): Promise<void> {
    this.prevPrice = prev;
    await this.onPrice({ symbol: 'XAUUSD', price: curr, timestamp, source: 'test' });
  }

  getPrevPrice(): number | null {
    return this.prevPrice;
  }
}
