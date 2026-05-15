import type { ConnectedPlayer } from "./types.js";

// Single-slot FIFO. One player waits at a time; the next one to join pairs.
// Keeping it dead simple — there's no skill matching, no time-based widening,
// just first-come-first-served. Easy to swap for a real queue later.
let waiting: ConnectedPlayer | null = null;

function isLive(p: ConnectedPlayer | null): boolean {
  // Socket.io marks `connected = false` on dead sockets even before the
  // disconnect handler finishes. We treat anything not currently connected as
  // unmatchable so we don't pair a real player with a ghost.
  return !!p && p.socket.connected === true;
}

export function isWaiting(userId: string): boolean {
  return waiting?.handle.id === userId;
}

export function currentlyWaiting(): ConnectedPlayer | null {
  return waiting;
}

/**
 * Either pair with the currently-waiting player or take the waiting slot.
 * Returns a pair when matched, null when the caller is now waiting.
 *
 * Self-pairing is impossible: if the same user is already in the slot
 * (e.g. they opened two tabs), we replace the slot with the newest socket
 * but don't return a pair.
 *
 * Stale slot: if the waiting socket has died (e.g. they disconnected and the
 * grace timer hasn't fired yet), we drop the corpse and put the new player
 * in the slot instead of "pairing" a live player to a dead one.
 */
export function enqueueOrPair(
  player: ConnectedPlayer,
): [ConnectedPlayer, ConnectedPlayer] | null {
  if (waiting && !isLive(waiting)) {
    console.log(
      `[queue] evicting stale waiting player ${waiting.handle.name} (socket disconnected)`,
    );
    waiting.inQueue = false;
    waiting = null;
  }
  if (waiting && waiting.handle.id !== player.handle.id) {
    const other = waiting;
    waiting = null;
    other.inQueue = false;
    player.inQueue = false;
    console.log(
      `[queue] pair ${other.handle.name} ↔ ${player.handle.name}`,
    );
    return [other, player];
  }
  // Either no one waiting, or same user reconnecting — take the slot.
  waiting = player;
  player.inQueue = true;
  console.log(`[queue] waiting: ${player.handle.name}`);
  return null;
}

export function leaveQueue(userId: string): void {
  if (waiting?.handle.id === userId) {
    console.log(`[queue] leave: ${waiting.handle.name}`);
    waiting.inQueue = false;
    waiting = null;
  }
}

export function replaceQueuedPlayer(
  userId: string,
  player: ConnectedPlayer,
): void {
  if (waiting?.handle.id !== userId) return;
  console.log(`[queue] replace queued socket for ${player.handle.name}`);
  waiting.inQueue = false;
  waiting = player;
  player.inQueue = true;
}
