import { VAULTS_TO_WIN, type HandCategory, type Rank } from '@thegang/shared';
import { nextHeist } from '../actions';
import { GameMenu } from '../components/GameMenu';
import { useGameState } from '../state/GameContext';
import { HAND_CATEGORY_LABELS, rankLabel } from '../theme';

function guessText(guessType: 'category' | 'rank', value: HandCategory | Rank): string {
  return guessType === 'category' ? HAND_CATEGORY_LABELS[value as HandCategory] : rankLabel(value as Rank);
}

interface Props {
  /** True once this heist has already ended the match (3rd vault or 3rd alarm). */
  final?: boolean;
  onContinue?: () => void;
}

export function HeistResultScreen({ final = false, onContinue }: Props) {
  const { room } = useGameState();
  const game = room?.game;
  if (!room || !game || !game.lastResult) return null;

  const success = game.lastResult.outcome === 'success';
  const sd = game.showdown;
  const orderBroken = sd?.revealed.some((r) => !r.orderOk) ?? false;
  const resolvedGuesses = sd?.guessGates.filter((g) => g.resolved && g.finalGuess !== null) ?? [];
  const wrongGuesses = resolvedGuesses.filter((g) => g.correct === false);

  let failureMessage = "L'ordre des jetons ne correspondait pas à la réalité.";
  if (!orderBroken && wrongGuesses.length > 0) {
    failureMessage =
      wrongGuesses.length > 1
        ? "L'ordre des jetons était le bon, mais le groupe s'est trompé dans plusieurs devinettes."
        : "L'ordre des jetons était le bon, mais le groupe s'est trompé dans sa devinette.";
  }

  return (
    <div className="screen screen-centered" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
        <GameMenu />
      </div>
      <div className="result-emoji" style={{ fontSize: '4rem' }}>
        {success ? '🏆' : '🚨'}
      </div>
      <h1 style={{ color: success ? 'var(--gold)' : 'var(--red)' }}>{success ? 'Casse réussi !' : 'Alarme déclenchée !'}</h1>
      <p className="muted">{success ? 'Le classement était le bon, un coffre est ouvert.' : failureMessage}</p>

      {/* Every guess the group had to make, right or wrong: the answer that decided the
          heist shouldn't be something you have to remember afterwards. */}
      {resolvedGuesses.map((g) => {
        const target = room.players.find((p) => p.id === g.targetPlayerId);
        return (
          <p key={g.guessType} className="muted" style={{ margin: 0 }}>
            🗳️ Devinette sur {target?.name ?? '?'} : <strong style={{ color: 'var(--fg)' }}>{guessText(g.guessType, g.finalGuess!)}</strong>{' '}
            {g.correct ? '✅' : '❌'}
          </p>
        );
      })}

      <div className="row" style={{ gap: '2rem' }}>
        <div className="stack center">
          <span className="muted">Coffres</span>
          <div className="pill-progress">
            {Array.from({ length: VAULTS_TO_WIN }, (_, i) => (
              <span key={i} className={`pill${i < game.vaults ? ' filled-gold' : ''}`} />
            ))}
          </div>
        </div>
        <div className="stack center">
          <span className="muted">Alarmes</span>
          <div className="pill-progress">
            {Array.from({ length: game.alarmsToLose }, (_, i) => (
              <span key={i} className={`pill${i < game.alarms ? ' filled-red' : ''}`} />
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        onClick={() => (final ? onContinue?.() : nextHeist())}
      >
        {final ? 'Voir le résultat final' : 'Braquage suivant'}
      </button>
    </div>
  );
}
