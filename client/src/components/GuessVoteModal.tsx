import { useState } from 'react';
import { HAND_CATEGORIES, type GuessGate, type HandCategory, type PlayerPublic, type Rank } from '@thegang/shared';
import { previewGuess, submitGuess } from '../actions';
import { HAND_CATEGORY_LABELS, rankLabel } from '../theme';
import { Avatar } from './Avatar';

const GUESS_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

interface Props {
  gate: GuessGate;
  /** The malus card that opened this guess — two can run at once in Gangster mode, and two
   * unexplained polls at the same time read like a bug. */
  cardName?: string;
  targetName: string;
  players: PlayerPublic[];
  myPlayerId: string;
}

/** The group's guess, as a panel you answer in two steps: picking is public and reversible
 * (everyone watches the avatars move between answers, which is the whole conversation this
 * card is meant to start), validating is what actually counts and can't be taken back.
 *
 * It can be folded down to a pill to look at the table underneath, but it never closes on
 * its own — the guess is blocking the showdown, so losing track of it would strand everyone.
 */
export function GuessVoteModal({ gate, cardName, targetName, players, myPlayerId }: Props) {
  const [minimized, setMinimized] = useState(false);
  const myPick = gate.picks[myPlayerId];
  const isCategory = gate.guessType === 'category';
  const options: (HandCategory | Rank)[] = isCategory ? [...HAND_CATEGORIES] : GUESS_RANKS;
  const label = (value: HandCategory | Rank) => (isCategory ? HAND_CATEGORY_LABELS[value as HandCategory] : rankLabel(value as Rank));
  const voters = players.filter((p) => p.id !== gate.targetPlayerId);
  const pending = voters.filter((p) => p.connected && gate.votes[p.id] === undefined && p.id !== myPlayerId);

  function pick(value: HandCategory | Rank) {
    previewGuess(isCategory ? { guessCategory: value as HandCategory } : { guessRank: value as Rank });
  }

  function validate() {
    if (myPick === undefined) return;
    submitGuess(isCategory ? { guessCategory: myPick as HandCategory } : { guessRank: myPick as Rank });
  }

  if (minimized) {
    return (
      <button type="button" className="guess-vote-pill" onClick={() => setMinimized(false)}>
        <span className="guess-vote-pill-icon" aria-hidden="true">
          🗳️
        </span>
        <span>
          {cardName ?? 'Devinette'} —{' '}
          {myPick !== undefined ? (
            <>
              votre choix : <strong>{label(myPick)}</strong>
            </>
          ) : (
            'à vous de répondre'
          )}
        </span>
        <span aria-hidden="true">▴</span>
      </button>
    );
  }

  return (
    <div className="modal-backdrop guess-vote-backdrop" onClick={() => setMinimized(true)}>
      <div className="modal-sheet guess-vote-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <div>
            {cardName && <span className="badge">{cardName}</span>}
            <h2 style={{ marginTop: '0.35rem' }}>
              {isCategory ? `Quelle catégorie de main a ${targetName} ?` : `Quel est le rang d'une des cartes de ${targetName} ?`}
            </h2>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setMinimized(true)} aria-label="Réduire pour voir la table">
            ▾
          </button>
        </div>

        <div className="guess-options" data-kind={gate.guessType}>
          {options.map((option) => {
            const backers = voters.filter((p) => gate.picks[p.id] === option);
            return (
              <button
                key={String(option)}
                type="button"
                className={`guess-option${myPick === option ? ' selected' : ''}`}
                onClick={() => pick(option)}
              >
                <span className="guess-option-label">{label(option)}</span>
                <span className="guess-option-backers">
                  {backers.map((p) => (
                    // A locked-in backer is ringed: still leaning vs. actually committed is
                    // the difference between a discussion and a decision.
                    <span key={p.id} className={`guess-backer${gate.votes[p.id] !== undefined ? ' locked' : ''}`} title={p.name}>
                      <Avatar name={p.name} color={p.colorTag} size="sm" />
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <button type="button" className="btn btn-primary btn-block btn-lg" disabled={myPick === undefined} onClick={validate}>
          {myPick === undefined ? 'Choisissez une réponse' : `Valider « ${label(myPick)} »`}
        </button>
        <p className="muted center" style={{ fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
          {pending.length > 0
            ? `Vous pouvez encore changer d'avis. En attente de ${pending.map((p) => p.name).join(', ')}.`
            : "Vous êtes le dernier à répondre : votre validation ferme la devinette."}
        </p>
      </div>
    </div>
  );
}
