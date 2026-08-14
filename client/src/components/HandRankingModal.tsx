import { HAND_CATEGORIES } from '@thegang/shared';
import { HAND_CATEGORY_LABELS } from '../theme';

const DESCRIPTIONS: Record<string, string> = {
  highCard: 'Aucune combinaison : la carte la plus haute compte.',
  pair: 'Deux cartes de même rang.',
  twoPair: 'Deux paires de rangs différents.',
  trips: 'Trois cartes de même rang.',
  straight: 'Cinq rangs qui se suivent, peu importe la couleur.',
  flush: 'Cinq cartes de la même couleur, sans suite.',
  fullHouse: 'Un brelan plus une paire.',
  quads: 'Quatre cartes de même rang.',
  straightFlush: 'Cinq rangs qui se suivent, dans la même couleur.',
  royalFlush: '10-J-Q-K-A dans la même couleur : la meilleure main possible.',
};

interface Props {
  onClose: () => void;
}

export function HandRankingModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>Classement des mains</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="muted">De la plus faible à la plus forte.</p>
        <div className="stack" style={{ marginTop: '0.75rem' }}>
          {HAND_CATEGORIES.map((cat, i) => (
            <div key={cat} className="row card-flat">
              <span className="badge">{i + 1}</span>
              <div>
                <div style={{ fontWeight: 700 }}>{HAND_CATEGORY_LABELS[cat]}</div>
                <div className="muted">{DESCRIPTIONS[cat]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
