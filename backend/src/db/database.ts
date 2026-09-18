import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

// Wrapper to keep similar API to better-sqlite3 for minimal AlertStore changes
export type DbType = DatabaseSync;

let db: DatabaseSync | null = null;

export function getDb(dbPath = config.databasePath): DatabaseSync {
  if (db) return db;
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  db = new DatabaseSync(dbPath);
  // Enable WAL and FK
  try {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  } catch {}
  migrate(db);
  return db;
}

export function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL DEFAULT 'XAUUSD',
      target_price REAL NOT NULL,
      trigger_condition TEXT NOT NULL CHECK(trigger_condition IN ('PRICE_REACHES','PRICE_ABOVE','PRICE_BELOW')),
      status TEXT NOT NULL CHECK(status IN ('ACTIVE','DISABLED','TRIGGERED','DELETED')) DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      triggered_at TEXT,
      last_checked_price REAL
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_symbol_status ON alerts(symbol, status);
  `);
}

// For tests: create in-memory db
export function createMemoryDb(): DatabaseSync {
  const mem = new DatabaseSync(':memory:');
  migrate(mem);
  return mem;
}

export function closeDb(): void {
  if (db) {
    try { db.close(); } catch {}
    db = null;
  }
}
