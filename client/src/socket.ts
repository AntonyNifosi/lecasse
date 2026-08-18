import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@thegang/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const options: Partial<ManagerOptions & SocketOptions> = {
  autoConnect: false,
  transports: ['websocket', 'polling'],
};

/** Where the game server lives. Empty in a browser, where the server also serves this page
 * and same-origin is exactly right; baked in at build time for the Android build, whose
 * pages come from the APK itself and so have no server to be same-origin with (see
 * VITE_SERVER_URL in client/.env.example). */
const serverUrl = import.meta.env.VITE_SERVER_URL?.trim();

export const socket: AppSocket = serverUrl ? io(serverUrl, options) : io(options);
