import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, type CardMode } from '@thegang/shared';
import { kickPlayer, leaveRoom, setMode, startGame } from '../actions';
import { Avatar } from '../components/Avatar';
import { CopyCodeButton } from '../components/CopyCodeButton';
import { clearSession } from '../session';
import { useGameDispatch, useGameState } from '../state/GameContext';

const MODE_INFO: Record<CardMode, { label: string; description: string }> = {
  classique: {
    label: 'Classique',
    description: 'Aucune carte bonus ni malus, jamais : que les règles de base, sans complication supplémentaire.',
  },
  avance: {
    label: 'Avancé',
    description: "Une carte à la fois, tirée après chaque braquage selon son résultat (malus après un succès, bonus après un échec).",
  },
  pro: {
    label: 'Pro',
    description:
      "Une carte malus tirée au hasard reste active en permanence dès le braquage 1, en plus de la rotation normale qui s'ajoute à partir du braquage 2.",
  },
  gangster: {
    label: 'Gangster',
    description:
      "Toujours 2 cartes malus actives en même temps, dès le braquage 1, aucune carte bonus, et 2 alarmes suffisent à faire perdre le gang (au lieu de 3).",
  },
};
const MODES: CardMode[] = ['classique', 'avance', 'pro', 'gangster'];

export function LobbyScreen() {
  const { room, myPlayerId } = useGameState();
  const dispatch = useGameDispatch();

  if (!room) return null;

  const me = room.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const tooFew = room.players.length < MIN_PLAYERS;
  const tooMany = room.players.length > MAX_PLAYERS;
  const canStart = !tooFew && !tooMany;


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
        <CopyCodeButton code={room.code} />
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
        <h2>Mode de jeu</h2>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`btn ${room.settings.mode === m ? 'btn-primary' : 'btn-secondary'}`}
              disabled={!isHost}
              onClick={() => setMode(m)}
            >
              {MODE_INFO[m].label}
            </button>
          ))}
        </div>
        <p className="muted">{MODE_INFO[room.settings.mode].description}</p>
        {(room.settings.mode === 'pro' || room.settings.mode === 'gangster') && (
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            "Vigile zélé" est automatiquement exclue du tirage en mode Pro et Gangster.
          </p>
        )}
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
