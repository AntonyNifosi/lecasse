FROM node:22-alpine
WORKDIR /app

COPY . .
RUN npm ci
RUN npm run build -w client

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "run", "start", "-w", "server"]
