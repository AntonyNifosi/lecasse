import type { TokenHistoryEntry } from '@thegang/shared';

// Thresholds are counted against RoundTokens.history, which the server already resets at
// the start of every round — so these levels naturally clear on their own, no expiry logic needed.
export const CONTESTED_TOKEN_THRESHOLD = 3; // # of 'take' entries on one star this round
export const HYPERACTIVE_PLAYER_THRESHOLD = 4; // # of take+release entries by one player this round

export function contestedStars(history: TokenHistoryEntry[]): Set<number> {
  const takes = new Map<number, number>();
  for (const e of history) {
    if (e.action === 'take') takes.set(e.stars, (takes.get(e.stars) ?? 0) + 1);
  }
  const result = new Set<number>();
  for (const [stars, count] of takes) {
    if (count >= CONTESTED_TOKEN_THRESHOLD) result.add(stars);
  }
  return result;
}

export function hyperactivePlayers(history: TokenHistoryEntry[]): Set<string> {
  const counts = new Map<string, number>();
  for (const e of history) counts.set(e.playerId, (counts.get(e.playerId) ?? 0) + 1);
  const result = new Set<string>();
  for (const [playerId, count] of counts) {
    if (count >= HYPERACTIVE_PLAYER_THRESHOLD) result.add(playerId);
  }
  return result;
}
