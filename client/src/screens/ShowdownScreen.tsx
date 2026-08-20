import { getCardById, ROUND_ORDER, type GuessGate, type HandCategory, type Rank } from '@thegang/shared';
import { revealNext, submitGuess } from '../actions';
import { EmotePicker } from '../components/EmotePicker';
import { GameMenu } from '../components/GameMenu';
import { GuessBoard } from '../components/GuessBoard';
import { PlayingCard } from '../components/PlayingCard';
import { Table } from '../components/Table';
import { TokenStars } from '../components/TokenStars';
import { useGameState } from '../state/GameContext';
import { HAND_CATEGORY_LABELS, ROUND_TOKEN_COLOR, rankLabel } from '../theme';

function guessLabel(guessType: 'category' | 'rank', value: HandCategory | Rank): string {
  return guessType === 'category' ? HAND_CATEGORY_LABELS[value as HandCategory] : rankLabel(value as Rank);
}

interface Props {
  onContinue?: () => void;
}

export function ShowdownScreen({ onContinue }: Props) {
  const { room, myPlayerId, emotes } = useGameState();
  const game = room?.game;
  const sd = game?.showdown;

  if (!room || !game || !sd) return null;

  const nextIndex = sd.revealed.length;
  const allRevealed = nextIndex >= sd.order.length;
  const nextPlayerId = sd.order[nextIndex];
  const nextPlayer = room.players.find((p) => p.id === nextPlayerId);
  const gatesForTarget = sd.guessGates.filter((g) => g.targetPlayerId === nextPlayerId);
  const pendingGates = gatesForTarget.filter((g) => !g.resolved);
  const gateBlocking = pendingGates.length > 0;
  // The next player to reveal is also the one every open guess is about — they never vote.
  const iAmNext = nextPlayerId === myPlayerId;
  // One board at a time: with two malus cards in play the second guess gate opens as soon as
  // the first is validated, rather than stacking two boards on top of each other.
  const myOpenGate = myPlayerId && !iAmNext ? pendingGates.find((g) => g.votes[myPlayerId] === undefined) : undefined;
  // What the felt shows: whichever gate I still need to decide, or — once I'm done, or for
  // the target who never votes — the first one still open, so there's always something to
  // watch rather than the board just vanishing the moment my own part is finished.
  const displayGate = myOpenGate ?? pendingGates[0];

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
          {/* Swaps to the open guess's own question — more useful right then than the
              generic subtitle, and the page header has none of the felt's space limits. */}
          {displayGate ? (
            <p className="muted">
              {gateCardName(displayGate) && <span className="badge">{gateCardName(displayGate)}</span>}{' '}
              {displayGate.guessType === 'category' ? `Quelle main a ${nextPlayer?.name ?? '?'} ?` : `Quel rang chez ${nextPlayer?.name ?? '?'} ?`}
            </p>
          ) : (
            <p className="muted">Du jeton le moins étoilé au plus étoilé.</p>
          )}
        </div>
        <EmotePicker />
        <GameMenu />
      </div>

      <Table
        players={room.players}
        myPlayerId={myPlayerId}
        emotes={emotes}
        highlightPlayerId={allRevealed ? null : nextPlayerId}
        // Trades width for height while the vote is open: the board is narrower than a card
        // row, which is what lets it clear the seats out on the rail and start level with
        // them instead of below them (see tableGeometry's CENTER_W/centerTop). That's the
        // difference between a 19px band and a 188px one at six players — enough for every
        // option to be on the felt at once.
        centerMode={displayGate && myPlayerId ? 'guess' : 'cards'}
        // Still replaces the community cards rather than sitting alongside them: even the
        // taller band has no room for both.
        centerContent={
          displayGate && myPlayerId ? (
            <>
              {/* The 5 cards stay on the table while the group votes — shrunk to a fixed,
                  compact size (.card-row-compact) rather than the block's own width, since
                  that width is already at its narrowest here to clear the seats. */}
              <div className="card-row card-row-compact">
                {game.communityCards.map((c, i) => (
                  <PlayingCard key={i} card={c} />
                ))}
              </div>
              <GuessBoard gate={displayGate} players={room.players} myPlayerId={myPlayerId} interactive={displayGate === myOpenGate} />
            </>
          ) : (
            <div className="card-row">
              {game.communityCards.map((c, i) => (
                <PlayingCard key={i} card={c} />
              ))}
            </div>
          )
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
        // The red token, pinned to the seat exactly as the live one is during the heist —
        // it's the token the whole abattage is about, so it stays a token here too.
        renderToken={(player) => {
          const red = game.tokensByRound.red;
          const star = red.starsAvailable.find((s) => red.holderByStars[s] === player.id);
          if (star === undefined) return null;
          return (
            <span className="token token-static" style={{ background: ROUND_TOKEN_COLOR.red, borderColor: player.colorTag }}>
              <TokenStars count={star} />
            </span>
          );
        }}
        renderBadge={(player) => (
          <div className="table-seat-badges">
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
        )}
        // Kept to a single line — seats are tight on vertical room, so this stays one row
        // however much there is to say about a player.
        renderSeatExtra={(player) => {
          const entry = sd.revealed.find((r) => r.playerId === player.id);
          const parts: string[] = [];
          if (entry) parts.push(`${entry.orderOk ? '✅' : '❌'} ${HAND_CATEGORY_LABELS[entry.hand.category]}`);

          if (gateBlocking && player.id !== nextPlayerId) {
            // While a guess is open, every voter's seat shows where they stand right now —
            // including those who have already revealed, since the whole point is watching
            // the group make up its mind. A ✓ marks an answer that's actually locked in
            // rather than still being weighed.
            parts.push(
              `🗳️ ${pendingGates
                .map((g) => {
                  const choice = g.picks[player.id];
                  if (choice === undefined) return '…';
                  return `${guessLabel(g.guessType, choice)}${g.votes[player.id] !== undefined ? ' ✓' : ''}`;
                })
                .join(' · ')}`,
            );
          } else {
            // The answers the group settled on about this player: on the target's seat right
            // after the vote closes (it used to vanish the instant the last vote landed), and
            // afterwards alongside their revealed hand, now with whether it was right.
            const answers = sd.guessGates
              .filter((g) => g.targetPlayerId === player.id && g.resolved && g.finalGuess !== null)
              .map((g) => `${guessLabel(g.guessType, g.finalGuess as HandCategory | Rank)}${entry ? (g.correct ? ' ✅' : ' ❌') : ''}`);
            if (answers.length > 0) parts.push(`🗳️ ${answers.join(' / ')}`);
          }

          return parts.length > 0 ? <span className="table-seat-showdown">{parts.join(' · ')}</span> : null;
        }}
      />

      <div className="sticky-footer stack">
        {/* The group's answer stays on screen after the vote closes, right up to the reveal
            it gated — it used to disappear the instant the last vote landed. */}
        {!allRevealed &&
          gatesForTarget
            .filter((g) => g.resolved && g.finalGuess !== null)
            .map((g) => (
              <p key={g.guessType} className="muted center" style={{ margin: 0 }}>
                <span className="badge">{gateCardName(g)}</span> Réponse du gang sur {nextPlayer?.name ?? '?'} :{' '}
                <strong style={{ color: 'var(--fg)' }}>{guessLabel(g.guessType, g.finalGuess as HandCategory | Rank)}</strong>
              </p>
            ))}

        {allRevealed ? (
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => onContinue?.()}>
            Voir le résultat du braquage
          </button>
        ) : gateBlocking ? (
          iAmNext ? (
            <p className="muted center">Le reste du gang doit deviner avant que vous ne révéliez votre main…</p>
          ) : (
            pendingGates.map((gate) => {
              const myVote = myPlayerId ? gate.votes[myPlayerId] : undefined;
              const waitingOn = room.players.filter(
                (p) => p.connected && p.id !== gate.targetPlayerId && gate.votes[p.id] === undefined,
              );
              if (myVote !== undefined) {
                return (
                  <p key={gate.guessType} className="muted center" style={{ margin: 0 }}>
                    <span className="badge">{gateCardName(gate)}</span> Vous avez validé{' '}
                    <strong style={{ color: 'var(--fg)' }}>{guessLabel(gate.guessType, myVote)}</strong>
                    {waitingOn.length > 0 && ` — en attente de ${waitingOn.map((p) => p.name).join(', ')}…`}
                  </p>
                );
              }
              // Not yet voted — only the gate currently shown on the felt gets a Valider
              // button here; a second pending gate (Gangster mode) waits its turn silently.
              if (gate !== myOpenGate || !myPlayerId) return null;
              const myPick = gate.picks[myPlayerId];
              return (
                <button
                  key={gate.guessType}
                  type="button"
                  className="btn btn-primary btn-block btn-lg"
                  disabled={myPick === undefined}
                  onClick={() => submitGuess(gate.guessType === 'category' ? { guessCategory: myPick as HandCategory } : { guessRank: myPick as Rank })}
                >
                  {myPick === undefined ? 'Choisissez sur la table' : `Valider « ${guessLabel(gate.guessType, myPick)} »`}
                </button>
              );
            })
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
