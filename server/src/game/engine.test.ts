import { beforeEach, describe, expect, it } from 'vitest';
import { VAULTS_TO_WIN } from '@thegang/shared';
import type { Card } from '@thegang/shared';
import { createShuffledDeck } from './deck';
import * as engine from './engine';
import { GameError } from './errors';
import * as rooms from './rooms';
import type { RoomInternal } from './roomTypes';

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** Overwrites the hole cards + upcoming community cards right after a heist has been
 * dealt, so showdown outcomes are deterministic instead of depending on the real shuffle. */
function forceDeal(room: RoomInternal, hands: Card[][], community: Card[]): void {
  room.players.forEach((p, i) => {
    p.holeCards = hands[i];
  });
  const used = [...hands.flat(), ...community];
  const filler = createShuffledDeck().filter((c) => !used.some((u) => sameCard(u, c)));
  room.game!.deck = [...community, ...filler];
}

function claimRound(room: RoomInternal, assignment: { playerId: string; stars: number }[]): void {
  for (const { playerId, stars } of assignment) {
    engine.takeToken(room, playerId, stars);
  }
}

/** Fast-forwards white/yellow/orange with an arbitrary (non-scoring) assignment, leaving
 * the red round open so the test can set up the showdown order it wants to verify. */
function fastForwardToRedRound(room: RoomInternal, playerIds: string[]): void {
  const arbitrary = playerIds.map((playerId, i) => ({ playerId, stars: i + 1 }));
  for (let i = 0; i < 3; i++) {
    if (room.game!.currentRound === 'red') return;
    if (!room.game!.tokensByRound[room.game!.currentRound as 'white' | 'yellow' | 'orange'].active) continue;
    claimRound(room, arbitrary);
  }
}

const WEAK_HAND = [card(4, 'H'), card(5, 'D')]; // pair of 2s, kickers Q-9-5
const WEAK_HAND_TIED = [card(4, 'D'), card(5, 'S')]; // different cards, same resulting best five as WEAK_HAND
const MID_HAND = [card(4, 'S'), card(6, 'D')]; // pair of 2s, kickers Q-9-6 (beats WEAK)
const STRONG_HAND = [card(13, 'S'), card(13, 'D')]; // two pair (K's and 2's)
const COMMUNITY = [card(2, 'S'), card(2, 'H'), card(9, 'D'), card(12, 'C'), card(3, 'S')];

