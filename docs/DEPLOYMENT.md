# Deployment — Low-Cost VPS

Goal: backend monitors 24/7 even when user's PC/iPhone/browser is closed.

## Option 1 — PM2 on Ubuntu VPS (Recommended, cheapest)

Cost: ~$5/mo (Hetzner CX11, DigitalOcean Basic, Lightsail).

### 1. Provision

Ubuntu 22.04/24.04, open ports 22, 80, 443. No need to expose 3000 publicly if using reverse proxy.

### 2. Install

```bash
sudo apt update && sudo apt install -y nodejs npm git nginx
sudo npm i -g pm2
node -v # needs >= 22 (for node:sqlite)
# If too old: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
```

### 3. Deploy

```bash
git clone <your-repo> ~/xauusd-alert-system
cd ~/xauusd-alert-system/backend
npm install --omit=dev
npm run build
mkdir -p data logs
cp ../.env.example .env  # edit
nano .env  # set TELEGRAM_*, PRICE_PROVIDER, etc.
```

### 4. Start with PM2

```bash
cd ~/xauusd-alert-system
pm2 start ecosystem.config.js
pm2 logs --lines 50
pm2 save
pm2 startup  # run the command it prints (sudo env PATH=... pm2 startup systemd ...)
# Verify
curl http://localhost:3000/api/health
curl http://localhost:3000/api/price
curl -X POST http://localhost:3000/api/telegram/test
```

Auto-restart after crash/reboot is now handled by PM2.

### 5. Reverse Proxy (Nginx)

```nginx
# /etc/nginx/sites-available/xauusd
server {
  listen 80;
  server_name your-domain.com;
  location /api/ { proxy_pass http://127.0.0.1:3000; }
  location / { root /home/ubuntu/xauusd-alert-system/frontend/dist; try_files $uri /index.html; }
}
```

```bash
cd ~/xauusd-alert-system/frontend && npm install && npm run build
sudo ln -s /etc/nginx/sites-available/xauusd /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# Optional TLS: sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx
```

### 6. Logging

- PM2 logs: `~/xauusd-alert-system/backend/logs/{out,err}.log`
- App logs via Fastify logger to stdout (captured by PM2).
- Price errors: `[polling] fetch error ...` and `[polling] failed to fetch price`
- Telegram errors: `[telegram] send failed ...` + `[engine] telegram failed for alert ...`

View: `pm2 logs` or `tail -f backend/logs/err.log`

### 7. Health Monitoring

```bash
curl http://localhost:3000/api/health
# { status: "ok", priceProvider: "polling", currentPrice: 3650.12, activeAlerts: 3 }
```

Set up UptimeRobot / Hetrix to poll `https://your-domain.com/api/health` every 5 min.

---

## Option 2 — Docker

```bash
docker build -t xauusd-alert .
docker run -d --restart unless-stopped -p 3000:3000 --env-file .env -v $(pwd)/data:/app/backend/data --name xauusd xauusd-alert
docker logs -f xauusd
```

With compose:

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports: ["3000:3000"]
    env_file: .env
    volumes: ["./data:/app/backend/data"]
```

---

## Option 3 — Systemd (alternative to PM2)

```ini
# /etc/systemd/system/xauusd.service
[Unit]
Description=XAUUSD Alert Backend
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/xauusd-alert-system/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=3
EnvironmentFile=/home/ubuntu/xauusd-alert-system/backend/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now xauusd && journalctl -u xauusd -f
```

---

## Production Checklist

- [ ] `.env` set with real `TELEGRAM_BOT_TOKEN`/`CHAT_ID`
- [ ] `PRICE_PROVIDER` set to `polling` or `exness` (not `mock` for prod)
- [ ] `npm run build` succeeds
- [ ] `curl /api/health` returns `status: ok` and `currentPrice` non-null
- [ ] `curl -X POST /api/telegram/test` delivers message
- [ ] Create one test alert, verify Telegram fires
- [ ] `pm2 save` + `pm2 startup` done
- [ ] Frontend `frontend/dist` built and served
- [ ] Uptime monitor on `/api/health`
- [ ] Reboot test: `sudo reboot` → after ~30s `pm2 ls` shows `online`

## Recovery After VPS Reboot

- PM2 restores process automatically.
- SQLite DB at `backend/data/alerts.db` persists.
- On boot, backend logs `resuming N active alerts` and resumes monitoring.

## Updating

```bash
cd ~/xauusd-alert-system
git pull
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
pm2 restart xauusd-alert-backend
```
