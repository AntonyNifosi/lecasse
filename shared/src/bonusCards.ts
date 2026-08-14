import type { HandCategory, Rank, RoundColor } from './types';

/**
 * Mechanical hooks the game engine understands. Every bonus/malus card is built
 * from one of these — new cards can be added to BONUS_MALUS_CARDS without
 * touching the engine as long as they reuse an existing effect type.
 */
export type EffectType =
  | { kind: 'skipRoundTokens'; round: Extract<RoundColor, 'white' | 'orange'> }
  | { kind: 'lockTokens'; selector: 'lowest' | 'highest'; rounds: Extract<RoundColor, 'white' | 'yellow' | 'orange'>[] }
  | { kind: 'forceRedraw'; condition: 'flopHasPair'; targetSelector: { round: Extract<RoundColor, 'white'>; stars: 1 } }
  | { kind: 'blindGuessGate'; guess: 'category' | 'rank' }
  | { kind: 'extraHoleCard'; count: number }
  | { kind: 'peekRandomPair' }
  | { kind: 'publicInfoReveal'; info: 'isPocketPair' }
  | { kind: 'extraCommunityPeek' }
  | { kind: 'passCardToNeighbor'; direction: 'right' }
  | { kind: 'swapHandWithNeighbor'; direction: 'left' }
  | { kind: 'wildAdvantage' };

export interface BonusMalusCard {
  id: string;
  kind: 'bonus' | 'malus';
  name: string;
  description: string;
  effect: EffectType;
}

/**
 * Original pack (14 cards) inspired only by the *category* of mechanism found in
 * the source game's optional module (skip a step, lock a token, force a redraw,
 * blind guess before the last reveal, peek, swap, extra card, wildcard tie-break).
 * Names, flavor text and exact parameters are our own invention.
 */
export const BONUS_MALUS_CARDS: BonusMalusCard[] = [
  // Malus — activated for the heist right after a SUCCESS (raise the difficulty)
  {
    id: 'vigile-zele',
    kind: 'malus',
    name: 'Vigile zélé',
    description:
      "Ce braquage-ci, pas de jetons blancs : les cartes personnelles sont distribuées puis vous enchaînez directement sur le Flop.",
    effect: { kind: 'skipRoundTokens', round: 'white' },
  },
  {
    id: 'faux-plafond',
    kind: 'malus',
    name: 'Faux plafond',
    description:
      "Ce braquage-ci, pas de jetons orange : la 4e carte commune est révélée puis vous enchaînez directement sur la Rivière.",
    effect: { kind: 'skipRoundTokens', round: 'orange' },
  },
  {
    id: 'jetons-colles',
    kind: 'malus',
    name: 'Jetons collés',
    description:
      "Dès que le jeton le moins étoilé des 3 premiers tours est pris, il reste bloqué chez son propriétaire pour le reste du tour.",
    effect: { kind: 'lockTokens', selector: 'lowest', rounds: ['white', 'yellow', 'orange'] },
  },
  {
    id: 'reperage-laser',
    kind: 'malus',
    name: 'Repérage laser',
    description:
      "Dès que le jeton le plus étoilé des 3 premiers tours est pris, il reste bloqué chez son propriétaire pour le reste du tour.",
    effect: { kind: 'lockTokens', selector: 'highest', rounds: ['white', 'yellow', 'orange'] },
  },
  {
    id: 'alarme-silencieuse',
    kind: 'malus',
    name: 'Alarme silencieuse',
    description:
      "Avant que le porteur du jeton rouge le plus étoilé ne révèle sa main, le reste du groupe doit deviner sa catégorie de main. Une erreur fait échouer le braquage.",
    effect: { kind: 'blindGuessGate', guess: 'category' },
  },
  {
    id: 'coffre-double-fond',
    kind: 'malus',
    name: 'Coffre à double fond',
    description:
      "Avant que le porteur du jeton rouge le plus étoilé ne révèle sa main, le reste du groupe doit deviner le rang exact de l'une de ses cartes personnelles. Une erreur fait échouer le braquage.",
    effect: { kind: 'blindGuessGate', guess: 'rank' },
  },
  {
    id: 'mouchard',
    kind: 'malus',
    name: 'Mouchard',
    description:
      "Si le Flop contient une paire, la personne qui détient le jeton blanc à 1 étoile défausse ses cartes personnelles et en repioche deux.",
    effect: { kind: 'forceRedraw', condition: 'flopHasPair', targetSelector: { round: 'white', stars: 1 } },
  },

  // Bonus — activated for the heist right after a FAILURE (ease the difficulty)
  {
    id: 'plan-vole',
    kind: 'bonus',
    name: 'Plan volé',
    description:
      "Juste après la distribution, deux membres du gang tirés au sort se montrent en secret une carte personnelle chacun.",
    effect: { kind: 'peekRandomPair' },
  },
  {
    id: 'complice-au-tableau',
    kind: 'bonus',
    name: 'Complice au tableau',
    description: "Juste après la distribution, on découvre publiquement qui a une paire de départ.",
    effect: { kind: 'publicInfoReveal', info: 'isPocketPair' },
  },
  {
    id: 'oeil-dans-les-cintres',
    kind: 'bonus',
    name: 'Œil dans les cintres',
    description: "Un membre du gang tiré au sort découvre en secret la carte du 3e tour avant tout le monde.",
    effect: { kind: 'extraCommunityPeek' },
  },
  {
    id: 'renfort',
    kind: 'bonus',
    name: 'Renfort',
    description: "Ce braquage-ci, tout le monde reçoit 3 cartes personnelles au lieu de 2.",
    effect: { kind: 'extraHoleCard', count: 1 },
  },
  {
    id: 'filature',
    kind: 'bonus',
    name: 'Filature',
    description: "Juste après la distribution, chacun donne une carte personnelle tirée au sort à la personne à sa droite.",
    effect: { kind: 'passCardToNeighbor', direction: 'right' },
  },
  {
    id: 'nouvelle-donne',
    kind: 'bonus',
    name: 'Nouvelle donne',
    description: "Juste après la distribution, toutes les mains tournent d'un cran vers la gauche : vous récupérez la main entière de la personne à votre droite.",
    effect: { kind: 'swapHandWithNeighbor', direction: 'left' },
  },
  {
    id: 'faveur-du-parrain',
    kind: 'bonus',
    name: 'Faveur du parrain',
    description: "Un membre du gang tiré au sort voit sa main l'emporter sur toute main de même catégorie à l'abattage.",
    effect: { kind: 'wildAdvantage' },
  },
];

export function getCardById(id: string): BonusMalusCard | undefined {
  return BONUS_MALUS_CARDS.find((c) => c.id === id);
}

export type { HandCategory, Rank };
