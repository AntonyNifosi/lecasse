import type { Card } from '@thegang/shared';
import { rankLabel, SUIT_IS_RED, SUIT_SYMBOLS } from '../theme';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  large?: boolean;
}

export function PlayingCard({ card, faceDown, large }: PlayingCardProps) {
  if (!card || faceDown) {
    return <div className={`playing-card face-down${large ? ' large' : ''}`} aria-hidden="true" />;
  }
  const isRed = SUIT_IS_RED[card.suit];
  return (
    <div className={`playing-card${isRed ? ' red' : ''}${large ? ' large' : ''}`}>
      <span>{rankLabel(card.rank)}</span>
      <span>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}
