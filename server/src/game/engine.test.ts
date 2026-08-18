import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMOTE_COOLDOWN_MS, VAULTS_TO_WIN, getCardById } from '@thegang/shared';
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

    engine.revealNext(room, alice);
    engine.revealNext(room, bob);
    engine.revealNext(room, carol); // resolves the heist

    expect(room.game!.showdown!.failed).toBe(false);
    expect(room.game!.showdown!.revealed.every((r) => r.orderOk)).toBe(true);
    expect(room.game!.vaults).toBe(1);
    expect(room.game!.alarms).toBe(0);
    expect(room.game!.currentRound).toBe('result');
  });

  it('only lets the player whose turn it is reveal their hand', () => {
    engine.startGame(room, alice);
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);

    expect(() => engine.revealNext(room, bob)).toThrow(GameError);
    expect(() => engine.revealNext(room, carol)).toThrow(GameError);
    expect(room.game!.showdown!.revealed).toHaveLength(0);

    engine.revealNext(room, alice); // the actual next-in-line succeeds
    expect(room.game!.showdown!.revealed).toHaveLength(1);
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

    engine.revealNext(room, carol); // strongest hand revealed first — fine on its own
    engine.revealNext(room, bob); // weaker than carol -> violation
    expect(room.game!.showdown!.revealed[1].orderOk).toBe(false);

    engine.revealNext(room, alice); // resolves the heist
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

    engine.revealNext(room, bob);
    engine.revealNext(room, alice);
    engine.revealNext(room, carol);

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
    engine.startGame(room, alice);
    room.cardPools.malusQueue = [cardId];
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);
    engine.revealNext(room, alice);
    engine.revealNext(room, bob);
    engine.revealNext(room, carol);
    expect(room.game!.vaults).toBe(1);
  }

  function loseFirstHeist(cardId: string) {
    engine.startGame(room, alice);
    room.cardPools.bonusQueue = [cardId];
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    // scrambled on purpose: carol (strongest) gets the weakest token.
    claimRound(room, [
      { playerId: carol, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: alice, stars: 3 },
    ]);
    engine.revealNext(room, carol);
    engine.revealNext(room, bob);
    engine.revealNext(room, alice);
    expect(room.game!.alarms).toBe(1);
  }

  it('"jetons collés" locks the lowest white token the moment it is claimed', () => {
    winFirstHeist('jetons-colles');
    engine.nextHeist(room);
    expect(room.game!.activeCards.map((c) => c.cardId)).toEqual(['jetons-colles']);

    engine.takeToken(room, alice, 1);
    expect(() => engine.takeToken(room, bob, 1)).toThrow(GameError);
    expect(() => engine.releaseToken(room, alice)).toThrow(GameError);

    // Alice can't switch to a different token either — that used to silently release her
    // locked one as a side effect, leaving it marked locked with no holder (unreleasable
    // *and* untakeable — dead for the rest of the round).
    expect(() => engine.takeToken(room, alice, 2)).toThrow(GameError);
    expect(room.game!.tokensByRound.white.holderByStars[1]).toBe(alice);

    // Unlocked stars still behave normally and the round can complete.
    engine.takeToken(room, bob, 2);
    engine.takeToken(room, carol, 3);
    expect(room.game!.currentRound).toBe('yellow');
  });

  it('"vigile zélé" skips the white token round entirely and jumps straight to the flop', () => {
    winFirstHeist('vigile-zele');
    engine.nextHeist(room);
    expect(room.game!.activeCards.map((c) => c.cardId)).toEqual(['vigile-zele']);
    expect(room.game!.tokensByRound.white.active).toBe(false);
    expect(room.game!.tokensByRound.white.starsAvailable).toEqual([]);
    expect(room.game!.currentRound).toBe('yellow');
    expect(room.game!.communityCards).toHaveLength(3);
  });

  it('"mouchard" forces a redraw for the white 1-star holder when the flop has a pair', () => {
    winFirstHeist('mouchard');
    engine.nextHeist(room);
    expect(room.game!.activeCards.map((c) => c.cardId)).toEqual(['mouchard']);

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

    engine.revealNext(room, others[0]);
    engine.revealNext(room, wildId as string);
    engine.revealNext(room, others[1]);

    expect(room.game!.showdown!.revealed.every((r) => r.orderOk)).toBe(true);
    expect(room.game!.vaults).toBe(1);
  });

  it('"alarme silencieuse" gates the top red token behind a group vote, and fails the heist on a wrong majority even when token order is correct', () => {
    winFirstHeist('alarme-silencieuse');
    engine.nextHeist(room);
    expect(room.game!.activeCards.map((c) => c.cardId)).toEqual(['alarme-silencieuse']);

    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 }, // carol (two pair) is correctly the strongest -> the guess target
    ]);

    expect(room.game!.showdown!.guessGates).toMatchObject([{ guessType: 'category', targetPlayerId: carol, resolved: false }]);

    engine.revealNext(room, alice);
    engine.revealNext(room, bob);
    expect(() => engine.revealNext(room, carol)).toThrow(GameError); // carol is gated until the group votes

    engine.submitGuess(room, alice, 'trips'); // one of two votes — not enough to resolve yet
    expect(room.game!.showdown!.guessGates[0].resolved).toBe(false);
    expect(() => engine.revealNext(room, carol)).toThrow(GameError);

    engine.submitGuess(room, bob, 'trips'); // unanimous, wrong — carol actually has two pair
    expect(room.game!.showdown!.guessGates[0].resolved).toBe(true);
    expect(room.game!.showdown!.guessGates[0].finalGuess).toBe('trips');
    expect(room.game!.showdown!.guessGates[0].correct).toBe(false);

    engine.revealNext(room, carol); // now unblocked
    expect(room.game!.showdown!.revealed[2].orderOk).toBe(true); // the token order itself was correct
    expect(room.game!.showdown!.failed).toBe(true); // but the wrong guess fails the heist regardless
    expect(room.game!.alarms).toBe(1);
  });

  it('resolves a split vote by randomly picking among the tied choices', () => {
    winFirstHeist('alarme-silencieuse');
    engine.nextHeist(room);
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);
    engine.revealNext(room, alice);
    engine.revealNext(room, bob);

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9); // picks the 2nd of the 2 tied choices
    try {
      engine.submitGuess(room, alice, 'trips');
      engine.submitGuess(room, bob, 'twoPair'); // 1-1 tie between 'trips' and 'twoPair'
    } finally {
      randomSpy.mockRestore();
    }

    expect(room.game!.showdown!.guessGates[0].finalGuess).toBe('twoPair');
    expect(room.game!.showdown!.guessGates[0].correct).toBe(true); // 'twoPair' happens to be carol's real hand
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
    engine.revealNext(room, alice);
    engine.revealNext(room, bob);
    expect(() => engine.submitGuess(room, carol, 'twoPair')).toThrow(GameError);
  });

  it('unblocks a stuck vote once every remaining voter has dropped out, instead of waiting forever', () => {
    winFirstHeist('alarme-silencieuse');
    engine.nextHeist(room);
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);
    engine.revealNext(room, alice);
    engine.revealNext(room, bob);

    engine.submitGuess(room, alice, 'trips'); // bob is the only voter left; he never answers
    rooms.markDisconnected(room, bob);
    expect(room.game!.showdown!.guessGates[0].resolved).toBe(false); // still waiting on refresh

    engine.refreshGuessGates(room);
    expect(room.game!.showdown!.guessGates[0].resolved).toBe(true);
    expect(room.game!.showdown!.guessGates[0].finalGuess).toBe('trips'); // alice's lone vote stands
    engine.revealNext(room, carol); // no longer stuck
  });

  it('skips a guess with no vote at all, rather than failing the heist on it', () => {
    winFirstHeist('alarme-silencieuse');
    engine.nextHeist(room);
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);
    engine.revealNext(room, alice);
    engine.revealNext(room, bob);

    rooms.markDisconnected(room, alice);
    rooms.markDisconnected(room, bob);
    engine.refreshGuessGates(room);

    expect(room.game!.showdown!.guessGates[0].resolved).toBe(true);
    expect(room.game!.showdown!.guessGates[0].correct).toBe(true); // no one left to be wrong
    engine.revealNext(room, carol);
    expect(room.game!.showdown!.failed).toBe(false);
  });
});

