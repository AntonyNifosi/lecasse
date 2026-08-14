import { HAND_CATEGORIES, type Card, type HandCategory, type HandEvaluation, type Rank } from './types';

function combinations<T>(arr: T[], k: number): T[][] {
  const results: T[][] = [];
  const combo: T[] = [];
  function backtrack(start: number) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }
  backtrack(0);
  return results;
}

interface FiveCardRank {
  category: HandCategory;
  categoryRank: number;
  tiebreakers: Rank[];
}

function rankFiveCards(cards: Card[]): FiveCardRank {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const uniqueRanksDesc = Array.from(new Set(ranks)).sort((a, b) => b - a);
  let straightHigh: number | null = null;
  if (uniqueRanksDesc.length === 5) {
    if (uniqueRanksDesc[0] - uniqueRanksDesc[4] === 4) {
      straightHigh = uniqueRanksDesc[0];
    } else if (uniqueRanksDesc.join(',') === '14,5,4,3,2') {
      straightHigh = 5; // wheel: A-2-3-4-5, ace plays low
    }
  }
  const isStraight = straightHigh !== null;

  const freq = new Map<number, number>();
  for (const r of ranks) freq.set(r, (freq.get(r) ?? 0) + 1);
  // group by count desc, then rank desc — this ordering already yields kickers
  // in the correct comparison order for every category below.
  const groups = Array.from(freq.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const pattern = groups.map((g) => g[1]);

  if (isStraight && isFlush) {
    const category: HandCategory = straightHigh === 14 ? 'royalFlush' : 'straightFlush';
    return { category, categoryRank: HAND_CATEGORIES.indexOf(category), tiebreakers: [straightHigh as Rank] };
  }
  if (pattern[0] === 4) {
    return {
      category: 'quads',
      categoryRank: HAND_CATEGORIES.indexOf('quads'),
      tiebreakers: [groups[0][0] as Rank, groups[1][0] as Rank],
    };
  }
  if (pattern[0] === 3 && pattern[1] === 2) {
    return {
      category: 'fullHouse',
      categoryRank: HAND_CATEGORIES.indexOf('fullHouse'),
      tiebreakers: [groups[0][0] as Rank, groups[1][0] as Rank],
    };
  }
  if (isFlush) {
    return { category: 'flush', categoryRank: HAND_CATEGORIES.indexOf('flush'), tiebreakers: ranks as Rank[] };
  }
  if (isStraight) {
    return {
      category: 'straight',
      categoryRank: HAND_CATEGORIES.indexOf('straight'),
      tiebreakers: [straightHigh as Rank],
    };
  }
  if (pattern[0] === 3) {
    const kickers = groups.slice(1).map((g) => g[0] as Rank);
    return { category: 'trips', categoryRank: HAND_CATEGORIES.indexOf('trips'), tiebreakers: [groups[0][0] as Rank, ...kickers] };
  }
  if (pattern[0] === 2 && pattern[1] === 2) {
    return {
      category: 'twoPair',
      categoryRank: HAND_CATEGORIES.indexOf('twoPair'),
      tiebreakers: [groups[0][0] as Rank, groups[1][0] as Rank, groups[2][0] as Rank],
    };
  }
  if (pattern[0] === 2) {
    const kickers = groups.slice(1).map((g) => g[0] as Rank);
    return { category: 'pair', categoryRank: HAND_CATEGORIES.indexOf('pair'), tiebreakers: [groups[0][0] as Rank, ...kickers] };
  }
  return { category: 'highCard', categoryRank: HAND_CATEGORIES.indexOf('highCard'), tiebreakers: ranks as Rank[] };
}

/** Compares two evaluations: >0 if a is stronger, <0 if b is stronger, 0 if strictly identical (perfect tie). */
export function compareHandRank(a: HandEvaluation, b: HandEvaluation): number {
  if (a.categoryRank !== b.categoryRank) return a.categoryRank - b.categoryRank;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/** A perfect tie (règle "égalité parfaite") is exactly a 0 from compareHandRank: every
 * comparable value (category + all kickers) matches, regardless of which concrete
 * cards produced it. */
export function isPerfectTie(a: HandEvaluation, b: HandEvaluation): boolean {
  return compareHandRank(a, b) === 0;
}

/** Best possible 5-card hand out of 5+ cards (2 hole + 5 community, or more with the "Renfort" bonus card). */
export function evaluateBestHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5) throw new Error('evaluateBestHand requires at least 5 cards');
  let best: HandEvaluation | null = null;
  for (const five of combinations(cards, 5)) {
    const ranked = rankFiveCards(five);
    const candidate: HandEvaluation = { ...ranked, bestFive: five };
    if (!best || compareHandRank(candidate, best) > 0) best = candidate;
  }
  return best as HandEvaluation;
}