describe('engine — full heist flow', () => {
  let room: RoomInternal;
  let alice: string;
  let bob: string;
  let carol: string;

  beforeEach(() => {
    const created = rooms.createRoom('Alice', '#f00');
    room = created.room;
    alice = created.player.id;
    bob = rooms.joinRoom(room, 'Bob', '#0f0').id;
    carol = rooms.joinRoom(room, 'Carol', '#00f').id;
  });

  it('succeeds when red tokens are handed out weakest to strongest', () => {
    engine.startGame(room, alice);
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);

    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);
    expect(room.game!.currentRound).toBe('showdown');

    engine.revealNext(room); // alice
    engine.revealNext(room); // bob
    engine.revealNext(room); // carol -> resolves the heist

    expect(room.game!.showdown!.failed).toBe(false);
    expect(room.game!.showdown!.revealed.every((r) => r.orderOk)).toBe(true);
    expect(room.game!.vaults).toBe(1);
    expect(room.game!.alarms).toBe(0);
    expect(room.game!.currentRound).toBe('result');
  });

  it('fails and flags the exact violation when a red token is out of order', () => {
    engine.startGame(room, alice);
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);

    // Carol (strongest) is given the weakest token by mistake.
    claimRound(room, [
      { playerId: carol, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: alice, stars: 3 },
    ]);

    engine.revealNext(room); // carol (strongest hand) revealed first — fine on its own
    engine.revealNext(room); // bob — weaker than carol -> violation
    expect(room.game!.showdown!.revealed[1].orderOk).toBe(false);

    engine.revealNext(room); // alice — resolves the heist
    expect(room.game!.showdown!.failed).toBe(true);
    expect(room.game!.alarms).toBe(1);
    expect(room.game!.vaults).toBe(0);
  });

  it('does not fault a perfect tie between two players regardless of their relative order', () => {
    engine.startGame(room, alice);
    // Alice and Bob hold different cards but end up with the exact same best-five; Carol is clearly stronger.
    forceDeal(room, [WEAK_HAND, WEAK_HAND_TIED, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);

    // Bob (tied with Alice) is placed above Alice even though their hands are identical.
    claimRound(room, [
      { playerId: bob, stars: 1 },
      { playerId: alice, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);

    engine.revealNext(room);
    engine.revealNext(room);
    engine.revealNext(room);

    expect(room.game!.showdown!.revealed.every((r) => r.orderOk)).toBe(true);
    expect(room.game!.showdown!.failed).toBe(false);
    expect(room.game!.vaults).toBe(1);
  });

  it('token rules: retaking moves ownership, and a player can only hold one token per round', () => {
    engine.startGame(room, alice);
    engine.takeToken(room, alice, 1);
    engine.takeToken(room, bob, 1); // steals it from alice
    const rs = room.game!.tokensByRound.white;
    expect(rs.holderByStars[1]).toBe(bob);
    expect(rs.starsAvailable.every((s) => rs.holderByStars[s] !== alice || s === 1)).toBe(true);

    engine.takeToken(room, alice, 2);
    expect(rs.holderByStars[2]).toBe(alice);
    expect(() => engine.takeToken(room, alice, 99)).toThrow(GameError);
  });

  it('rejects starting a game with too few players', () => {
    const solo = rooms.createRoom('Solo', '#000');
    expect(() => engine.startGame(solo.room, solo.player.id)).toThrow(GameError);
  });
});

describe('engine — bonus/malus cards', () => {
  let room: RoomInternal;
  let alice: string;
  let bob: string;
  let carol: string;

  beforeEach(() => {
    const created = rooms.createRoom('Alice', '#f00');
    room = created.room;
    alice = created.player.id;
    bob = rooms.joinRoom(room, 'Bob', '#0f0').id;
    carol = rooms.joinRoom(room, 'Carol', '#00f').id;
  });

  function winFirstHeist(cardId: string) {
    rooms.toggleCard(room, alice, cardId, true);
    engine.startGame(room, alice);
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);
    engine.revealNext(room);
    engine.revealNext(room);
    engine.revealNext(room);
    expect(room.game!.vaults).toBe(1);
  }

  function loseFirstHeist(cardId: string) {
    rooms.toggleCard(room, alice, cardId, true);
    engine.startGame(room, alice);
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    // scrambled on purpose: carol (strongest) gets the weakest token.
    claimRound(room, [
      { playerId: carol, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: alice, stars: 3 },
    ]);
    engine.revealNext(room);
    engine.revealNext(room);
    engine.revealNext(room);
    expect(room.game!.alarms).toBe(1);
  }

  it('"jetons collés" locks the lowest white token the moment it is claimed', () => {
    winFirstHeist('jetons-colles');
    engine.nextHeist(room);
    expect(room.game!.activeCard?.cardId).toBe('jetons-colles');

    engine.takeToken(room, alice, 1);
    expect(() => engine.takeToken(room, bob, 1)).toThrow(GameError);
    expect(() => engine.releaseToken(room, alice)).toThrow(GameError);

    // Unlocked stars still behave normally and the round can complete.
    engine.takeToken(room, bob, 2);
    engine.takeToken(room, carol, 3);
    expect(room.game!.currentRound).toBe('yellow');
  });

  it('"vigile zélé" skips the white token round entirely and jumps straight to the flop', () => {
    winFirstHeist('vigile-zele');
    engine.nextHeist(room);
    expect(room.game!.activeCard?.cardId).toBe('vigile-zele');
    expect(room.game!.tokensByRound.white.active).toBe(false);
    expect(room.game!.tokensByRound.white.starsAvailable).toEqual([]);
    expect(room.game!.currentRound).toBe('yellow');
    expect(room.game!.communityCards).toHaveLength(3);
  });

  it('"mouchard" forces a redraw for the white 1-star holder when the flop has a pair', () => {
    winFirstHeist('mouchard');
    engine.nextHeist(room);
    expect(room.game!.activeCard?.cardId).toBe('mouchard');

    const pairedFlopCommunity = [card(7, 'S'), card(7, 'H'), card(9, 'D'), card(2, 'C'), card(4, 'S')];
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], pairedFlopCommunity);
    const aliceOriginalHand = room.players.find((p) => p.id === alice)!.holeCards;

    engine.takeToken(room, alice, 1);
    engine.takeToken(room, bob, 2);
    engine.takeToken(room, carol, 3); // completes white -> auto-advances into yellow, revealing the paired flop

    expect(room.game!.currentRound).toBe('yellow');
    const aliceNewHand = room.players.find((p) => p.id === alice)!.holeCards;
    expect(aliceNewHand).not.toEqual(aliceOriginalHand);
  });

  it('"faveur du parrain" lets its holder win same-category ties at showdown', () => {
    loseFirstHeist('faveur-du-parrain');
    engine.nextHeist(room);
    const wildId = room.game!.wildAdvantagePlayerId;
    expect(wildId).toBeTruthy();
    const others = [alice, bob, carol].filter((id) => id !== wildId);

    // The wildcard holder gets the weaker of two pairs; without the bonus, ordering them
    // above the other pair-holder would be a mistake.
    const handByPlayer: Record<string, Card[]> = {
      [wildId as string]: WEAK_HAND,
      [others[0]]: MID_HAND,
      [others[1]]: STRONG_HAND,
    };
    forceDeal(
      room,
      [alice, bob, carol].map((id) => handByPlayer[id]),
      COMMUNITY,
    );
    fastForwardToRedRound(room, [alice, bob, carol]);

    claimRound(room, [
      { playerId: others[0], stars: 1 },
      { playerId: wildId as string, stars: 2 },
      { playerId: others[1], stars: 3 },
    ]);

    engine.revealNext(room);
    engine.revealNext(room);
    engine.revealNext(room);

    expect(room.game!.showdown!.revealed.every((r) => r.orderOk)).toBe(true);
    expect(room.game!.vaults).toBe(1);
  });

  it('"alarme silencieuse" gates the top red token behind a guess, and fails the heist on a wrong guess even when token order is correct', () => {
    winFirstHeist('alarme-silencieuse');
    engine.nextHeist(room);
    expect(room.game!.activeCard?.cardId).toBe('alarme-silencieuse');

    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 }, // carol (two pair) is correctly the strongest -> the guess target
    ]);

    expect(room.game!.showdown!.guessGate).toMatchObject({ guessType: 'category', targetPlayerId: carol, resolved: false });

    engine.revealNext(room); // alice
    engine.revealNext(room); // bob
    expect(() => engine.revealNext(room)).toThrow(GameError); // carol is gated until the group guesses

    engine.submitGuess(room, alice, 'trips'); // wrong — carol actually has two pair
    expect(room.game!.showdown!.guessGate!.correct).toBe(false);

    engine.revealNext(room); // carol, now unblocked
    expect(room.game!.showdown!.revealed[2].orderOk).toBe(true); // the token order itself was correct
    expect(room.game!.showdown!.failed).toBe(true); // but the wrong guess fails the heist regardless
    expect(room.game!.alarms).toBe(1);
  });

  it('rejects a guess submitted by the target themselves', () => {
    winFirstHeist('alarme-silencieuse');
    engine.nextHeist(room);
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);
    engine.revealNext(room);
    engine.revealNext(room);
    expect(() => engine.submitGuess(room, carol, 'twoPair')).toThrow(GameError);
  });
});

