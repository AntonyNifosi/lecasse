import { leaveRoom, rematch } from '../actions';
import { clearSession } from '../session';
import { useGameDispatch, useGameState } from '../state/GameContext';

export function GameEndScreen() {
  const { room } = useGameState();
  const dispatch = useGameDispatch();
  if (!room || !room.game) return null;

  const won = room.finalResult === 'win';

  function handleLeave() {
    leaveRoom();
    clearSession();
    dispatch({ type: 'LEFT_ROOM' });
  }

  return (
    <div className="screen screen-centered">
      <div style={{ fontSize: '4rem' }}>{won ? '🥳' : '💀'}</div>
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
