import type { ConnectedPlayer, MatchSession } from "./types.js";

const players = new Map<string, ConnectedPlayer>();   // keyed by userId
const matches = new Map<string, MatchSession>();      // keyed by matchId

export function getPlayer(userId: string): ConnectedPlayer | undefined {
  return players.get(userId);
}

export function setPlayer(player: ConnectedPlayer): void {
  players.set(player.handle.id, player);
}

export function removePlayer(userId: string): void {
  players.delete(userId);
}

export function eachPlayer(): IterableIterator<ConnectedPlayer> {
  return players.values();
}

export function getMatch(matchId: string): MatchSession | undefined {
  return matches.get(matchId);
}

export function setMatch(match: MatchSession): void {
  matches.set(match.id, match);
}

export function removeMatch(matchId: string): void {
  matches.delete(matchId);
}
