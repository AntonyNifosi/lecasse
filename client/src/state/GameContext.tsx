import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Card, PlayerPrivate, RoomPublicState } from '@thegang/shared';
import { rejoinRoom } from '../actions';
import { clearSession, loadSession } from '../session';
import { socket } from '../socket';

export interface Notification {
  id: string;
  message: string;
  card?: Card;
  aboutPlayerId?: string;
}

export interface GameState {
  connection: 'idle' | 'connecting' | 'connected' | 'disconnected';
  room: RoomPublicState | null;
  myPlayerId: string | null;
  myHoleCards: Card[];
  lastError: { code: string; message: string } | null;
  notifications: Notification[];
}

type Action =
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED' }
  | { type: 'SET_IDENTITY'; playerId: string }
  | { type: 'ROOM_STATE'; room: RoomPublicState }
  | { type: 'PRIVATE_STATE'; data: PlayerPrivate }
  | { type: 'NOTIFY'; notification: Notification }
  | { type: 'DISMISS_NOTIFICATION'; id: string }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'LEFT_ROOM' };

const initialState: GameState = {
  connection: 'idle',
  room: null,
  myPlayerId: null,
  myHoleCards: [],
  lastError: null,
  notifications: [],
};

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, connection: 'connected' };
    case 'DISCONNECTED':
      return { ...state, connection: 'disconnected' };
    case 'SET_IDENTITY':
      return { ...state, myPlayerId: action.playerId };
    case 'ROOM_STATE':
      return { ...state, room: action.room };
    case 'PRIVATE_STATE':
      return { ...state, myHoleCards: action.data.holeCards };
    case 'NOTIFY':
      return { ...state, notifications: [...state.notifications, action.notification] };
    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter((n) => n.id !== action.id) };
    case 'ERROR':
      return { ...state, lastError: { code: action.code, message: action.message } };
    case 'CLEAR_ERROR':
      return { ...state, lastError: null };
    case 'LEFT_ROOM':
      return { ...initialState, connection: state.connection };
    default:
      return state;
  }
}

const StateContext = createContext<GameState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    // socket.io-client reconnects automatically after a transient drop (screen lock,
    // background tab throttling, brief wifi/cellular handoff — all routine on mobile),
    // but that transport-level reconnect doesn't by itself re-run the app's room:rejoin
    // handshake. Without redoing it here, the socket comes back with a fresh id that the
    // server has never associated with a player, so this client would look "connected"
    // locally while being invisible to the room. The very first connect is already
    // handled by the mount-time rejoin in App.tsx's Router, so this only re-fires it on
    // the second and later connects.
    let hasConnectedBefore = false;
    const onConnect = () => {
      dispatch({ type: 'CONNECTED' });
      if (hasConnectedBefore) {
        const session = loadSession();
        if (session) {
          rejoinRoom(session.roomCode, session.playerId, session.secretToken).then((res) => {
            if (!res.ok) {
              clearSession();
              dispatch({ type: 'LEFT_ROOM' });
            }
          });
        }
      }
      hasConnectedBefore = true;
    };
    const onDisconnect = () => dispatch({ type: 'DISCONNECTED' });
    const onRoomState = (room: RoomPublicState) => dispatch({ type: 'ROOM_STATE', room });
    const onPrivate = (data: PlayerPrivate) => dispatch({ type: 'PRIVATE_STATE', data });
    const onPeek = (data: { aboutPlayerId: string; card: Card }) =>
      dispatch({
        type: 'NOTIFY',
        notification: { id: crypto.randomUUID(), message: 'Vous apercevez en secret une de ses cartes :', card: data.card, aboutPlayerId: data.aboutPlayerId },
      });
    const onInfo = (data: { message: string; card?: Card }) =>
      dispatch({ type: 'NOTIFY', notification: { id: crypto.randomUUID(), message: data.message, card: data.card } });
    const onError = (data: { code: string; message: string }) => dispatch({ type: 'ERROR', code: data.code, message: data.message });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('player:private', onPrivate);
    socket.on('card:privatePeek', onPeek);
    socket.on('card:privateInfo', onInfo);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('player:private', onPrivate);
      socket.off('card:privatePeek', onPeek);
      socket.off('card:privateInfo', onInfo);
      socket.off('error', onError);
    };
  }, []);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useGameState(): GameState {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useGameState must be used within a GameProvider');
  return ctx;
}

export function useGameDispatch(): Dispatch<Action> {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error('useGameDispatch must be used within a GameProvider');
  return ctx;
}
