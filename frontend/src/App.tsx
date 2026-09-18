import { useEffect, useState } from 'react';
import TradingViewChart from './TradingViewChart';

type Alert = {
  id: string;
  symbol: string;
  target_price: number;
  trigger_condition: 'PRICE_REACHES' | 'PRICE_ABOVE' | 'PRICE_BELOW';
  status: 'ACTIVE' | 'DISABLED' | 'TRIGGERED' | 'DELETED';
  created_at: string;
  updated_at: string;
  triggered_at: string | null;
};

const API = (import.meta as any).env?.VITE_API_URL || '';

function formatIST(iso: string | null): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso)) + ' IST';
}

function conditionLabel(c: string): string {
  if (c === 'PRICE_ABOVE') return 'Price Above';
  if (c === 'PRICE_BELOW') return 'Price Below';
  return 'Price Reaches';
}

export default function App() {
  const [price, setPrice] = useState<number | null>(null);
  const [source, setSource] = useState<string>('-');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Alert | null>(null);
  const [target, setTarget] = useState('');
  const [condition, setCondition] = useState<'PRICE_REACHES' | 'PRICE_ABOVE' | 'PRICE_BELOW'>('PRICE_REACHES');
  const [toast, setToast] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const fetchPrice = async () => {
    try {
      const r = await fetch(`${API}/api/price`);
      const j = await r.json();
      setPrice(j.price);
      setSource(j.source);
    } catch {}
  };

  const fetchAlerts = async () => {
    try {
      const r = await fetch(`${API}/api/alerts`);
      const j = await r.json();
      setAlerts(j);
    } catch {}
  };

  const fetchHealth = async () => {
    try {
      const r = await fetch(`${API}/api/health`);
      setHealth(await r.json());
    } catch {}
  };

  useEffect(() => {
    fetchPrice();
    fetchAlerts();
    fetchHealth();
    const id = setInterval(() => { fetchPrice(); fetchHealth(); }, 5000);
    const id2 = setInterval(fetchAlerts, 5000);
    return () => { clearInterval(id); clearInterval(id2); };
  }, []);

  const handleAdd = async () => {
    const tp = parseFloat(target);
    if (!tp || tp <= 0) { showToast('Enter valid price'); return; }
    const body: any = { target_price: tp, trigger_condition: condition, symbol: 'XAUUSD' };
    let url = `${API}/api/alerts`;
    let method = 'POST';
    if (editing) {
      url = `${API}/api/alerts/${editing.id}`;
      method = 'PATCH';
    }
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      setShowAdd(false); setEditing(null); setTarget(''); setCondition('PRICE_REACHES');
      showToast(editing ? 'Alert updated' : 'Alert added');
      fetchAlerts();
    } else {
      showToast('Failed to save');
    }
  };

  const action = async (id: string, act: string) => {
    let url = '';
    let method: string = 'POST';
    if (act === 'disable') url = `${API}/api/alerts/${id}/disable`;
    if (act === 'enable') url = `${API}/api/alerts/${id}/enable`;
    if (act === 'reset') url = `${API}/api/alerts/${id}/reset`;
    if (act === 'delete') { url = `${API}/api/alerts/${id}`; method = 'DELETE'; }
    const r = await fetch(url, { method });
    if (r.ok) { showToast(act + ' ok'); fetchAlerts(); } else { const j = await r.json().catch(()=>({})); showToast(j.error || 'Failed'); }
  };

  const testTelegram = async () => {
    const r = await fetch(`${API}/api/telegram/test`, { method: 'POST' });
    const j = await r.json();
    showToast(r.ok ? '✅ Test sent to Telegram' : `❌ ${j.error}`);
  };

  const openEdit = (a: Alert) => {
    setEditing(a);
    setTarget(String(a.target_price));
    setCondition(a.trigger_condition);
    setShowAdd(true);
  };

  const active = alerts.filter(a => a.status === 'ACTIVE' || a.status === 'DISABLED');
  const triggered = alerts.filter(a => a.status === 'TRIGGERED');

  return (
    <div className="container">
      <div className="header">
        <h1><span>XAUUSD</span> Price Alerts</h1>
        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>Cloud monitoring • Telegram alerts • iPhone friendly</div>
      </div>

      <div className="price-card">
        <div className="price-label">XAUUSD — Current Price</div>
        <div className="price-value">{price !== null ? price.toFixed(2) : '—'}</div>
        <div className="price-source">Source: {source} • {health ? `${health.activeAlerts ?? 0} active alerts` : ''}</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setTarget(price ? String(price.toFixed(2)) : ''); setShowAdd(true); }}>+ Add Alert</button>
        </div>
        <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={testTelegram}>📨 Test Telegram</button>
      </div>

      <TradingViewChart />

      <div className="section-title">Active Alerts ({active.length})</div>
      {active.length === 0 ? <div className="empty">No active alerts. Tap Add Alert.</div> : active.map(a => (
        <div key={a.id} className="card">
          <div className="card-row">
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{a.target_price.toFixed(2)}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{conditionLabel(a.trigger_condition)}</div>
            </div>
            <span className={`badge ${a.status === 'ACTIVE' ? 'badge-active' : 'badge-disabled'}`}>
              {a.status === 'ACTIVE' ? '🟢 Active' : '🟡 Disabled'}</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6 }}>Created: {formatIST(a.created_at)}</div>
          <div className="actions">
            <button className="btn btn-sm btn-ghost" onClick={() => openEdit(a)}>Edit</button>
            {a.status === 'ACTIVE'
              ? <button className="btn btn-sm btn-outline" onClick={() => action(a.id, 'disable')}>Disable</button>
              : <button className="btn btn-sm btn-outline" onClick={() => action(a.id, 'enable')}>Enable</button>}
            <button className="btn btn-sm btn-danger" onClick={() => action(a.id, 'delete')}>Delete</button>
          </div>
        </div>
      ))}

      <div className="section-title">Triggered Alerts ({triggered.length})</div>
      {triggered.length === 0 ? <div className="empty">No triggered alerts yet.</div> : triggered.map(a => (
        <div key={a.id} className="card" style={{ opacity: 0.9 }}>
          <div className="card-row">
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{a.target_price.toFixed(2)}</div>
            <span className="badge badge-triggered">Triggered</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{conditionLabel(a.trigger_condition)}</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6 }}>{formatIST(a.triggered_at)}</div>
          <div className="actions">
            <button className="btn btn-sm btn-outline" onClick={() => action(a.id, 'reset')}>Reset / Reactivate</button>
            <button className="btn btn-sm btn-danger" onClick={() => action(a.id, 'delete')}>Delete</button>
          </div>
        </div>
      ))}

      <div className="health">
        Health: {health ? `${health.status} • provider=${health.priceProvider} • price=${health.currentPrice ?? 'n/a'}` : 'loading...'}<br />
        Telegram: {health?.telegramConfigured ? '✅ configured' : '⚠️ not configured (set env)'}<br />
        Timestamps in IST (Asia/Kolkata) • Backend monitors 24/7 even when browser is closed
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => { setShowAdd(false); setEditing(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12 }}>{editing ? 'Edit Alert' : 'Add XAUUSD Alert'}</h3>
            <div className="form-grid">
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Target Price (USD)</label>
              <input className="input" type="number" step="0.01" placeholder="3650.00" value={target} onChange={e => setTarget(e.target.value)} />
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Condition</label>
              <select className="select" value={condition} onChange={e => setCondition(e.target.value as any)}>
                <option value="PRICE_REACHES">Price Reaches / Crosses</option>
                <option value="PRICE_ABOVE">Price Above (≥)</option>
                <option value="PRICE_BELOW">Price Below (≤)</option>
              </select>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowAdd(false); setEditing(null); }}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdd}>{editing ? 'Save' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
