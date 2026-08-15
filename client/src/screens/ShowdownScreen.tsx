import { useEffect, useState } from 'react';
import { HAND_CATEGORIES, type GuessGate, type HandCategory, type Rank } from '@thegang/shared';
import { revealNext, submitGuess } from '../actions';
import { Avatar } from '../components/Avatar';
import { PlayingCard } from '../components/PlayingCard';
import { useGameState } from '../state/GameContext';
import { HAND_CATEGORY_LABELS, rankLabel } from '../theme';

const GUESS_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function guessLabel(guessType: 'category' | 'rank', value: HandCategory | Rank): string {
  return guessType === 'category' ? HAND_CATEGORY_LABELS[value as HandCategory] : rankLabel(value as Rank);
}

function GuessPrompt({ guessType, onVoted }: { guessType: 'category' | 'rank'; onVoted: (value: HandCategory | Rank) => void }) {
  function vote(value: HandCategory | Rank) {
    if (guessType === 'category') submitGuess({ guessCategory: value as HandCategory });
    else submitGuess({ guessRank: value as Rank });
    onVoted(value);
  }

  return (
    <div className="card stack">
      <p style={{ fontWeight: 700, color: 'var(--fg)' }}>
        {guessType === 'category' ? 'Votez pour sa catégorie de main :' : "Votez pour le rang d'une de ses cartes :"}
      </p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {guessType === 'category'
          ? HAND_CATEGORIES.map((cat) => (
              <button key={cat} type="button" className="btn btn-secondary" onClick={() => vote(cat)}>
                {HAND_CATEGORY_LABELS[cat]}
              </button>
            ))
          : GUESS_RANKS.map((rank) => (
              <button key={rank} type="button" className="btn btn-secondary" onClick={() => vote(rank)}>
                {rankLabel(rank)}
              </button>
            ))}
      </div>
    </div>
  );
}

interface Props {
  onContinue?: () => void;
}

export function ShowdownScreen({ onContinue }: Props) {
  const { room, myPlayerId } = useGameState();
  const game = room?.game;
  const sd = game?.showdown;

  // Purely local: which way I voted for each gate type. Never derived from the server,
  // since individual votes aren't broadcast (only the tallied result is, once everyone's
  // voted) — this just lets my own screen switch from "vote" to "waiting" right away.
  const [myVotes, setMyVotes] = useState<Partial<Record<'category' | 'rank', HandCategory | Rank>>>({});
  const targetKey = sd?.guessGates.map((g) => g.targetPlayerId).join(',');
  useEffect(() => {
    setMyVotes({});
  }, [targetKey]);

  if (!room || !game || !sd) return null;

  const nextIndex = sd.revealed.length;
  const allRevealed = nextIndex >= sd.order.length;
  const nextPlayerId = sd.order[nextIndex];
  const pendingGates = sd.guessGates.filter((g) => g.targetPlayerId === nextPlayerId && !g.resolved);
  const gateBlocking = pendingGates.length > 0;
  const iAmTarget = pendingGates[0]?.targetPlayerId === myPlayerId;

  return (
    <div className="screen">
      <h2>L'abattage</h2>
      <p className="muted">Du jeton le moins étoilé au plus étoilé. Une main plus faible que la précédente fait échouer le braquage.</p>

      <div className="stack center">
        <span className="muted">Cartes communes</span>
        <div className="card-row">
          {game.communityCards.map((c, i) => (
            <PlayingCard key={i} card={c} />
          ))}
        </div>
      </div>

      <div className="stack">
        {sd.order.map((playerId, i) => {
          const player = room.players.find((p) => p.id === playerId);
          const entry = sd.revealed.find((r) => r.playerId === playerId);
          const isNext = i === nextIndex;
          const resolvedGuesses = sd.guessGates.filter(
            (g): g is GuessGate & { finalGuess: HandCategory | Rank } => g.targetPlayerId === playerId && g.resolved && g.finalGuess !== null,
          );
          return (
            <div
              key={playerId}
              className="card"
              style={{ opacity: !entry && !isNext ? 0.45 : 1, borderColor: isNext ? 'var(--gold)' : undefined }}
            >
              <div className="row-between">
                <div className="row">
                  <span className="badge">{i + 1}★</span>
                  <Avatar name={player?.name ?? '?'} color={player?.colorTag ?? '#888'} />
                  <span className="player-name">{player?.name}</span>
                </div>
                {entry && <span>{entry.orderOk ? '✅' : '❌'}</span>}
              </div>
              {resolvedGuesses.map((g) => (
                <p key={g.guessType} className="center muted" style={{ marginTop: '0.5rem' }}>
                  Le groupe a deviné :{' '}
                  <strong style={{ color: 'var(--fg)' }}>{guessLabel(g.guessType, g.finalGuess)}</strong>
                </p>
              ))}
              <div className="card-row" style={{ marginTop: '0.6rem' }}>
                {entry ? (
                  entry.holeCards.map((c, idx) => <PlayingCard key={idx} card={c} large />)
                ) : (
                  <>
                    <PlayingCard faceDown large />
                    <PlayingCard faceDown large />
                  </>
                )}
              </div>
              {entry && (
                <p className="center" style={{ marginTop: '0.5rem', fontWeight: 700, color: 'var(--fg)' }}>
                  {HAND_CATEGORY_LABELS[entry.hand.category]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky-footer stack">
        {allRevealed ? (
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => onContinue?.()}>
            Voir le résultat du braquage
          </button>
        ) : gateBlocking ? (
          iAmTarget ? (
            <p className="muted center">Le reste du gang doit deviner avant que vous ne révéliez votre main…</p>
          ) : (
            <div className="stack">
              {pendingGates.map((gate) =>
                myVotes[gate.guessType] !== undefined ? (
                  <p key={gate.guessType} className="muted center">
                    Vous avez voté{' '}
                    <strong style={{ color: 'var(--fg)' }}>{guessLabel(gate.guessType, myVotes[gate.guessType] as HandCategory | Rank)}</strong>{' '}
                    — en attente des autres…
                  </p>
                ) : (
                  <GuessPrompt
                    key={gate.guessType}
                    guessType={gate.guessType}
                    onVoted={(value) => setMyVotes((prev) => ({ ...prev, [gate.guessType]: value }))}
                  />
                ),
              )}
            </div>
          )
        ) : (
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => revealNext()}>
            Révéler la main suivante
          </button>
        )}
      </div>
    </div>
  );
}
