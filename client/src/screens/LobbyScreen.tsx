import { useState } from 'react';
import { BONUS_MALUS_CARDS, MAX_PLAYERS, MIN_PLAYERS } from '@thegang/shared';
import { kickPlayer, leaveRoom, randomizeCards, startGame, toggleCard } from '../actions';
import { Avatar } from '../components/Avatar';
import { clearSession } from '../session';
import { useGameDispatch, useGameState } from '../state/GameContext';

const MALUS_CARDS = BONUS_MALUS_CARDS.filter((card) => card.kind === 'malus');
const BONUS_CARDS = BONUS_MALUS_CARDS.filter((card) => card.kind === 'bonus');

function RandomizePicker({ max, onPick }: { max: number; onPick: (count: number) => void }) {
  const [count, setCount] = useState(Math.min(3, max));
  return (
    <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
      <input
        type="number"
        className="input"
        style={{ width: '4rem', minHeight: '40px', padding: '0.5rem', textAlign: 'center' }}
        min={0}
        max={max}
        value={count}
        onChange={(e) => setCount(Math.max(0, Math.min(max, Math.floor(Number(e.target.value)) || 0)))}
      />
      <button type="button" className="btn btn-secondary" onClick={() => onPick(count)}>
        🎲 Aléatoire
      </button>
    </div>
  );
}

export function LobbyScreen() {
  const { room, myPlayerId } = useGameState();
  const dispatch = useGameDispatch();
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const me = room.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const enabledCardIds = room.settings.enabledCardIds;
  const tooFew = room.players.length < MIN_PLAYERS;
  const tooMany = room.players.length > MAX_PLAYERS;
  const canStart = !tooFew && !tooMany;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable or denied — fail silently.
    }
  };

  const handleLeave = () => {
    leaveRoom();
    clearSession();
    dispatch({ type: 'LEFT_ROOM' });
  };

  return (
    <div className="screen">
      <div className="card center stack">
        <p className="muted">Code de la salle</p>
        <div className="input-code">{room.code}</div>
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'center' }} onClick={() => void handleCopy()}>
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>

      <div className="stack">
        <h2>
          Joueurs ({room.players.length}/{MAX_PLAYERS})
        </h2>
        <div>
          {room.players.map((p) => (
            <div key={p.id} className="player-row">
              <Avatar name={p.name} color={p.colorTag} />
              <span className={`player-name${p.connected ? '' : ' disconnected'}`}>
                {p.name}
                {!p.connected && ' (déconnecté)'}
              </span>
              {p.isHost && <span className="badge badge-gold">Hôte</span>}
              {isHost && p.id !== myPlayerId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-label={`Exclure ${p.name}`}
                  onClick={() => kickPlayer(p.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="stack">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2>Cartes malus (plus difficile)</h2>
          {isHost && <RandomizePicker max={MALUS_CARDS.length} onPick={(n) => randomizeCards('malus', n)} />}
        </div>
        <div>
          {MALUS_CARDS.map((card) => (
            <label key={card.id} className="checklist-item">
              <input
                type="checkbox"
                checked={enabledCardIds.includes(card.id)}
                disabled={!isHost}
                onChange={(e) => toggleCard(card.id, e.target.checked)}
              />
              <div>
                <div className="title">{card.name}</div>
                <div className="muted">{card.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="stack">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2>Cartes bonus (plus facile)</h2>
          {isHost && <RandomizePicker max={BONUS_CARDS.length} onPick={(n) => randomizeCards('bonus', n)} />}
        </div>
        <div>
          {BONUS_CARDS.map((card) => (
            <label key={card.id} className="checklist-item">
              <input
                type="checkbox"
                checked={enabledCardIds.includes(card.id)}
                disabled={!isHost}
                onChange={(e) => toggleCard(card.id, e.target.checked)}
              />
              <div>
                <div className="title">{card.name}</div>
                <div className="muted">{card.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className="stack">
          {!canStart && (
            <p className="muted center">
              {tooFew
                ? `Il faut au moins ${MIN_PLAYERS} joueurs pour commencer`
                : `Il ne peut pas y avoir plus de ${MAX_PLAYERS} joueurs`}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block btn-lg" disabled={!canStart} onClick={() => startGame()}>
            Lancer la partie
          </button>
        </div>
      ) : (
        <p className="muted center">En attente que l'hôte lance la partie…</p>
      )}

      <button type="button" className="btn btn-danger btn-block" onClick={handleLeave}>
        Quitter la salle
      </button>
    </div>
  );
}