describe('rooms — emotes', () => {
  let room: RoomInternal;
  let alice: string;
  let bob: string;

  beforeEach(() => {
    const created = rooms.createRoom('Alice', '#f00');
    room = created.room;
    alice = created.player.id;
    bob = rooms.joinRoom(room, 'Bob', '#0f0').id;
  });

  it('rejects a second emote from the same player within the cooldown window', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      rooms.sendEmote(room, alice, 'wahou');
      expect(() => rooms.sendEmote(room, alice, 'content')).toThrow(GameError);

      // Someone else is never blocked by alice's own cooldown.
      expect(() => rooms.sendEmote(room, bob, 'wahou')).not.toThrow();

      nowSpy.mockReturnValue(1_000_000 + EMOTE_COOLDOWN_MS - 1);
      expect(() => rooms.sendEmote(room, alice, 'content')).toThrow(GameError);

      nowSpy.mockReturnValue(1_000_000 + EMOTE_COOLDOWN_MS);
      expect(() => rooms.sendEmote(room, alice, 'content')).not.toThrow();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('rejects an emote id that is not in the known set', () => {
    expect(() => rooms.sendEmote(room, alice, 'not-a-real-emote')).toThrow(GameError);
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
    engine.revealNext(room, alice);
    engine.revealNext(room, bob);
    engine.revealNext(room, carol);
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

describe('engine — Pro mode', () => {
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
    rooms.setMode(room, alice, 'pro');
  });

  function winHeist() {
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);
    engine.revealNext(room, alice);
    engine.revealNext(room, bob);
    engine.revealNext(room, carol);
  }

  it('keeps one malus card permanently active from heist 1, and adds the normal rotation on top from heist 2', () => {
    engine.startGame(room, alice);

    expect(room.game!.activeCards).toHaveLength(1);
    expect(getCardById(room.game!.activeCards[0].cardId)?.kind).toBe('malus');

    // Re-pin to a non-gate card before playing out the heist — the random draw above could
    // otherwise land on "alarme-silencieuse"/"coffre-double-fond", whose guess-gate winHeist()
    // doesn't submit a vote for, which would make this test flaky.
    room.proPermanentCard = { cardId: 'jetons-colles', kind: 'malus' };
    room.game!.activeCards = [room.proPermanentCard];
    const permanentId = 'jetons-colles';

    winHeist();
    engine.nextHeist(room);

    expect(room.game!.activeCards).toHaveLength(2);
    expect(room.game!.activeCards.every((c) => c.kind === 'malus')).toBe(true);
    expect(room.game!.activeCards.some((c) => c.cardId === permanentId)).toBe(true);
  });

  it('excludes "vigile-zele" from the pool, same as the real Effraction n°1', () => {
    engine.startGame(room, alice);
    const allMalusInPlay = [
      ...(room.proPermanentCard ? [room.proPermanentCard.cardId] : []),
      ...room.cardPools.malusQueue,
    ];
    expect(allMalusInPlay).not.toContain('vigile-zele');
    expect(room.game!.tokensByRound.white.active).toBe(true);
  });
});

describe('engine — Gangster mode', () => {
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
    rooms.setMode(room, alice, 'gangster');
  });

  function winHeist() {
    forceDeal(room, [WEAK_HAND, MID_HAND, STRONG_HAND], COMMUNITY);
    fastForwardToRedRound(room, [alice, bob, carol]);
    claimRound(room, [
      { playerId: alice, stars: 1 },
      { playerId: bob, stars: 2 },
      { playerId: carol, stars: 3 },
    ]);
    engine.revealNext(room, alice);
    engine.revealNext(room, bob);
    engine.revealNext(room, carol);
  }

  it('runs 2 malus cards at once from heist 1, never a bonus, and lowers the losing threshold to 2 alarms', () => {
    engine.startGame(room, alice);
    expect(room.game!.activeCards).toHaveLength(2);
    expect(room.game!.activeCards.every((c) => c.kind === 'malus')).toBe(true);
    expect(room.game!.alarmsToLose).toBe(2);

    // Re-pin to 2 non-gate cards before playing out the heist — the random draw above could
    // otherwise land on "alarme-silencieuse"/"coffre-double-fond", whose guess-gate winHeist()
    // doesn't submit a vote for, which would make this test flaky.
    room.gangsterSlots = ['jetons-colles', 'reperage-laser'];
    room.game!.activeCards = room.gangsterSlots.map((id) => ({ cardId: id, kind: getCardById(id)!.kind }));

    winHeist(); // the outcome doesn't gate Gangster's rotation, only vaults/alarms
    engine.nextHeist(room);
    expect(room.game!.activeCards).toHaveLength(2);
    expect(room.game!.activeCards.every((c) => c.kind === 'malus')).toBe(true);
  });

  it('swaps out the oldest of the 2 slots for the next queued card each heist', () => {
    engine.startGame(room, alice);
    // Pin the 2 starting slots (instead of the random draw from the full pool) so the
    // rotation below is deterministic and can't collide with the seeded queue card.
    room.gangsterSlots = ['jetons-colles', 'reperage-laser'];
    room.game!.activeCards = room.gangsterSlots.map((id) => ({ cardId: id, kind: getCardById(id)!.kind }));
    // Seed a 3rd card into the queue so the next rotation pulls in something genuinely
    // new instead of immediately re-drawing the card that just rotated out.
    room.cardPools.malusQueue = ['mouchard'];
    const initial = [...room.game!.activeCards.map((c) => c.cardId)];

    winHeist();
    engine.nextHeist(room);

    const after = room.game!.activeCards.map((c) => c.cardId);
    expect(after).toHaveLength(2);
    expect(after).toContain(initial[1]); // the newest of the original pair survives
    expect(after).toContain('mouchard'); // the queued card rotates in
    expect(after).not.toContain(initial[0]); // the oldest was swapped out
  });
});