describe('rooms — joining between games', () => {
  let room: RoomInternal;
  let alice: string;
  let bob: string;
  let carol: string;

  beforeEach(() => {
    const created = rooms.createRoom('Alice', '#f00');
    room = created.room;
    alice = created.player.id;
    bob = rooms.joinRoom(room, 'Bob', '#0f0').id;
    carol = rooms.joinRoom(room, 'Carol', '#00f').id;
  });

  it('rejects joining while a heist is in progress', () => {
    engine.startGame(room, alice);
    expect(room.status).toBe('playing');
    expect(() => rooms.joinRoom(room, 'Dave', '#ff0')).toThrow(GameError);
  });

  it('allows joining once the match has ended, and folds the newcomer into the rematch', () => {
    engine.startGame(room, alice);
    room.game!.vaults = VAULTS_TO_WIN - 1; // this heist's win ends the match
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);
    engine.revealNext(room);
    engine.revealNext(room);
    engine.revealNext(room);
    expect(room.status).toBe('ended');
    expect(room.finalResult).toBe('win');

    const dave = rooms.joinRoom(room, 'Dave', '#ff0');
    expect(room.players.map((p) => p.id)).toContain(dave.id);

    engine.rematch(room);
    expect(room.status).toBe('lobby');
    expect(room.players).toHaveLength(4);
  });
});

