import { randomUUID } from 'crypto';
import type { DatabaseSync } from 'node:sqlite';

export type TriggerCondition = 'PRICE_REACHES' | 'PRICE_ABOVE' | 'PRICE_BELOW';
export type AlertStatus = 'ACTIVE' | 'DISABLED' | 'TRIGGERED' | 'DELETED';

export type Alert = {
  id: string;
  symbol: string;
  target_price: number;
  trigger_condition: TriggerCondition;
  status: AlertStatus;
  created_at: string;
  updated_at: string;
  triggered_at: string | null;
  last_checked_price: number | null;
};

export class AlertStore {
  constructor(private db: DatabaseSync) {}

  create(data: { symbol?: string; target_price: number; trigger_condition: TriggerCondition }): Alert {
    const now = new Date().toISOString();
    const alert: Alert = {
      id: randomUUID(),
      symbol: data.symbol || 'XAUUSD',
      target_price: data.target_price,
      trigger_condition: data.trigger_condition,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
      triggered_at: null,
      last_checked_price: null,
    };
    this.db
      .prepare(
        `INSERT INTO alerts (id, symbol, target_price, trigger_condition, status, created_at, updated_at, triggered_at, last_checked_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        alert.id,
        alert.symbol,
        alert.target_price,
        alert.trigger_condition,
        alert.status,
        alert.created_at,
        alert.updated_at,
        alert.triggered_at,
        alert.last_checked_price
      );
    return alert;
  }

  list(status?: AlertStatus | 'ALL'): Alert[] {
    if (!status || status === 'ALL') {
      return this.db.prepare(`SELECT * FROM alerts WHERE status != 'DELETED' ORDER BY created_at DESC`).all() as Alert[];
    }
    return this.db.prepare(`SELECT * FROM alerts WHERE status = ? ORDER BY created_at DESC`).all(status) as Alert[];
  }

  listActive(): Alert[] {
    return this.db.prepare(`SELECT * FROM alerts WHERE status = 'ACTIVE' ORDER BY target_price ASC`).all() as Alert[];
  }

  getById(id: string): Alert | undefined {
    return this.db.prepare(`SELECT * FROM alerts WHERE id = ?`).get(id) as Alert | undefined;
  }

  update(
    id: string,
    data: Partial<Pick<Alert, 'target_price' | 'trigger_condition' | 'symbol'>>
  ): Alert | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    const symbol = data.symbol ?? existing.symbol;
    const target_price = data.target_price ?? existing.target_price;
    const trigger_condition = data.trigger_condition ?? existing.trigger_condition;
    this.db
      .prepare(`UPDATE alerts SET symbol=?, target_price=?, trigger_condition=?, updated_at=? WHERE id=?`)
      .run(symbol, target_price, trigger_condition, now, id);
    return this.getById(id);
  }

  setStatus(id: string, status: AlertStatus): Alert | undefined {
    const alert = this.getById(id);
    if (!alert) return undefined;
    const now = new Date().toISOString();
    const triggered_at = status === 'TRIGGERED' ? now : status === 'ACTIVE' ? null : alert.triggered_at;
    this.db.prepare(`UPDATE alerts SET status=?, updated_at=?, triggered_at=? WHERE id=?`).run(status, now, triggered_at, id);
    return this.getById(id);
  }

  softDelete(id: string): void {
    this.db.prepare(`UPDATE alerts SET status='DELETED', updated_at=? WHERE id=?`).run(new Date().toISOString(), id);
  }

  hardDelete(id: string): void {
    this.db.prepare(`DELETE FROM alerts WHERE id=?`).run(id);
  }

  tryTrigger(id: string, currentPrice: number): boolean {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`UPDATE alerts SET status='TRIGGERED', triggered_at=?, updated_at=?, last_checked_price=? WHERE id=? AND status='ACTIVE'`)
      .run(now, now, currentPrice, id);
    return (result as any).changes === 1;
  }

  updateLastCheckedPrice(id: string, price: number): void {
    this.db.prepare(`UPDATE alerts SET last_checked_price=?, updated_at=? WHERE id=?`).run(price, new Date().toISOString(), id);
  }
}
