import { ALARMS_TO_LOSE, VAULTS_TO_WIN } from '@thegang/shared';
import { nextHeist } from '../actions';
import { useGameState } from '../state/GameContext';

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

  return (
    <div className="screen screen-centered">
      <div style={{ fontSize: '4rem' }}>{success ? '🏆' : '🚨'}</div>
      <h1 style={{ color: success ? 'var(--gold)' : 'var(--red)' }}>{success ? 'Casse réussi !' : 'Alarme déclenchée !'}</h1>
      <p className="muted">
        {success ? 'Le classement était le bon, un coffre est ouvert.' : "L'ordre des jetons ne correspondait pas à la réalité."}
      </p>

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
            {Array.from({ length: ALARMS_TO_LOSE }, (_, i) => (
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
