import {
  ALARMS_TO_LOSE,
  BASE_HOLE_CARDS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROUND_ORDER,
  VAULTS_TO_WIN,
  compareHandRank,
  evaluateBestHand,
  getCardById,
  type ActiveCardState,
  type BonusMalusCard,
  type Card,
  type GuessGate,
  type HandCategory,
  type HandEvaluation,
  type Rank,
  type RoundColor,
  type RoundTokens,
  type ShowdownState,
} from '@thegang/shared';
import { createShuffledDeck } from './deck';
import { GameError } from './errors';
import { pickRandom, shuffle } from './random';
import { getPlayer, requireHost } from './rooms';
import type { InternalGameState, InternalPlayer, RoomInternal, SideEffect } from './roomTypes';

// Our analog to the real game's Effraction n°1 "Ouverture facile" (skip the 1st round's
// tokens) — excluded from Pro/Gangster's pool, same as in the official rules for those modes.
const HARD_MODE_EXCLUDED_CARD_ID = 'vigile-zele';

function nextRoundColor(color: RoundColor): RoundColor | null {
  const idx = ROUND_ORDER.indexOf(color);
  return idx < ROUND_ORDER.length - 1 ? ROUND_ORDER[idx + 1] : null;
}

function isRoundActive(cardDefs: BonusMalusCard[], round: RoundColor): boolean {
  return !cardDefs.some((cd) => cd.effect.kind === 'skipRoundTokens' && cd.effect.round === round);
}

function emptyRoundTokens(color: RoundColor, starsAvailable: number[], active: boolean): RoundTokens {
  const holderByStars: Record<number, string | null> = {};
  for (const s of starsAvailable) holderByStars[s] = null;
  return { color, active, starsAvailable: active ? starsAvailable : [], holderByStars, lockedStars: [], history: [] };
}

function requireGame(room: RoomInternal): InternalGameState {
  if (!room.game) throw new GameError('INVALID_STATE', "La partie n'a pas encore commencé.");
  return room.game;
}

function activeCardDefs(game: InternalGameState): BonusMalusCard[] {
  return game.activeCards.map((ac) => getCardById(ac.cardId)).filter((c): c is BonusMalusCard => !!c);
}

function neighbor(room: RoomInternal, playerId: string, direction: 'left' | 'right'): InternalPlayer {
  const idx = room.players.findIndex((p) => p.id === playerId);
  const n = room.players.length;
  const delta = direction === 'right' ? 1 : -1;
  return room.players[(idx + delta + n) % n];
}

