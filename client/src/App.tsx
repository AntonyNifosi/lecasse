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

// The server resolves the heist (and, on the last one, ends the match) in the same
// update that records the final reveal, so both beats must be gated on a local ack
// rather than derived straight from state — otherwise the last card's reveal jumps
// straight past it (first to the heist result, then possibly straight to GameEnd) and
// the player never actually sees what just got revealed.
function renderScreen(
  state: GameState,
  showdownAcked: boolean,
  onAckShowdown: () => void,
  finalAcked: boolean,
  onAckFinal: () => void,
) {
  const { room } = state;
  if (!room) return <HomeScreen />;
  if (room.status === 'lobby') return <LobbyScreen />;
  const round = room.game?.currentRound;
  if (round === 'showdown' || (round === 'result' && !showdownAcked)) {
    return <ShowdownScreen onContinue={onAckShowdown} />;
  }
  if (round === 'result' && !(room.status === 'ended' && finalAcked)) {
    return <HeistResultScreen final={room.status === 'ended'} onContinue={onAckFinal} />;
  }
  if (room.status === 'ended') return <GameEndScreen />;
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
  const [showdownAcked, setShowdownAcked] = useState(false);
  const [finalAcked, setFinalAcked] = useState(false);
  const roomStatus = state.room?.status;
  const round = state.room?.game?.currentRound;

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

  // Reset the ack as soon as we leave the 'ended' status (rematch or a fresh room),
  // so it doesn't leak into the next game's own final-heist result.
  useEffect(() => {
    if (roomStatus !== 'ended') setFinalAcked(false);
  }, [roomStatus]);

  // Same idea for the showdown-complete ack: reset it the moment we're not sitting on
  // a resolved heist, so it's fresh again for the next one.
  useEffect(() => {
    if (round !== 'result') setShowdownAcked(false);
  }, [round]);

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
      {renderScreen(state, showdownAcked, () => setShowdownAcked(true), finalAcked, () => setFinalAcked(true))}
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
