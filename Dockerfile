FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm install
COPY backend ./backend
COPY frontend ./frontend
RUN npm run build --workspace=backend
RUN npm run build --workspace=frontend
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "backend/dist/index.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
