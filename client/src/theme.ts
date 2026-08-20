import type { Card } from '@thegang/shared';

export const AVATAR_COLORS = [
  '#e0575b', // rouge
  '#e0a83e', // ambre
  '#d9c94a', // jaune
  '#6bb26a', // vert
  '#4fa7c9', // bleu
  '#8b7ae0', // violet
  '#e07ac0', // rose
  '#9a9a9a', // gris
] as const;

export const ROUND_LABELS: Record<'white' | 'yellow' | 'orange' | 'red', string> = {
  white: 'Pré-flop',
  yellow: 'Flop',
  orange: 'Turn',
  red: 'Rivière',
};

export const ROUND_TOKEN_COLOR: Record<'white' | 'yellow' | 'orange' | 'red', string> = {
  white: '#e9e6da',
  yellow: '#e0c23e',
  orange: '#e08a3e',
  red: '#c94f4f',
};

export const HAND_CATEGORY_LABELS: Record<string, string> = {
  highCard: 'Carte haute',
  pair: 'Paire',
  twoPair: 'Double paire',
  trips: 'Brelan',
  straight: 'Quinte',
  flush: 'Couleur',
  fullHouse: 'Full',
  quads: 'Carré',
  straightFlush: 'Quinte flush',
  royalFlush: 'Quinte flush royale',
};

/** The same categories, short enough to sit on one line inside a guess-board tile — the
 * tiles are about 3 --tsz wide at six players, where "Quinte flush royale" would wrap to
 * three lines and blow the grid's row height. Nothing rides on the abbreviation alone: each
 * tile shows an example hand underneath, and the Valider button spells the choice out in
 * full before it's committed. */
export const HAND_CATEGORY_SHORT: Record<string, string> = {
  highCard: 'Haute',
  pair: 'Paire',
  twoPair: '2 paires',
  trips: 'Brelan',
  straight: 'Quinte',
  flush: 'Couleur',
  fullHouse: 'Full',
  quads: 'Carré',
  straightFlush: 'Q. flush',
  royalFlush: 'Q. royale',
};

/** A small illustrative hand for each category, shown on the guess board so a category
 * reads as a shape of cards rather than a word to translate — real ranks/suits, but not
 * drawn from the actual deck in play. Each uses exactly the number of cards that defines
 * the category (2 for a pair, 5 for a flush, etc.), so the picture is never misleading. */
export const HAND_CATEGORY_EXAMPLE: Record<string, Card[]> = {
  highCard: [
    { rank: 14, suit: 'S' },
    { rank: 13, suit: 'D' },
    { rank: 9, suit: 'C' },
  ],
  pair: [
    { rank: 8, suit: 'S' },
    { rank: 8, suit: 'H' },
  ],
  twoPair: [
    { rank: 8, suit: 'S' },
    { rank: 8, suit: 'H' },
    { rank: 12, suit: 'D' },
    { rank: 12, suit: 'C' },
  ],
  trips: [
    { rank: 5, suit: 'S' },
    { rank: 5, suit: 'H' },
    { rank: 5, suit: 'D' },
  ],
  straight: [
    { rank: 6, suit: 'S' },
    { rank: 7, suit: 'H' },
    { rank: 8, suit: 'D' },
    { rank: 9, suit: 'C' },
    { rank: 10, suit: 'S' },
  ],
  flush: [
    { rank: 3, suit: 'H' },
    { rank: 7, suit: 'H' },
    { rank: 9, suit: 'H' },
    { rank: 11, suit: 'H' },
    { rank: 14, suit: 'H' },
  ],
  fullHouse: [
    { rank: 9, suit: 'S' },
    { rank: 9, suit: 'H' },
    { rank: 9, suit: 'D' },
    { rank: 4, suit: 'S' },
    { rank: 4, suit: 'H' },
  ],
  quads: [
    { rank: 11, suit: 'S' },
    { rank: 11, suit: 'H' },
    { rank: 11, suit: 'D' },
    { rank: 11, suit: 'C' },
  ],
  straightFlush: [
    { rank: 6, suit: 'H' },
    { rank: 7, suit: 'H' },
    { rank: 8, suit: 'H' },
    { rank: 9, suit: 'H' },
    { rank: 10, suit: 'H' },
  ],
  royalFlush: [
    { rank: 10, suit: 'S' },
    { rank: 11, suit: 'S' },
    { rank: 12, suit: 'S' },
    { rank: 13, suit: 'S' },
    { rank: 14, suit: 'S' },
  ],
};

export const RANK_LABELS: Record<number, string> = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank);
}

export const SUIT_SYMBOLS: Record<'S' | 'H' | 'D' | 'C', string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

export const SUIT_IS_RED: Record<'S' | 'H' | 'D' | 'C', boolean> = {
  S: false,
  H: true,
  D: true,
  C: false,
};
