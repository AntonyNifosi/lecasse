import { useEffect, useState } from 'react';
import { getCardById, VAULTS_TO_WIN, type RoundColor } from '@thegang/shared';
import { releaseToken, takeToken } from '../actions';
import { Avatar } from '../components/Avatar';
import { GameMenu } from '../components/GameMenu';
import { HandRankingModal } from '../components/HandRankingModal';
import { PlayingCard } from '../components/PlayingCard';
import { useGameState } from '../state/GameContext';
import { ROUND_LABELS, ROUND_TOKEN_COLOR } from '../theme';

const ROUND_SEQUENCE: RoundColor[] = ['white', 'yellow', 'orange', 'red'];

export function GameBoardScreen() {
  const { room, myPlayerId, myHoleCards } = useGameState();
  const [showHelp, setShowHelp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const game = room?.game;
  const roundColor = (game?.currentRound as RoundColor) ?? null;
  // Collapsed by default each round — the token row already shows the current state,
  // this is just for catching up on who fumbled with what before you looked.
  useEffect(() => {
    setShowHistory(false);
  }, [roundColor]);
  if (!room || !game) return null;

  const rs = game.tokensByRound[roundColor];
  const activeCards = game.activeCards.map((ac) => getCardById(ac.cardId)).filter((c): c is NonNullable<typeof c> => !!c);
  const currentIdx = ROUND_SEQUENCE.indexOf(roundColor);

  return (
    <div className="screen">
      <div className="row-between">
        <div>
          <h2>Braquage n°{game.heistNumber}</h2>
          <p className="muted">{ROUND_LABELS[roundColor]}</p>
        </div>
        <div className="row" style={{ gap: '0.3rem' }}>
          <GameMenu />
          <button type="button" className="btn btn-ghost" onClick={() => setShowHelp(true)}>
            Aide
          </button>
        </div>
      </div>

      <div className="row-between">
        <div className="row">
          <span className="muted">Coffres</span>
          <div className="pill-progress">
            {Array.from({ length: VAULTS_TO_WIN }, (_, i) => (
              <span key={i} className={`pill${i < game.vaults ? ' filled-gold' : ''}`} />
            ))}
          </div>
        </div>
        <div className="row">
          <span className="muted">Alarmes</span>
          <div className="pill-progress">
            {Array.from({ length: game.alarmsToLose }, (_, i) => (
              <span key={i} className={`pill${i < game.alarms ? ' filled-red' : ''}`} />
            ))}
          </div>
        </div>
      </div>

      {activeCards.map((card) => (
        <div key={card.id} className={`round-banner ${card.kind}`}>
          <span className="badge">{card.kind === 'malus' ? 'Malus' : 'Bonus'}</span>
          <div>
            <div style={{ fontWeight: 700 }}>{card.name}</div>
            <div className="muted">{card.description}</div>
          </div>
        </div>
      ))}

      {game.wildAdvantagePlayerId && (
        <p className="muted center">
          🃏 {room.players.find((p) => p.id === game.wildAdvantagePlayerId)?.name} l'emporte sur toute main de même
          catégorie à l'abattage.
        </p>
      )}

      {game.publicInfoReveal && (
        <div className="card-flat">
          <div className="muted" style={{ marginBottom: '0.35rem' }}>
            Info révélée par le groupe :
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {Object.entries(game.publicInfoReveal).map(([playerId, value]) => {
              const p = room.players.find((pl) => pl.id === playerId);
              return (
                <span key={playerId} className="badge">
                  {p?.name}: {value}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="stack center">
        <span className="muted">Cartes communes</span>
        <div className="card-row">
          {Array.from({ length: 5 }, (_, i) => (
            <PlayingCard key={i} card={game.communityCards[i]} faceDown={i >= game.communityCards.length} />
          ))}
        </div>
      </div>

      <div className="stack center">
        <span className="muted">Vos cartes</span>
        <div className="card-row">
          {myHoleCards.map((c, i) => (
            <PlayingCard key={i} card={c} large />
          ))}
        </div>
      </div>

      <div className="divider" />

      <div className="stack center">
        <span className="muted">Jetons — {ROUND_LABELS[roundColor]}</span>
        {!rs.active ? (
          <p className="muted">Ce tour est désactivé pour ce braquage.</p>
        ) : (
          <div className="token-row">
            {rs.starsAvailable.map((star) => {
              const holderId = rs.holderByStars[star];
              const holder = room.players.find((p) => p.id === holderId);
              const isMine = holderId === myPlayerId;
              const isLocked = rs.lockedStars.includes(star);
              return (
                <div key={star} className="token-slot">
                  <button
                    type="button"
                    className={`token${isMine ? ' mine' : ''}${isLocked ? ' locked' : ''}`}
                    style={{
                      background: ROUND_TOKEN_COLOR[roundColor],
                      borderColor: holder ? holder.colorTag : 'transparent',
                      opacity: holder ? 1 : 0.5,
                      position: 'relative',
                    }}
                    disabled={isLocked && !isMine}
                    onClick={() => (isMine ? releaseToken() : takeToken(star))}
                  >
                    {star}
                    {isLocked && <span className="token-lock">🔒</span>}
                  </button>
                  <span className="token-slot-name">{holder ? holder.name : ''}</span>
                </div>
              );
            })}
          </div>
        )}
        {rs.history.length > 0 && (
          <button type="button" className="btn btn-ghost history-toggle" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? '▾' : '▸'} Historique ({rs.history.length})
          </button>
        )}
        {showHistory && rs.history.length > 0 && (
          <div className="token-history">
            {[...rs.history].reverse().map((entry, i) => {
              const player = room.players.find((p) => p.id === entry.playerId);
              return (
                <div key={i} className="token-history-entry">
                  <Avatar name={player?.name ?? '?'} color={player?.colorTag ?? '#888'} size="sm" />
                  <span>
                    <strong>{player?.name ?? '?'}</strong> {entry.action === 'take' ? 'a pris' : 'a relâché'} le jeton{' '}
                    {entry.stars}★
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="divider" />

      <div className="stack">
        <span className="muted">Évolution du gang</span>
        {room.players.map((p) => (
          <div key={p.id} className="row">
            <Avatar name={p.name} color={p.colorTag} size="sm" />
            <span className="player-name">{p.name}</span>
            <div className="row" style={{ gap: '0.3rem' }}>
              {ROUND_SEQUENCE.slice(0, currentIdx + 1).map((rc) => {
                const roundState = game.tokensByRound[rc];
                if (!roundState.active) return null;
                const star = roundState.starsAvailable.find((s) => roundState.holderByStars[s] === p.id);
                return (
                  <span
                    key={rc}
                    className="history-pip"
                    style={{ background: star ? ROUND_TOKEN_COLOR[rc] : 'transparent' }}
                  >
                    {star ?? ''}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {showHelp && <HandRankingModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
