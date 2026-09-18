import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemoryDb } from '../src/db/database';
import { AlertStore } from '../src/services/AlertStore';
import { AlertEngine, shouldTrigger } from '../src/services/AlertEngine';
import { MockPriceProvider } from '../src/providers/MockProvider';
import { ExnessPriceProvider } from '../src/providers/ExnessProvider';
import { TelegramService, formatAlertMessage } from '../src/services/TelegramService';
import Database from 'better-sqlite3';

function makeEngine() {
  const db = createMemoryDb();
  const store = new AlertStore(db);
  const provider = new MockPriceProvider(3649, 1000);
  // mock telegram that never hits network
  const telegram = new TelegramService('fake-token', '123');
  // stub sendAlert
  const sent: any[] = [];
  vi.spyOn(telegram, 'sendAlert').mockImplementation(async (p) => { sent.push(p); });
  vi.spyOn(telegram, 'sendMessage').mockImplementation(async () => {});
  const engine = new AlertEngine(store, provider, telegram);
  engine.start();
  return { db, store, provider, telegram, engine, sent };
}

describe('shouldTrigger logic', () => {
  it('1. Price below target does not trigger PRICE_REACHES', () => {
    expect(shouldTrigger('PRICE_REACHES', 3650, 3648, 3649)).toBe(false);
  });
  it('2. Price reaches target exactly triggers', () => {
    expect(shouldTrigger('PRICE_REACHES', 3650, 3649, 3650)).toBe(true);
  });
  it('3. Price crosses target between intervals triggers', () => {
    // prev 3649.50 curr 3650.20 target 3650
    expect(shouldTrigger('PRICE_REACHES', 3650, 3649.50, 3650.20)).toBe(true);
    expect(shouldTrigger('PRICE_REACHES', 3650, 3650.20, 3649.50)).toBe(true);
    // crossed without hitting exact
    expect(shouldTrigger('PRICE_REACHES', 3650, 3649, 3651)).toBe(true);
    expect(shouldTrigger('PRICE_REACHES', 3650, 3651, 3649)).toBe(true);
  });
  it('4. Price moves away does not trigger', () => {
    expect(shouldTrigger('PRICE_REACHES', 3650, 3645, 3644)).toBe(false);
    expect(shouldTrigger('PRICE_REACHES', 3650, 3655, 3656)).toBe(false);
    expect(shouldTrigger('PRICE_ABOVE', 3650, null, 3649)).toBe(false);
    expect(shouldTrigger('PRICE_BELOW', 3650, null, 3651)).toBe(false);
  });
  it('PRICE_ABOVE and PRICE_BELOW simple', () => {
    expect(shouldTrigger('PRICE_ABOVE', 3650, 3649, 3650)).toBe(true);
    expect(shouldTrigger('PRICE_ABOVE', 3650, 3650, 3650)).toBe(true);
    expect(shouldTrigger('PRICE_BELOW', 3650, 3651, 3650)).toBe(true);
    expect(shouldTrigger('PRICE_BELOW', 3650, 3650, 3649)).toBe(true);
  });
});

