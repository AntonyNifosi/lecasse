import { useEffect, useState } from 'react';
import { getCardById, VAULTS_TO_WIN, type RoundColor } from '@thegang/shared';
import { releaseToken, takeToken } from '../actions';
import { Avatar } from '../components/Avatar';
import { EmotePicker } from '../components/EmotePicker';
import { GameMenu } from '../components/GameMenu';
import { HandRankingModal } from '../components/HandRankingModal';
import { PlayingCard } from '../components/PlayingCard';
import { Table } from '../components/Table';
import { useTokenEvents } from '../hooks/useTokenEvents';
import { useTokenFlights } from '../hooks/useTokenFlights';
import { useGameState } from '../state/GameContext';
import { contestedStars, hyperactivePlayers } from '../tokenActivity';
import { ROUND_LABELS, ROUND_TOKEN_COLOR } from '../theme';

const ROUND_SEQUENCE: RoundColor[] = ['white', 'yellow', 'orange', 'red'];

export function GameBoardScreen() {
  const { room, myPlayerId, myHoleCards, emotes } = useGameState();
  const [showHelp, setShowHelp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showActiveCards, setShowActiveCards] = useState(false);
  const game = room?.game;
  const roundColor = (game?.currentRound as RoundColor) ?? null;
  const rs = game?.tokensByRound[roundColor];
  // Hooks must run unconditionally, before the early return below — rs is undefined
  // whenever game/roundColor aren't ready yet, which useTokenEvents already tolerates.
  const tokenEvents = useTokenEvents(rs);
  const { flights, inFlightStars } = useTokenFlights(tokenEvents, room?.players ?? [], roundColor ? ROUND_TOKEN_COLOR[roundColor] : '#888');

  // Collapsed by default each round — the seats already show current holdings, this modal
  // is just for catching up on who fumbled with what before you looked.
  useEffect(() => {
    setShowHistory(false);
  }, [roundColor]);

  if (!room || !game || !rs) return null;

  const activeCards = game.activeCards.map((ac) => getCardById(ac.cardId)).filter((c): c is NonNullable<typeof c> => !!c);
  const currentIdx = ROUND_SEQUENCE.indexOf(roundColor);
  const contested = contestedStars(rs.history);
  const hyperactive = hyperactivePlayers(rs.history);
  const seatFlashSeq: Record<string, number> = {};
  for (const e of tokenEvents) {
    if (e.kind === 'steal' && e.fromPlayerId) seatFlashSeq[e.fromPlayerId] = e.seq;
  }
  const flashSeqByStar = new Map(tokenEvents.filter((e) => e.kind !== 'release').map((e) => [e.star, e.seq]));

  return (
    <div className="table-screen">
      <div className="table-screen-header">
        <div>
          <h2>Braquage n°{game.heistNumber}</h2>
          <p className="muted">{ROUND_LABELS[roundColor]}</p>
        </div>
        <div className="row" style={{ gap: '1.5rem' }}>
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
        <div className="row" style={{ gap: '0.3rem' }}>
          {activeCards.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setShowActiveCards(true)}>
              🎴 {activeCards.length}
            </button>
          )}
          <EmotePicker />
          <GameMenu />
          <button type="button" className="btn btn-ghost" onClick={() => setShowHelp(true)}>
            Aide
          </button>
        </div>
      </div>

      {game.wildAdvantagePlayerId && (
        <p className="muted center" style={{ margin: 0 }}>
          🃏 {room.players.find((p) => p.id === game.wildAdvantagePlayerId)?.name} l'emporte sur toute main de même
          catégorie à l'abattage.
        </p>
      )}

      {game.publicInfoReveal && (
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
          {Object.entries(game.publicInfoReveal).map(([playerId, value]) => {
            const p = room.players.find((pl) => pl.id === playerId);
            return (
              <span key={playerId} className="badge">
                {p?.name}: {value}
              </span>
            );
          })}
        </div>
      )}

      <Table
        players={room.players}
        myPlayerId={myPlayerId}
        hyperactivePlayerIds={hyperactive}
        seatFlashSeq={seatFlashSeq}
        emotes={emotes}
        renderHoleCards={(player, isMe) =>
          isMe ? (
            myHoleCards.map((c, i) => <PlayingCard key={i} card={c} />)
          ) : (
            <>
              <PlayingCard faceDown small />
              <PlayingCard faceDown small />
            </>
          )
        }
        renderBadge={(player) => (
          <div className="table-seat-badges">
            {ROUND_SEQUENCE.slice(0, currentIdx).map((rc) => {
              const roundState = game.tokensByRound[rc];
              if (!roundState.active) return null;
              const star = roundState.starsAvailable.find((s) => roundState.holderByStars[s] === player.id);
              return (
                <span key={rc} className="history-pip" style={{ background: star ? ROUND_TOKEN_COLOR[rc] : 'transparent' }}>
                  {star ?? ''}
                </span>
              );
            })}
          </div>
        )}
        renderToken={(player) => {
          const myCurrentStar = rs.active ? rs.starsAvailable.find((s) => rs.holderByStars[s] === player.id) : undefined;
          if (myCurrentStar === undefined) return null;
          const isMine = player.id === myPlayerId;
          const isLocked = rs.lockedStars.includes(myCurrentStar);
          const isContested = contested.has(myCurrentStar);
          const flashSeq = flashSeqByStar.get(myCurrentStar);
          // Kept in the DOM (not returned as null) even while its flight is still inbound,
          // just invisible — so the flying ghost has a precise, stable spot to measure and
          // land on, and the real token can take over the instant it arrives.
          const landing = inFlightStars.has(myCurrentStar);
          return (
            <button
              key={flashSeq ?? 'idle'}
              type="button"
              data-token-slot={player.id}
              className={`token${isMine ? ' mine' : ''}${isLocked ? ' locked' : ''}${isContested ? ' contested' : ''}${flashSeq !== undefined ? ' token-flash' : ''}${landing ? ' token-landing' : ''}`}
              style={{ background: ROUND_TOKEN_COLOR[roundColor], borderColor: player.colorTag, position: 'relative' }}
              // Locked means stuck with its owner for the round — nobody can act on it,
              // not even the owner switching away from it (see engine's takeToken).
              disabled={isLocked || landing}
              onClick={() => (isMine ? releaseToken() : takeToken(myCurrentStar))}
            >
              {myCurrentStar}
              {isLocked && <span className="token-lock">🔒</span>}
            </button>
          );
        }}
        centerContent={
          <>
            <div className="card-row">
              {Array.from({ length: 5 }, (_, i) => (
                <PlayingCard key={i} card={game.communityCards[i]} faceDown={i >= game.communityCards.length} />
              ))}
            </div>
            {rs.active ? (
              <div className="token-row">
                {rs.starsAvailable.map((star) => {
                  const holderId = rs.holderByStars[star];
                  // Also holds the neutral placeholder while a release is still in flight
                  // back to the pool — otherwise this slot would flip to "ready to claim"
                  // before the ghost carrying it has actually arrived.
                  if (holderId || inFlightStars.has(star)) {
                    // Claimed — it now lives at its holder's seat; keep this slot as an
                    // empty anchor (data-star) so the flight animation has a stable "pool
                    // position" to fly to/from later, without being clickable here anymore.
                    return (
                      <div key={star} className="token-slot" data-star={star}>
                        <div className="token token-empty-slot" aria-hidden="true">
                          {star}
                        </div>
                      </div>
                    );
                  }
                  const isContested = contested.has(star);
                  return (
                    <div key={star} className="token-slot" data-star={star}>
                      <button
                        key={flashSeqByStar.get(star) ?? 'idle'}
                        type="button"
                        className={`token${isContested ? ' contested' : ''}${flashSeqByStar.has(star) ? ' token-flash' : ''}`}
                        style={{ background: ROUND_TOKEN_COLOR[roundColor], borderColor: 'transparent', position: 'relative' }}
                        onClick={() => takeToken(star)}
                      >
                        {star}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">Ce tour est désactivé pour ce braquage.</p>
            )}
            {rs.history.length > 0 && (
              <button type="button" className="btn btn-ghost history-toggle" onClick={() => setShowHistory(true)}>
                {rs.history.length} mouvement{rs.history.length > 1 ? 's' : ''}
              </button>
            )}
          </>
        }
      />

      {flights.map((f) => (
        <div
          key={f.id}
          className="token-flight"
          style={{
            left: f.left,
            top: f.top,
            background: f.color,
            borderColor: f.ringColor,
            animationDuration: `${f.durationMs}ms`,
            // @ts-expect-error -- custom properties aren't in React's CSSProperties type
            '--dx': `${f.dx}px`,
            '--dy': `${f.dy}px`,
            '--arc': `${f.arc}px`,
            '--spin': `${f.spin}deg`,
          }}
        >
          {f.label}
        </div>
      ))}

      {showHelp && <HandRankingModal onClose={() => setShowHelp(false)} />}

      {showActiveCards && (
        <div className="modal-backdrop" onClick={() => setShowActiveCards(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <h2>Cartes actives</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setShowActiveCards(false)} aria-label="Fermer">
                ✕
              </button>
            </div>
            <div className="stack" style={{ marginTop: '0.75rem' }}>
              {activeCards.map((card) => (
                <div key={card.id} className={`round-banner ${card.kind}`}>
                  <span className="badge">{card.kind === 'malus' ? 'Malus' : 'Bonus'}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{card.name}</div>
                    <div className="muted">{card.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="modal-backdrop" onClick={() => setShowHistory(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <h2>Historique — {ROUND_LABELS[roundColor]}</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setShowHistory(false)} aria-label="Fermer">
                ✕
              </button>
            </div>
            <div className="token-history" style={{ maxHeight: '60vh' }}>
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
          </div>
        </div>
      )}
    </div>
  );
}
