import { useEffect, useState } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

const SYMBOLS = [
  { label: 'OANDA:XAUUSD (default, free)', value: 'OANDA:XAUUSD' },
  { label: 'FXCM:XAUUSD', value: 'FXCM:XAUUSD' },
  { label: 'FOREXCOM:XAUUSD', value: 'FOREXCOM:XAUUSD' },
  { label: 'TVC:GOLD (spot)', value: 'TVC:GOLD' },
  { label: 'PEPPERSTONE:XAUUSD', value: 'PEPPERSTONE:XAUUSD' },
] as const;

export default function TradingViewChart() {
  const [symbol, setSymbol] = useState<string>('OANDA:XAUUSD');

  useEffect(() => {
    const scriptId = 'tradingview-widget-script';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    const createWidget = () => {
      if ((window as any).TradingView && document.getElementById('tradingview_chart')) {
        // clear previous
        const container = document.getElementById('tradingview_chart');
        if (container) container.innerHTML = '';
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: '60',
          timezone: 'Asia/Kolkata',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#1e293b',
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: 'tradingview_chart',
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          backgroundColor: '#0f172a',
        });
      }
    };

    if (!existing) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = createWidget;
      document.body.appendChild(script);
    } else {
      createWidget();
    }
  }, [symbol]);

  return (
    <div style={{ margin: '16px 0' }}>
      <div className="card-row" style={{ marginBottom: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>Live Chart — TradingView (Free)</div>
        <select
          className="select"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{ width: 'auto', fontSize: '0.8rem', padding: '6px 8px' }}
        >
          {SYMBOLS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <div
        id="tradingview_chart"
        style={{ height: '420px', borderRadius: 12, overflow: 'hidden', border: '1px solid #334155', background: '#0f172a' }}
      />
      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6, textAlign: 'center' }}>
        Chart: TradingView {symbol} (free embed) • Alerts still use your backend price provider. Price may differ by few cents.
      </div>
    </div>
  );
}