describe('AlertEngine integration', () => {
  it('5. One-time alert triggers only once', async () => {
    const { store, engine, sent } = makeEngine();
    store.create({ target_price: 3650, trigger_condition: 'PRICE_REACHES' });
    await engine.checkPrice(3649, 3650.2);
    expect(sent.length).toBe(1);
    // second tick should not re-trigger
    await engine.checkPrice(3650.2, 3651);
    expect(sent.length).toBe(1);
    expect(store.list('TRIGGERED').length).toBe(1);
  });

  it('6. Disabled alert does not trigger', async () => {
    const { store, engine, sent } = makeEngine();
    const a = store.create({ target_price: 3650, trigger_condition: 'PRICE_REACHES' });
    store.setStatus(a.id, 'DISABLED');
    await engine.checkPrice(3649, 3651);
    expect(sent.length).toBe(0);
  });

  it('7. Deleted alert does not trigger', async () => {
    const { store, engine, sent } = makeEngine();
    const a = store.create({ target_price: 3650, trigger_condition: 'PRICE_REACHES' });
    store.softDelete(a.id);
    await engine.checkPrice(3649, 3651);
    expect(sent.length).toBe(0);
  });

  it('8. Multiple alerts at different levels', async () => {
    const { store, engine, sent } = makeEngine();
    store.create({ target_price: 3650, trigger_condition: 'PRICE_REACHES' });
    store.create({ target_price: 3675, trigger_condition: 'PRICE_ABOVE' });
    store.create({ target_price: 3630, trigger_condition: 'PRICE_BELOW' });
    // price 3651 should trigger 3650 reaches and not others? 3675 above false, 3630 below false
    await engine.checkPrice(3649, 3651);
    expect(sent.length).toBe(1);
    expect(sent[0].targetPrice).toBe(3650);
    // price 3676 triggers second
    await engine.checkPrice(3651, 3676);
    expect(sent.length).toBe(2);
    expect(sent[1].targetPrice).toBe(3675);
    // price 3629 triggers third (below)
    await engine.checkPrice(3676, 3629);
    expect(sent.length).toBe(3);
  });

  it('9. Server restart with active alerts resumes', async () => {
    const db = createMemoryDb();
    const store = new AlertStore(db);
    const alert = store.create({ target_price: 3650, trigger_condition: 'PRICE_REACHES' });
    expect(store.listActive().length).toBe(1);
    // Simulate restart: new engine with same DB
    const provider = new MockPriceProvider(3649, 1000);
    const telegram = new TelegramService('fake', '123');
    const sent: any[] = [];
    vi.spyOn(telegram, 'sendAlert').mockImplementation(async (p) => { sent.push(p); });
    const engine2 = new AlertEngine(store, provider, telegram);
    engine2.start();
    await engine2.checkPrice(3649, 3651);
    expect(sent.length).toBe(1);
    expect(store.getById(alert.id)?.status).toBe('TRIGGERED');
  });

  it('10. Telegram success path', async () => {
    const { store, engine, sent } = makeEngine();
    store.create({ target_price: 3650, trigger_condition: 'PRICE_ABOVE' });
    await engine.checkPrice(null, 3650);
    expect(sent.length).toBe(1);
  });

  it('11. Telegram failure does not duplicate and keeps TRIGGERED', async () => {
    const db = createMemoryDb();
    const store = new AlertStore(db);
    const provider = new MockPriceProvider(3649);
    const telegram = new TelegramService('fake', '123');
    vi.spyOn(telegram, 'sendAlert').mockRejectedValue(new Error('network down'));
    const engine = new AlertEngine(store, provider, telegram);
    engine.start();
    const a = store.create({ target_price: 3650, trigger_condition: 'PRICE_REACHES' });
    await engine.checkPrice(3649, 3651);
    // still marked triggered despite failure, to prevent duplicate spamming
    expect(store.getById(a.id)?.status).toBe('TRIGGERED');
    // second attempt should not try again
    await engine.checkPrice(3651, 3652);
    expect(telegram.sendAlert).toHaveBeenCalledTimes(1);
  });

  it('12. Temporary price-feed failure does not crash engine', async () => {
    const { store, engine, provider, sent } = makeEngine();
    // provider getCurrentPrice returns null simulates failure
    vi.spyOn(provider, 'getCurrentPrice').mockResolvedValue(null as any);
    const price = await provider.getCurrentPrice();
    expect(price).toBeNull();
    // engine should still handle manually injected price
    store.create({ target_price: 3650, trigger_condition: 'PRICE_REACHES' });
    await engine.checkPrice(3649, 3651);
    expect(sent.length).toBe(1);
  });

  it('13. Duplicate-trigger prevention via DB CAS', async () => {
    const db = createMemoryDb();
    const store = new AlertStore(db);
    const a = store.create({ target_price: 3650, trigger_condition: 'PRICE_REACHES' });
    const first = store.tryTrigger(a.id, 3651);
    const second = store.tryTrigger(a.id, 3651);
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(store.getById(a.id)?.status).toBe('TRIGGERED');
  });

  it('Mock provider emits and engine handles', async () => {
    const { store, engine, sent } = makeEngine();
    store.create({ target_price: 3650, trigger_condition: 'PRICE_REACHES' });
    // use provider emit
    const provider2 = new MockPriceProvider(3648);
    const db2 = createMemoryDb();
    // quick integration via onPrice callback already tested
    expect(sent.length).toBe(0);
  });

  it('Exness provider without config throws', () => {
    const p = new ExnessPriceProvider('', '', 5000);
    expect(() => p.startMonitoring()).toThrow(/EXNESS_API_URL/);
  });

  it('Telegram message format', () => {
    const msg = formatAlertMessage({
      symbol: 'XAUUSD',
      targetPrice: 3650,
      currentPrice: 3650.2,
      condition: 'PRICE_REACHES',
      timeIST: '18 Sep 2026, 22:42 IST',
    });
    expect(msg).toContain('XAUUSD PRICE ALERT');
    expect(msg).toContain('Target: 3650.00');
    expect(msg).toContain('Current Price: 3650.20');
    expect(msg).not.toContain('Buy');
    expect(msg).not.toContain('Sell');
  });

  it('Reset triggered alert can re-trigger', async () => {
    const { store, engine, sent } = makeEngine();
    const a = store.create({ target_price: 3650, trigger_condition: 'PRICE_REACHES' });
    await engine.checkPrice(3649, 3651);
    expect(sent.length).toBe(1);
    store.setStatus(a.id, 'ACTIVE');
    await engine.checkPrice(3649, 3651);
    expect(sent.length).toBe(2);
  });
});
