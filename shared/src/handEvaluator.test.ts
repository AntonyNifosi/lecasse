import { describe, expect, it } from 'vitest';
import type { Card } from './types';
import { compareHandRank, evaluateBestHand, isPerfectTie } from './handEvaluator';

function cards(spec: string): Card[] {
  // spec like "2S 4H 9C" -> rank(2-14, T=10,J=11,Q=12,K=13,A=14) + suit(S/H/D/C)
  const rankMap: Record<string, number> = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
  return spec.split(' ').map((token) => {
    const suit = token.slice(-1) as Card['suit'];
    const rankToken = token.slice(0, -1);
    const rank = (rankMap[rankToken] ?? Number(rankToken)) as Card['rank'];
    return { rank, suit };
  });
}

describe('evaluateBestHand', () => {
  it('finds high card', () => {
    const hand = evaluateBestHand(cards('2S 5H 7D 9C JS KH 3D'));
    expect(hand.category).toBe('highCard');
    expect(hand.tiebreakers).toEqual([13, 11, 9, 7, 5]);
  });

  it('finds a pair', () => {
    const hand = evaluateBestHand(cards('4S 4H 7D 9C JS KH 2D'));
    expect(hand.category).toBe('pair');
    expect(hand.tiebreakers).toEqual([4, 13, 11, 9]);
  });

  it('finds two pair', () => {
    const hand = evaluateBestHand(cards('4S 4H 9D 9C JS KH 2D'));
    expect(hand.category).toBe('twoPair');
    expect(hand.tiebreakers).toEqual([9, 4, 13]);
  });

  it('finds three of a kind', () => {
    const hand = evaluateBestHand(cards('4S 4H 4D 9C JS KH 2D'));
    expect(hand.category).toBe('trips');
    expect(hand.tiebreakers).toEqual([4, 13, 11]);
  });

  it('finds a straight', () => {
    const hand = evaluateBestHand(cards('5S 6H 7D 8C 9S KH 2D'));
    expect(hand.category).toBe('straight');
    expect(hand.tiebreakers).toEqual([9]);
  });

  it('finds the wheel straight (A-2-3-4-5, ace plays low)', () => {
    const hand = evaluateBestHand(cards('AS 2H 3D 4C 5S KH 9D'));
    expect(hand.category).toBe('straight');
    expect(hand.tiebreakers).toEqual([5]);
  });

  it('finds a flush', () => {
    const hand = evaluateBestHand(cards('2S 5S 7S 9S JS KH 3D'));
    expect(hand.category).toBe('flush');
    expect(hand.tiebreakers).toEqual([11, 9, 7, 5, 2]);
  });

  it('finds a full house', () => {
    const hand = evaluateBestHand(cards('6S 6H 6D 9C 9S KH 2D'));
    expect(hand.category).toBe('fullHouse');
    expect(hand.tiebreakers).toEqual([6, 9]);
  });

  it('finds four of a kind', () => {
    const hand = evaluateBestHand(cards('6S 6H 6D 6C 9S KH 2D'));
    expect(hand.category).toBe('quads');
    expect(hand.tiebreakers).toEqual([6, 13]);
  });

  it('finds a straight flush', () => {
    const hand = evaluateBestHand(cards('5S 6S 7S 8S 9S KH 2D'));
    expect(hand.category).toBe('straightFlush');
    expect(hand.tiebreakers).toEqual([9]);
  });

  it('finds a royal flush', () => {
    const hand = evaluateBestHand(cards('AS KS QS JS TS 2H 3D'));
    expect(hand.category).toBe('royalFlush');
    expect(hand.tiebreakers).toEqual([14]);
  });

  it('ranks a full house above a straight flush is false — straight flush must win', () => {
    const straightFlush = evaluateBestHand(cards('5S 6S 7S 8S 9S 2H 3D'));
    const fullHouse = evaluateBestHand(cards('6S 6H 6D 9C 9S 2H 3D'));
    expect(compareHandRank(straightFlush, fullHouse)).toBeGreaterThan(0);
  });

  it('detects a perfect tie between two players sharing an identical best hand, and ranks a third above them via kicker', () => {
    // Shared community cards: pair of 2s, an ace, a 7, and an irrelevant 3.
    const community = cards('2S 2H 7C AD 3S');
    const p1 = evaluateBestHand([...community, ...cards('TH 4D')]); // pair of 2s, kickers A-10-7
    const p2 = evaluateBestHand([...community, ...cards('TC 6S')]); // same best five as p1
    const p3 = evaluateBestHand([...community, ...cards('JS 5D')]); // pair of 2s, kickers A-J-7 (beats p1/p2)
    const p4 = evaluateBestHand([...community, ...cards('AS AC')]); // trip aces + pair of 2s = full house

    expect(isPerfectTie(p1, p2)).toBe(true);
    expect(compareHandRank(p3, p1)).toBeGreaterThan(0);
    expect(compareHandRank(p3, p2)).toBeGreaterThan(0);
    expect(compareHandRank(p4, p3)).toBeGreaterThan(0);
  });
});
