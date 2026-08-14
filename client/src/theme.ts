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
