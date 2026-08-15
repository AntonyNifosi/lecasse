import { useState } from 'react';
import { leaveRoom, rematch } from '../actions';
import { clearSession } from '../session';
import { useGameDispatch, useGameState } from '../state/GameContext';
import { Avatar } from '../components/Avatar';

export function GameEndScreen() {
  const { room } = useGameState();
  const dispatch = useGameDispatch();
  const [copied, setCopied] = useState(false);
  if (!room || !room.game) return null;

  const won = room.finalResult === 'win';

  function handleLeave() {
    leaveRoom();
    clearSession();
    dispatch({ type: 'LEFT_ROOM' });
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable or denied — fail silently.
    }
  };

  return (
    <div className="screen screen-centered">
      <div className="result-emoji" style={{ fontSize: '4rem' }}>
        {won ? '🥳' : '💀'}
      </div>
      <h1 style={{ color: won ? 'var(--gold)' : 'var(--red)' }}>{won ? "Le gang s'en sort !" : 'Le gang est fait !'}</h1>
      <p className="muted">
        {won ? 'Trois coffres ouverts avant trois alarmes : bravo.' : 'Trois alarmes déclenchées : la partie est terminée.'}
      </p>

      <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {room.game.history.map((h) => (
          <span key={h.heistNumber} style={{ fontSize: '1.6rem' }}>
            {h.outcome === 'success' ? '🏆' : '🚨'}
          </span>
        ))}
      </div>

      <div className="card center stack" style={{ width: '100%' }}>
        <p className="muted">Envie de rajouter quelqu'un avant la prochaine partie ?</p>
        <div className="input-code">{room.code}</div>
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'center' }} onClick={() => void handleCopy()}>
          {copied ? 'Copié !' : 'Copier le code'}
        </button>
      </div>

      <div className="stack" style={{ width: '100%' }}>
        <span className="muted">Le gang ({room.players.length})</span>
        <div>
          {room.players.map((p) => (
            <div key={p.id} className="player-row">
              <Avatar name={p.name} color={p.colorTag} size="sm" />
              <span className={`player-name${p.connected ? '' : ' disconnected'}`}>
                {p.name}
                {!p.connected && ' (déconnecté)'}
              </span>
              {p.isHost && <span className="badge badge-gold">Hôte</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="stack" style={{ width: '100%' }}>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => rematch()}>
          Rejouer
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={handleLeave}>
          Quitter
        </button>
      </div>
    </div>
  );
}