function hasSharedRank(cards: Card[]): boolean {
  const seen = new Set<number>();
  for (const c of cards) {
    if (seen.has(c.rank)) return true;
    seen.add(c.rank);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Heist lifecycle
// ---------------------------------------------------------------------------

export function startGame(room: RoomInternal, playerId: string): SideEffect[] {
  requireHost(room, playerId);
  if (room.status !== 'lobby') throw new GameError('INVALID_STATE', 'La partie a déjà commencé.');
  if (room.players.length < MIN_PLAYERS) {
    throw new GameError('NOT_ENOUGH_PLAYERS', `Il faut au moins ${MIN_PLAYERS} joueurs pour lancer une partie.`);
  }
  if (room.players.length > MAX_PLAYERS) {
    throw new GameError('TOO_MANY_PLAYERS', `Pas plus de ${MAX_PLAYERS} joueurs par partie.`);
  }

  const mode = room.settings.mode;
  const enabled = room.settings.enabledCardIds
    .map((id) => getCardById(id))
    .filter((c): c is BonusMalusCard => !!c);
  const excludeInHardModes = mode === 'pro' || mode === 'gangster';
  const malusPool = enabled
    .filter((c) => c.kind === 'malus' && !(excludeInHardModes && c.id === HARD_MODE_EXCLUDED_CARD_ID))
    .map((c) => c.id);
  const bonusPool = mode === 'gangster' ? [] : enabled.filter((c) => c.kind === 'bonus').map((c) => c.id);
  room.cardPools = { malusQueue: shuffle(malusPool), bonusQueue: shuffle(bonusPool) };
  room.proPermanentCard = null;
  room.gangsterSlots = [];

  // Both drawn out of the queue permanently (not recycled to the back) — they're sitting
  // active on the table, not available to be redrawn, exactly like the physical cards.
  if (mode === 'pro' && room.cardPools.malusQueue.length > 0) {
    const cardId = room.cardPools.malusQueue.shift() as string;
    const def = getCardById(cardId);
    if (def) room.proPermanentCard = { cardId, kind: def.kind };
  }
  if (mode === 'gangster') {
    const count = Math.min(2, room.cardPools.malusQueue.length);
    for (let i = 0; i < count; i++) {
      room.gangsterSlots.push(room.cardPools.malusQueue.shift() as string);
    }
  }

  room.status = 'playing';
  room.finalResult = null;
  return startHeist(room, computeActiveCardsForHeist(room, null));
}

/** Picks which card(s) are active for the heist about to start. `lastOutcome` is null
 * for heist 1 (no history yet to react to), matching the official rules: Avancé's normal
 * rotation only kicks in from heist 2, while Pro's permanent card and Gangster's 2 slots
 * are already live on heist 1. */
function computeActiveCardsForHeist(room: RoomInternal, lastOutcome: 'success' | 'fail' | null): ActiveCardState[] {
  const toState = (cardId: string): ActiveCardState | null => {
    const def = getCardById(cardId);
    return def ? { cardId, kind: def.kind } : null;
  };

  if (room.settings.mode === 'gangster') {
    if (lastOutcome !== null) {
      // Every heist (regardless of outcome) swaps out the oldest of the 2 active slots.
      const oldest = room.gangsterSlots.shift();
      if (oldest) room.cardPools.malusQueue.push(oldest);
      if (room.cardPools.malusQueue.length > 0) {
        const next = room.cardPools.malusQueue.shift() as string;
        room.cardPools.malusQueue.push(next);
        room.gangsterSlots.push(next);
      }
    }
    return room.gangsterSlots.map(toState).filter((c): c is ActiveCardState => !!c);
  }

  const cards: ActiveCardState[] = [];
  if (room.settings.mode === 'pro' && room.proPermanentCard) {
    cards.push(room.proPermanentCard);
  }
  if (lastOutcome !== null) {
    const pool = lastOutcome === 'success' ? room.cardPools.malusQueue : room.cardPools.bonusQueue;
    if (pool.length > 0) {
      const cardId = pool.shift() as string;
      pool.push(cardId);
      const state = toState(cardId);
      if (state) cards.push(state);
    }
  }
  return cards;
}

function startHeist(room: RoomInternal, activeCards: ActiveCardState[]): SideEffect[] {
  const cardDefs = activeCards.map((ac) => getCardById(ac.cardId)).filter((c): c is BonusMalusCard => !!c);
  const extraHoleCards = cardDefs.reduce((sum, cd) => (cd.effect.kind === 'extraHoleCard' ? sum + cd.effect.count : sum), 0);
  const holeCardsPerPlayer = BASE_HOLE_CARDS + extraHoleCards;

  const deck = createShuffledDeck();
  for (const player of room.players) {
    player.holeCards = deck.splice(0, holeCardsPerPlayer);
  }

  const n = room.players.length;
  const starsAvailable = Array.from({ length: n }, (_, i) => i + 1);
  const tokensByRound: Record<RoundColor, RoundTokens> = {
    white: emptyRoundTokens('white', starsAvailable, isRoundActive(cardDefs, 'white')),
    yellow: emptyRoundTokens('yellow', starsAvailable, true),
    orange: emptyRoundTokens('orange', starsAvailable, isRoundActive(cardDefs, 'orange')),
    red: emptyRoundTokens('red', starsAvailable, true),
  };

  const game: InternalGameState = {
    heistNumber: (room.game?.heistNumber ?? 0) + 1,
    currentRound: 'white',
    communityCards: [],
    tokensByRound,
    vaults: room.game?.vaults ?? 0,
    alarms: room.game?.alarms ?? 0,
    alarmsToLose: room.game?.alarmsToLose ?? (room.settings.mode === 'gangster' ? ALARMS_TO_LOSE - 1 : ALARMS_TO_LOSE),
    history: room.game?.history ?? [],
    activeCards,
    holeCardsPerPlayer,
    wildAdvantagePlayerId: null,
    publicInfoReveal: null,
    showdown: null,
    lastResult: null,
    deck,
    guessVotes: null,
  };
  room.game = game;

  const sideEffects: SideEffect[] = [];
  applyOnDealEffects(room, game, cardDefs, sideEffects);
  enterRound(room, game, cardDefs, sideEffects, 'white');
  return sideEffects;
}

function applyOnDealEffects(room: RoomInternal, game: InternalGameState, cardDefs: BonusMalusCard[], sideEffects: SideEffect[]): void {
  for (const cardDef of cardDefs) {
    const effect = cardDef.effect;
    switch (effect.kind) {
      case 'peekRandomPair': {
        if (room.players.length >= 2) {
          const [a, b] = shuffle(room.players).slice(0, 2);
          sideEffects.push({ type: 'privatePeek', toPlayerId: b.id, aboutPlayerId: a.id, card: pickRandom(a.holeCards) });
          sideEffects.push({ type: 'privatePeek', toPlayerId: a.id, aboutPlayerId: b.id, card: pickRandom(b.holeCards) });
        }
        break;
      }
      case 'publicInfoReveal': {
        const info: Record<string, string> = {};
        for (const p of room.players) info[p.id] = hasSharedRank(p.holeCards) ? 'Paire' : 'Non';
        game.publicInfoReveal = info;
        break;
      }
      case 'extraCommunityPeek': {
        const target = pickRandom(room.players);
        const turnCard = game.deck[3]; // 0,1,2 = flop (drawn later), 3 = turn card
        if (turnCard) {
          sideEffects.push({
            type: 'privateInfo',
            toPlayerId: target.id,
            message: 'Vous découvrez en avance la carte du 3e tour (le Turn).',
            card: turnCard,
          });
        }
        break;
      }
      case 'passCardToNeighbor': {
        const gifts = room.players.map((p) => ({ from: p, card: pickRandom(p.holeCards) }));
        for (const { from, card } of gifts) {
          from.holeCards = from.holeCards.filter((c) => c !== card);
        }
        for (const { from, card } of gifts) {
          neighbor(room, from.id, effect.direction).holeCards.push(card);
        }
        break;
      }
      case 'swapHandWithNeighbor': {
        const assignments = room.players.map((p) => ({
          recipientId: neighbor(room, p.id, effect.direction).id,
          hand: p.holeCards,
        }));
        for (const { recipientId, hand } of assignments) {
          getPlayer(room, recipientId).holeCards = hand;
        }
        break;
      }
      case 'wildAdvantage': {
        game.wildAdvantagePlayerId = pickRandom(room.players).id;
        break;
      }
      default:
        break;
    }
  }
}

function applyOnFlopEffects(room: RoomInternal, game: InternalGameState, cardDefs: BonusMalusCard[], sideEffects: SideEffect[]): void {
  for (const cardDef of cardDefs) {
    if (cardDef.effect.kind !== 'forceRedraw') continue;
    const { condition, targetSelector } = cardDef.effect;
    const flop = game.communityCards.slice(0, 3);
    const conditionMet = condition === 'flopHasPair' && hasSharedRank(flop);
    if (!conditionMet) continue;

    const holderId = game.tokensByRound[targetSelector.round].holderByStars[targetSelector.stars];
    if (!holderId) continue;
    const player = getPlayer(room, holderId);
    const count = player.holeCards.length;
    player.holeCards = game.deck.splice(0, count);
    sideEffects.push({ type: 'privateInfo', toPlayerId: player.id, message: 'Le Mouchard vous a fait défausser et repiocher vos cartes personnelles.' });
  }
}

function drawCommunity(game: InternalGameState, count: number): void {
  game.communityCards.push(...game.deck.splice(0, count));
}

function enterRound(room: RoomInternal, game: InternalGameState, cardDefs: BonusMalusCard[], sideEffects: SideEffect[], color: RoundColor): void {
  if (color === 'yellow') {
    drawCommunity(game, 3);
    applyOnFlopEffects(room, game, cardDefs, sideEffects);
  }
  if (color === 'orange' || color === 'red') {
    drawCommunity(game, 1);
  }

  const rs = game.tokensByRound[color];
  if (rs.active) {
    game.currentRound = color;
    return;
  }
  const next = nextRoundColor(color);
  if (next) enterRound(room, game, cardDefs, sideEffects, next);
  else beginShowdown(room, game, cardDefs);
}

function maybeAdvanceRound(room: RoomInternal, game: InternalGameState, cardDefs: BonusMalusCard[], sideEffects: SideEffect[]): void {
  const color = game.currentRound;
  if (color === 'showdown' || color === 'result') return;
  const rs = game.tokensByRound[color];
  const complete = rs.starsAvailable.every((s) => rs.holderByStars[s] !== null);
  if (!complete) return;
  const next = nextRoundColor(color);
  if (next) enterRound(room, game, cardDefs, sideEffects, next);
  else beginShowdown(room, game, cardDefs);
}

function beginShowdown(room: RoomInternal, game: InternalGameState, cardDefs: BonusMalusCard[]): void {
  const redRound = game.tokensByRound.red;
  const order = [...redRound.starsAvailable].sort((a, b) => a - b).map((s) => redRound.holderByStars[s] as string);

  const guessGates: GuessGate[] = [];
  if (order.length > 0) {
    for (const cardDef of cardDefs) {
      if (cardDef.effect.kind === 'blindGuessGate') {
        guessGates.push({
          guessType: cardDef.effect.guess,
          targetPlayerId: order[order.length - 1],
          resolved: false,
          correct: null,
          finalGuess: null,
        });
      }
    }
  }
  game.guessVotes = guessGates.length > 0 ? {} : null;
  game.showdown = { order, revealed: [], failed: false, guessGates };
  game.currentRound = 'showdown';
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export function takeToken(room: RoomInternal, playerId: string, stars: number): SideEffect[] {
  const game = requireGame(room);
  if (game.currentRound === 'showdown' || game.currentRound === 'result') {
    throw new GameError('INVALID_STATE', "Ce n'est pas le moment de prendre un jeton.");
  }
  const rs = game.tokensByRound[game.currentRound];
  if (!rs.active) throw new GameError('ROUND_INACTIVE', 'Ce tour est désactivé pour ce braquage.');
  if (!rs.starsAvailable.includes(stars)) throw new GameError('TOKEN_UNAVAILABLE', "Ce jeton n'existe pas dans cette partie.");
  if (rs.holderByStars[stars] === playerId) return [];
  if (rs.lockedStars.includes(stars)) throw new GameError('TOKEN_LOCKED', 'Ce jeton est verrouillé.');

  const seized = rs.holderByStars[stars];
  if (seized) rs.history.push({ stars, playerId: seized, action: 'release' });

  for (const s of rs.starsAvailable) {
    if (rs.holderByStars[s] === playerId) {
      rs.history.push({ stars: s, playerId, action: 'release' });
      rs.holderByStars[s] = null;
    }
  }
  rs.holderByStars[stars] = playerId;
  rs.history.push({ stars, playerId, action: 'take' });

  const cardDefs = activeCardDefs(game);
  for (const cardDef of cardDefs) {
    if (cardDef.effect.kind === 'lockTokens' && (cardDef.effect.rounds as RoundColor[]).includes(game.currentRound)) {
      const target = cardDef.effect.selector === 'lowest' ? Math.min(...rs.starsAvailable) : Math.max(...rs.starsAvailable);
      if (target === stars) rs.lockedStars.push(stars);
    }
  }

  const sideEffects: SideEffect[] = [];
  maybeAdvanceRound(room, game, cardDefs, sideEffects);
  return sideEffects;
}

export function releaseToken(room: RoomInternal, playerId: string): void {
  const game = requireGame(room);
  if (game.currentRound === 'showdown' || game.currentRound === 'result') {
    throw new GameError('INVALID_STATE', "Ce n'est pas le moment de relâcher un jeton.");
  }
  const rs = game.tokensByRound[game.currentRound];
  const currentStar = rs.starsAvailable.find((s) => rs.holderByStars[s] === playerId);
  if (currentStar === undefined) return;
  if (rs.lockedStars.includes(currentStar)) throw new GameError('TOKEN_LOCKED', 'Ce jeton est verrouillé.');
  rs.holderByStars[currentStar] = null;
  rs.history.push({ stars: currentStar, playerId, action: 'release' });
}

// ---------------------------------------------------------------------------
// Showdown
// ---------------------------------------------------------------------------

function compareForShowdownOrder(curr: { hand: HandEvaluation; isWild: boolean }, prev: { hand: HandEvaluation; isWild: boolean }): number {
  if (curr.hand.categoryRank !== prev.hand.categoryRank) return curr.hand.categoryRank - prev.hand.categoryRank;
  if (curr.isWild && !prev.isWild) return 1;
  if (prev.isWild && !curr.isWild) return -1;
  return compareHandRank(curr.hand, prev.hand);
}

export function revealNext(room: RoomInternal): void {
  const game = requireGame(room);
  if (game.currentRound !== 'showdown' || !game.showdown) {
    throw new GameError('INVALID_STATE', "Ce n'est pas le moment de révéler une main.");
  }
  const sd = game.showdown;
  const idx = sd.revealed.length;
  if (idx >= sd.order.length) throw new GameError('INVALID_STATE', 'Toutes les mains ont déjà été révélées.');
  const revealPlayerId = sd.order[idx];

  if (sd.guessGates.some((g) => g.targetPlayerId === revealPlayerId && !g.resolved)) {
    throw new GameError('GUESS_PENDING', "Le groupe doit d'abord deviner avant cette révélation.");
  }

  const player = getPlayer(room, revealPlayerId);
  const hand = evaluateBestHand([...player.holeCards, ...game.communityCards]);
  const isWild = game.wildAdvantagePlayerId === revealPlayerId;
  const previous = sd.revealed[sd.revealed.length - 1];
  const orderOk =
    !previous ||
    compareForShowdownOrder({ hand, isWild }, { hand: previous.hand, isWild: game.wildAdvantagePlayerId === previous.playerId }) >= 0;

  sd.revealed.push({ playerId: revealPlayerId, stars: idx + 1, holeCards: player.holeCards, hand, orderOk });
  if (!orderOk) sd.failed = true;

  if (sd.revealed.length === sd.order.length) resolveHeist(room, game);
}

function resolveHeist(room: RoomInternal, game: InternalGameState): void {
  const sd = game.showdown as ShowdownState;
  const outcome: 'success' | 'fail' = sd.failed ? 'fail' : 'success';
  if (outcome === 'success') game.vaults += 1;
  else game.alarms += 1;

  game.history.push({ heistNumber: game.heistNumber, outcome, activeCardIds: game.activeCards.map((c) => c.cardId) });
  game.lastResult = { outcome };
  game.currentRound = 'result';

  if (game.vaults >= VAULTS_TO_WIN) {
    room.status = 'ended';
    room.finalResult = 'win';
  } else if (game.alarms >= game.alarmsToLose) {
    room.status = 'ended';
    room.finalResult = 'lose';
  }
}

/** Majority wins; ties are broken at random among the tied choices, so the outcome
 * never quietly favors whoever happened to vote first. */
function tallyVotes<T extends string | number>(votes: T[]): T {
  const counts = new Map<T, number>();
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
  const max = Math.max(...counts.values());
  const topChoices = [...counts.entries()].filter(([, c]) => c === max).map(([choice]) => choice);
  return topChoices.length === 1 ? topChoices[0] : pickRandom(topChoices);
}

export function submitGuess(room: RoomInternal, playerId: string, guessCategory?: HandCategory, guessRank?: Rank): void {
  const game = requireGame(room);
  const sd = game.showdown;
  if (game.currentRound !== 'showdown' || !sd || !game.guessVotes) {
    throw new GameError('INVALID_STATE', "Aucune devinette n'est attendue actuellement.");
  }
  const guessType: 'category' | 'rank' = guessCategory !== undefined ? 'category' : 'rank';
  const gate = sd.guessGates.find((g) => g.guessType === guessType && !g.resolved);
  if (!gate) throw new GameError('INVALID_STATE', "Aucune devinette n'est attendue actuellement.");
  if (playerId === gate.targetPlayerId) throw new GameError('GUESS_NOT_ALLOWED', 'La personne concernée ne peut pas deviner pour elle-même.');

  const vote = guessType === 'category' ? guessCategory : guessRank;
  if (vote === undefined) throw new GameError('INVALID_STATE', 'Devinette invalide.');

  if (!game.guessVotes[guessType]) game.guessVotes[guessType] = {};
  const votesForType = game.guessVotes[guessType] as Record<string, HandCategory | Rank>;
  votesForType[playerId] = vote;

  // Every player except the target gets a vote — a player may change their mind and
  // vote again before the group's answer is locked in. Only tally once everyone (still
  // just the ones already revealed, since the target is always last) has voted.
  const eligibleVoters = room.players.filter((p) => p.id !== gate.targetPlayerId);
  const allVoted = eligibleVoters.every((p) => votesForType[p.id] !== undefined);
  if (!allVoted) return;

  const finalGuess = tallyVotes(Object.values(votesForType));
  const target = getPlayer(room, gate.targetPlayerId);
  const correct =
    guessType === 'category'
      ? finalGuess === evaluateBestHand([...target.holeCards, ...game.communityCards]).category
      : target.holeCards.some((c) => c.rank === finalGuess);

  gate.finalGuess = finalGuess;
  gate.resolved = true;
  gate.correct = correct;
  if (!correct) sd.failed = true;
}

// ---------------------------------------------------------------------------
// Between heists
// ---------------------------------------------------------------------------

export function nextHeist(room: RoomInternal): SideEffect[] {
  if (room.status !== 'playing') throw new GameError('INVALID_STATE', "La partie n'est pas en cours.");
  const game = requireGame(room);
  if (game.currentRound !== 'result') throw new GameError('INVALID_STATE', "Le braquage précédent n'est pas terminé.");

  const lastOutcome = game.history[game.history.length - 1]?.outcome ?? null;
  return startHeist(room, computeActiveCardsForHeist(room, lastOutcome));
}

export function rematch(room: RoomInternal): void {
  if (room.status !== 'ended') throw new GameError('INVALID_STATE', "La partie n'est pas terminée.");
  room.status = 'lobby';
  room.game = null;
  room.finalResult = null;
  room.cardPools = { malusQueue: [], bonusQueue: [] };
  room.proPermanentCard = null;
  room.gangsterSlots = [];
}
