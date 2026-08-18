import { getCardById, HAND_CATEGORIES, ROUND_ORDER, type GuessGate, type HandCategory, type Rank } from '@thegang/shared';
import { revealNext, submitGuess } from '../actions';
import { GameMenu } from '../components/GameMenu';
import { PlayingCard } from '../components/PlayingCard';
import { Table } from '../components/Table';
import { useGameState } from '../state/GameContext';
import { HAND_CATEGORY_LABELS, ROUND_TOKEN_COLOR, rankLabel } from '../theme';

const GUESS_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function guessLabel(guessType: 'category' | 'rank', value: HandCategory | Rank): string {
  return guessType === 'category' ? HAND_CATEGORY_LABELS[value as HandCategory] : rankLabel(value as Rank);
}

function GuessPrompt({ guessType, cardName }: { guessType: 'category' | 'rank'; cardName?: string }) {
  function vote(value: HandCategory | Rank) {
    if (guessType === 'category') submitGuess({ guessCategory: value as HandCategory });
    else submitGuess({ guessRank: value as Rank });
  }

  return (
    <div className="stack">
      <p style={{ fontWeight: 700, color: 'var(--fg)' }}>
        {/* Named after the card that opened it: two malus cards can be in play at once
            (Pro/Gangster), and two unexplained polls at the same time read like a bug. */}
        {cardName && <span className="badge">{cardName}</span>}{' '}
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

  if (!room || !game || !sd) return null;

  const nextIndex = sd.revealed.length;
  const allRevealed = nextIndex >= sd.order.length;
  const nextPlayerId = sd.order[nextIndex];
  const nextPlayer = room.players.find((p) => p.id === nextPlayerId);
  const pendingGates = sd.guessGates.filter((g) => g.targetPlayerId === nextPlayerId && !g.resolved);
  const gateBlocking = pendingGates.length > 0;
  const iAmTarget = pendingGates[0]?.targetPlayerId === myPlayerId;
  const iAmNext = nextPlayerId === myPlayerId;

  /** Which active malus card opened a given guess, so each poll can say where it comes from. */
  function gateCardName(gate: GuessGate): string | undefined {
    for (const ac of game!.activeCards) {
      const def = getCardById(ac.cardId);
      if (def?.effect.kind === 'blindGuessGate' && def.effect.guess === gate.guessType) return def.name;
    }
    return undefined;
  }

  return (
    <div className="table-screen">
      <div className="table-screen-header">
        <div>
          <h2>L'abattage</h2>
          <p className="muted">Du jeton le moins étoilé au plus étoilé.</p>
        </div>
        <GameMenu />
      </div>

      <Table
        players={room.players}
        myPlayerId={myPlayerId}
        highlightPlayerId={allRevealed ? null : nextPlayerId}
        centerContent={
          <div className="card-row">
            {game.communityCards.map((c, i) => (
              <PlayingCard key={i} card={c} />
            ))}
          </div>
        }
        renderHoleCards={(player, isMe) => {
          const entry = sd.revealed.find((r) => r.playerId === player.id);
          return entry ? (
            entry.holeCards.map((c, idx) => <PlayingCard key={idx} card={c} small={!isMe} />)
          ) : (
            <>
              <PlayingCard faceDown small={!isMe} />
              <PlayingCard faceDown small={!isMe} />
            </>
          );
        }}
        cardsRevealed={(player) => sd.revealed.some((r) => r.playerId === player.id)}
        renderBadge={(player) => {
          const order = sd.order.indexOf(player.id);
          return (
            <div className="table-seat-badges">
              <span className="badge">{order + 1}★</span>
              {ROUND_ORDER.slice(0, 3).map((rc) => {
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
          );
        }}
        renderSeatExtra={(player) => {
          // While the group is guessing, every seat shows where that player stands — around
          // a real table this gets talked through out loud, so it's shown as it's cast.
          if (gateBlocking && player.id !== nextPlayerId) {
            return (
              <span className="table-seat-showdown">
                {pendingGates
                  .map((g) => {
                    const vote = g.votes[player.id];
                    return vote === undefined ? '…' : guessLabel(g.guessType, vote);
                  })
                  .join(' · ')}
              </span>
            );
          }
          const entry = sd.revealed.find((r) => r.playerId === player.id);
          if (!entry) return null;
          const resolvedGuesses = sd.guessGates.filter(
            (g): g is GuessGate & { finalGuess: HandCategory | Rank } =>
              g.targetPlayerId === player.id && g.resolved && g.finalGuess !== null,
          );
          // Kept to a single line (icon + category, optionally "· devinette") — seats are
          // tight on vertical room, so this stays one row regardless of how much text.
          const guessSuffix = resolvedGuesses.map((g) => guessLabel(g.guessType, g.finalGuess)).join(' / ');
          return (
            <span className="table-seat-showdown">
              {entry.orderOk ? '✅' : '❌'} {HAND_CATEGORY_LABELS[entry.hand.category]}
              {guessSuffix && ` · ${guessSuffix}`}
            </span>
          );
        }}
      />

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
              {pendingGates.map((gate) => {
                const myVote = myPlayerId ? gate.votes[myPlayerId] : undefined;
                return myVote !== undefined ? (
                  <p key={gate.guessType} className="muted center">
                    <span className="badge">{gateCardName(gate)}</span> Vous avez voté{' '}
                    <strong style={{ color: 'var(--fg)' }}>{guessLabel(gate.guessType, myVote)}</strong> — en attente des
                    autres…
                  </p>
                ) : (
                  <GuessPrompt key={gate.guessType} guessType={gate.guessType} cardName={gateCardName(gate)} />
                );
              })}
            </div>
          )
        ) : iAmNext ? (
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => revealNext()}>
            Révéler ma main
          </button>
        ) : (
          <p className="muted center">En attente que {nextPlayer?.name ?? '?'} révèle sa main…</p>
        )}
      </div>
    </div>
  );
}