describe('engine — token history', () => {
  let room: RoomInternal;
  let alice: string;
  let bob: string;
  let carol: string;

  beforeEach(() => {
    const created = rooms.createRoom('Alice', '#f00');
    room = created.room;
    alice = created.player.id;
    bob = rooms.joinRoom(room, 'Bob', '#0f0').id;
    carol = rooms.joinRoom(room, 'Carol', '#00f').id;
    engine.startGame(room, alice);
  });

  function whiteHistory() {
    return room.game!.tokensByRound.white.history;
  }

  it('logs a take', () => {
    engine.takeToken(room, alice, 1);
    expect(whiteHistory()).toEqual([{ stars: 1, playerId: alice, action: 'take' }]);
  });

  it('logs a release for the old star and a take for the new one when switching', () => {
    engine.takeToken(room, alice, 1);
    engine.takeToken(room, alice, 2);
    expect(whiteHistory()).toEqual([
      { stars: 1, playerId: alice, action: 'take' },
      { stars: 1, playerId: alice, action: 'release' },
      { stars: 2, playerId: alice, action: 'take' },
    ]);
  });

  it('logs a release for whoever gets seized when another player grabs their star', () => {
    engine.takeToken(room, alice, 1);
    engine.takeToken(room, bob, 1);
    expect(whiteHistory()).toEqual([
      { stars: 1, playerId: alice, action: 'take' },
      { stars: 1, playerId: alice, action: 'release' },
      { stars: 1, playerId: bob, action: 'take' },
    ]);
    expect(room.game!.tokensByRound.white.holderByStars[1]).toBe(bob);
  });

  it('logs an explicit release', () => {
    engine.takeToken(room, alice, 1);
    engine.releaseToken(room, alice);
    expect(whiteHistory()).toEqual([
      { stars: 1, playerId: alice, action: 'take' },
      { stars: 1, playerId: alice, action: 'release' },
    ]);
    expect(room.game!.tokensByRound.white.holderByStars[1]).toBeNull();
  });

  it('does not log anything for a no-op take of an already-held star', () => {
    engine.takeToken(room, alice, 1);
    engine.takeToken(room, alice, 1);
    expect(whiteHistory()).toEqual([{ stars: 1, playerId: alice, action: 'take' }]);
  });

  it('keeps each round its own separate history', () => {
    engine.takeToken(room, alice, 1);
    engine.takeToken(room, bob, 2);
    engine.takeToken(room, carol, 3);
    expect(room.game!.currentRound).toBe('yellow');
    expect(whiteHistory()).toHaveLength(3);
    expect(room.game!.tokensByRound.yellow.history).toEqual([]);
  });
});
