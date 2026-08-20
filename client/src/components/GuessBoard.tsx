import type { ReactNode } from 'react';
import { HAND_CATEGORIES, type GuessGate, type HandCategory, type PlayerPublic, type Rank } from '@thegang/shared';
import { previewGuess } from '../actions';
import { HAND_CATEGORY_EXAMPLE, HAND_CATEGORY_LABELS, rankLabel } from '../theme';
import { Avatar } from './Avatar';
import { PlayingCard } from './PlayingCard';

const GUESS_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

interface Props {
  gate: GuessGate;
  players: PlayerPublic[];
  myPlayerId: string | null;
  /** False once I've already validated this gate, or I'm the target — the board keeps
   * showing where everyone stands, but stops taking clicks. */
  interactive: boolean;
}

/** The group's guess, laid out on the felt itself rather than in a panel over it: each
 * option is a spot on the table, and a player's avatar sits on whichever one they're
 * currently leaning toward — a ringed avatar means that pick is actually locked in. Picking
 * is public and reversible (previewGuess); only the footer's Valider button commits it. */
export function GuessBoard({ gate, players, myPlayerId, interactive }: Props) {
  const isCategory = gate.guessType === 'category';
  // Everyone but the player being guessed about — including me, so my own avatar shows up
  // on whatever I'm leaning toward exactly like everyone else's.
  const voters = players.filter((p) => p.id !== gate.targetPlayerId);

  function pick(value: HandCategory | Rank) {
    if (!interactive) return;
    previewGuess(isCategory ? { guessCategory: value as HandCategory } : { guessRank: value as Rank });
  }

  function bets(value: HandCategory | Rank): ReactNode {
    const backers = voters.filter((p) => gate.picks[p.id] === value);
    if (backers.length === 0) return null;
    return (
      <span className="guess-zone-bets">
        {backers.map((p) => (
          // Ringed once that player has actually validated — still leaning vs. committed.
          <span key={p.id} className={`guess-backer${gate.votes[p.id] !== undefined ? ' locked' : ''}`} title={p.name}>
            <Avatar name={p.name} color={p.colorTag} size="sm" />
          </span>
        ))}
      </span>
    );
  }

  if (isCategory) {
    return (
      <div className="guess-board" data-kind="category">
        {HAND_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`guess-zone${gate.picks[myPlayerId ?? ''] === cat ? ' sel' : ''}`}
            disabled={!interactive}
            onClick={() => pick(cat)}
          >
            <span className="guess-zone-label">{HAND_CATEGORY_LABELS[cat]}</span>
            <span className="guess-zone-fan">
              {HAND_CATEGORY_EXAMPLE[cat].map((c, idx) => (
                <PlayingCard key={idx} card={c} small />
              ))}
            </span>
            {bets(cat)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="guess-board" data-kind="rank">
      {GUESS_RANKS.map((r) => (
        <button
          key={r}
          type="button"
          className={`guess-zone${gate.picks[myPlayerId ?? ''] === r ? ' sel' : ''}`}
          disabled={!interactive}
          onClick={() => pick(r)}
        >
          <span className="guess-zone-rank">{rankLabel(r)}</span>
          {bets(r)}
        </button>
      ))}
    </div>
  );
}
