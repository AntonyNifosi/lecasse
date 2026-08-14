import { useEffect, useState } from 'react';
import { clearSession, loadSession } from './session';
import { rejoinRoom } from './actions';
import { GameProvider, useGameDispatch, useGameState, type GameState } from './state/GameContext';
import { PlayingCard } from './components/PlayingCard';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameBoardScreen } from './screens/GameBoardScreen';
import { ShowdownScreen } from './screens/ShowdownScreen';
import { HeistResultScreen } from './screens/HeistResultScreen';
import { GameEndScreen } from './screens/GameEndScreen';

function renderScreen(state: GameState) {
  const { room } = state;
  if (!room) return <HomeScreen />;
  if (room.status === 'lobby') return <LobbyScreen />;
  if (room.status === 'ended') return <GameEndScreen />;
  const round = room.game?.currentRound;
  if (round === 'showdown') return <ShowdownScreen />;
  if (round === 'result') return <HeistResultScreen />;
  return <GameBoardScreen />;
}

function Toasts() {
  const { notifications, lastError, room } = useGameState();
  const dispatch = useGameDispatch();

  useEffect(() => {
    if (notifications.length === 0) return;
    const id = notifications[0].id;
    const timer = setTimeout(() => dispatch({ type: 'DISMISS_NOTIFICATION', id }), 5000);
    return () => clearTimeout(timer);
  }, [notifications, dispatch]);

  useEffect(() => {
    if (!lastError) return;
    const timer = setTimeout(() => dispatch({ type: 'CLEAR_ERROR' }), 4500);
    return () => clearTimeout(timer);
  }, [lastError, dispatch]);

  const players = room?.players ?? [];

  return (
    <div className="toast-stack">
      {lastError && (
        <div className="toast error" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>
          <span>{lastError.message}</span>
        </div>
      )}
      {notifications.map((n) => {
        const about = n.aboutPlayerId ? players.find((p) => p.id === n.aboutPlayerId) : undefined;
        return (
          <div key={n.id} className="toast" onClick={() => dispatch({ type: 'DISMISS_NOTIFICATION', id: n.id })}>
            <span>{about ? `${n.message} (${about.name})` : n.message}</span>
            {n.card && <PlayingCard card={n.card} />}
          </div>
        );
      })}
    </div>
  );
}

function Router() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const [rejoinAttempted, setRejoinAttempted] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      setRejoinAttempted(true);
      return;
    }
    rejoinRoom(session.roomCode, session.playerId, session.secretToken)
      .then((res) => {
        if (res.ok) {
          dispatch({ type: 'SET_IDENTITY', playerId: session.playerId });
        } else {
          clearSession();
        }
      })
      .finally(() => setRejoinAttempted(true));
  }, [dispatch]);

  if (!rejoinAttempted) {
    return (
      <div className="overlay">
        <div className="spinner" />
        <p>Reconnexion…</p>
      </div>
    );
  }

  return (
    <>
      {renderScreen(state)}
      <Toasts />
      {state.room && state.connection === 'disconnected' && (
        <div className="overlay">
          <div className="spinner" />
          <p>Connexion perdue, on essaie de se reconnecter…</p>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <div className="app-shell">
        <Router />
      </div>
    </GameProvider>
  );
}
