# Mobile se Alert lagana — 5 min Free Deploy

Tumhe PC bar-bar nahi kholna, isliye ye setup hai: Backend 24/7 + Frontend PWA + Telegram

## Option A — 100% Free & No Sleep (Recommended: Northflank)

1. GitHub pe repo push karo
2. Northflank.com -> Sign up (card verification, charge nahi) -> Create Service -> GitHub repo select
   - Build: `cd backend && npm install && npm run build`
   - Start: `node backend/dist/index.js`
   - Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `PRICE_PROVIDER=polling`, `POLLING_PRICE_URL=https://xaus.com/api/v1/spot`
   - Disk: 1GB persistent for `backend/data` (taaki alerts save rahe)
   - URL milega: `https://xauusd-alerts-xxx.northflank.app`

3. Vercel.com -> Import GitHub -> `frontend` folder -> Env: `VITE_API_URL=https://xauusd-alerts-xxx.northflank.app`
   - Deploy -> milega: `https://xauusd-alerts.vercel.app` (HTTPS, PWA)

4. iPhone Safari me `https://xauusd-alerts.vercel.app` kholo -> Share -> Add to Home Screen -> App ban gaya.

Ab phone se hi Add Alert kar sakte ho, PC band bhi to Telegram ayega.

## Option B — Oracle Always Free (Forever, thoda setup)

Oracle Cloud free VM (2 OCPU 12GB forever) -> pehle wale docs/DEPLOYMENT.md ke steps. Cheap aur kabhi expire nahi.

## Option C — Instant Test (abhi 2 min me phone pe dekhna)

PC pe:
```bash
npx cloudflared tunnel --url http://localhost:5173
# ya frontend preview: cd frontend && npx vite preview --host --port 5173
# phir cloudflared se expose
```
Jo `https://xxx.trycloudflare.com` link milega, wo Safari me kholo -> Add to Home Screen. PC band hote hi band ho jayega (sirf test ke liye).

---

## Backend CORS already `origin: true` hai, mobile se bhi chalega.

Health check: `https://your-backend.northflank.app/api/health`
