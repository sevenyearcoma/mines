import type { ConnectedPlayer } from "./types.js";

// Single-slot FIFO. One player waits at a time; the next one to join pairs.
// Keeping it dead simple — there's no skill matching, no time-based widening,
// just first-come-first-served. Easy to swap for a real queue later.
let waiting: ConnectedPlayer | null = null;

export function isWaiting(userId: string): boolean {
  return waiting?.handle.id === userId;
}

/**
 * Either pair with the currently-waiting player or take the waiting slot.
 * Returns a pair when matched, null when the caller is now waiting.
 *
 * Self-pairing is impossible: if the same user is already in the slot
 * (e.g. they opened two tabs), we replace the slot with the newest socket
 * but don't return a pair.
 */
export function enqueueOrPair(
  player: ConnectedPlayer,
): [ConnectedPlayer, ConnectedPlayer] | null {
  if (waiting && waiting.handle.id !== player.handle.id) {
    const other = waiting;
    waiting = null;
    return [other, player];
  }
  // Either no one waiting, or same user reconnecting — take the slot.
  waiting = player;
  player.inQueue = true;
  return null;
}

export function leaveQueue(userId: string): void {
  if (waiting?.handle.id === userId) {
    waiting.inQueue = false;
    waiting = null;
  }
}
