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
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: isProduction ? undefined : { origin: '*' },
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
