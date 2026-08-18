import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '@thegang/shared';
import express from 'express';
import { Server } from 'socket.io';
import { sweepIdleRooms } from './game/rooms';
import { registerSocketHandlers } from './socket/handlers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

/** Origins allowed to open a socket, comma-separated. Left empty, any origin is reflected.
 * That's deliberate rather than lax: the Android app's pages come from the APK (origin
 * `https://localhost`) and the dev client from Vite's port, so cross-origin is the normal
 * case here, and there is nothing origin-scoped to protect — no cookies, no browser-implicit
 * credentials, and a room is only ever as private as its 4-letter code. Set it when the
 * server has one known public address and you'd rather pin it. */
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: { origin: corsOrigins.length > 0 ? corsOrigins : true },
});

// Before the static/catch-all routes below, which would otherwise answer with index.html.
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

const clientDist = path.resolve(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.send('Serveur "Le Casse" en ligne. (client non buildé — lancez le serveur de dev du client séparément)');
  });
}

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket);
});

setInterval(sweepIdleRooms, 5 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  console.log(`Serveur "Le Casse" en écoute sur http://localhost:${PORT}`);
});
