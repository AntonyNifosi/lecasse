import { HAND_CATEGORIES, type Rank } from '@thegang/shared';
import { revealNext, submitGuess } from '../actions';
import { Avatar } from '../components/Avatar';
import { PlayingCard } from '../components/PlayingCard';
import { useGameState } from '../state/GameContext';
import { HAND_CATEGORY_LABELS, rankLabel } from '../theme';

const GUESS_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function GuessPrompt({ guessType }: { guessType: 'category' | 'rank' }) {
  return (
    <div className="card stack">
      <p style={{ fontWeight: 700, color: 'var(--fg)' }}>
        {guessType === 'category' ? 'Devinez sa catégorie de main :' : "Devinez le rang d'une de ses cartes :"}
      </p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {guessType === 'category'
          ? HAND_CATEGORIES.map((cat) => (
              <button key={cat} type="button" className="btn btn-secondary" onClick={() => submitGuess({ guessCategory: cat })}>
                {HAND_CATEGORY_LABELS[cat]}
              </button>
            ))
          : GUESS_RANKS.map((rank) => (
              <button key={rank} type="button" className="btn btn-secondary" onClick={() => submitGuess({ guessRank: rank })}>
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
  if (!room || !game || !sd) return null;

  const nextIndex = sd.revealed.length;
  const allRevealed = nextIndex >= sd.order.length;
  const nextPlayerId = sd.order[nextIndex];
  const gate = sd.guessGate;
  const gateBlocking = gate && !gate.resolved && gate.targetPlayerId === nextPlayerId;
  const iAmTarget = gate?.targetPlayerId === myPlayerId;

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
            <GuessPrompt guessType={gate.guessType} />
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
