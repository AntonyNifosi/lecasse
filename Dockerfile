# --- Build : installe tout et compile le client web ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY . .
RUN npm run build -w client

# --- Runtime : le serveur, le client compilé, et rien d'autre ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
# Le serveur exécute le TypeScript directement via tsx (une dépendance de production), et
# consomme shared/ en TypeScript brut : il n'y a donc pas d'étape de compilation côté serveur.
RUN npm ci --omit=dev && npm cache clean --force

COPY shared/ shared/
COPY server/ server/
COPY --from=build /app/client/dist client/dist

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "-w", "server"]
