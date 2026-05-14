"use client";

import { create } from "zustand";
import type { RoundConfig } from "@/lib/engine";
import type { BoardSnapshot } from "@/game/bridge";
import type {
  MatchEndPayload,
  MatchStartPayload,
  PlayerHandle,
  RoundEndPayload,
  ScoreSnapshot,
} from "@/lib/multiplayer/protocol";

export type MatchLobbyStatus =
  | "idle"
  | "searching"
  | "in_match"
  | "complete";

export interface MatchSnapshot {
  matchId: string;
  players: [PlayerHandle, PlayerHandle];
  youAre: 0 | 1;
  baseConfig: MatchStartPayload["baseConfig"];
  roundIndex: number;             // current round (or last round on complete)
  roundsWon: [number, number];
  roundWinners: (0 | 1 | null)[]; // index → winner per finished round
  winner: 0 | 1 | null;
  endReason: "score" | "forfeit" | null;
}

interface MatchStore {
  status: MatchLobbyStatus;
  snapshot: MatchSnapshot | null;
  /** Current round to load into Phaser. Null between rounds / before match. */
  currentRound: RoundConfig | null;
  /** Most recent round-end payload (drives the result overlay). */
  lastRoundEnd: RoundEndPayload | null;
  /** Live ticking opponent score during the active round. */
  opponentLive: ScoreSnapshot | null;
  /** Error surface — server-rejected handshake, replaced session, etc. */
  errorMessage: string | null;
  /**
   * When non-null, the local player is spectating the opponent's live board
   * because their own run for this round has ended (exploded/timeout).
   */
  spectating: { opponentName: string } | null;
  /** Frozen snapshot of your own board at the moment your run ended. */
  ownDeadSnapshot: BoardSnapshot | null;

  setSearching: () => void;
  setIdle: () => void;
  setError: (message: string) => void;
  clearError: () => void;
  applyMatchStart: (p: MatchStartPayload) => void;
  setCurrentRound: (config: RoundConfig | null) => void;
  setOpponentLive: (snap: ScoreSnapshot | null) => void;
  setSpectating: (s: { opponentName: string } | null) => void;
  setOwnDeadSnapshot: (snap: BoardSnapshot | null) => void;
  applyRoundEnd: (p: RoundEndPayload) => void;
  applyMatchEnd: (p: MatchEndPayload) => void;
  reset: () => void;
}

const INITIAL = {
  status: "idle" as MatchLobbyStatus,
  snapshot: null,
  currentRound: null,
  lastRoundEnd: null,
  opponentLive: null,
  errorMessage: null,
  spectating: null,
  ownDeadSnapshot: null,
};

export const useMatchStore = create<MatchStore>((set) => ({
  ...INITIAL,

  setSearching: () =>
    set({ status: "searching", errorMessage: null, lastRoundEnd: null }),

  setIdle: () => set({ status: "idle", errorMessage: null }),

  setError: (message) => set({ errorMessage: message, status: "idle" }),

  clearError: () => set({ errorMessage: null }),

  applyMatchStart: (p) =>
    set({
      status: "in_match",
      snapshot: {
        matchId: p.matchId,
        players: p.players,
        youAre: p.youAre,
        baseConfig: p.baseConfig,
        roundIndex: 0,
        roundsWon: [0, 0],
        roundWinners: [],
        winner: null,
        endReason: null,
      },
      currentRound: null,
      lastRoundEnd: null,
      opponentLive: null,
      errorMessage: null,
      spectating: null,
      ownDeadSnapshot: null,
    }),

  setCurrentRound: (config) =>
    set((state) => {
      const next: Partial<MatchStore> = {
        currentRound: config,
        lastRoundEnd: null,
        opponentLive: null,
        // Each new round starts fresh — clear last round's spectator state.
        spectating: null,
        ownDeadSnapshot: null,
      };
      // Keep the snapshot's idea of "where we are" in sync with the round
      // the server just delivered, otherwise the round badge lags by one.
      if (config && state.snapshot) {
        next.snapshot = {
          ...state.snapshot,
          roundIndex: config.roundIndex ?? state.snapshot.roundIndex,
        };
      }
      return next;
    }),

  setOpponentLive: (snap) => set({ opponentLive: snap }),

  setSpectating: (s) => set({ spectating: s }),

  setOwnDeadSnapshot: (snap) => set({ ownDeadSnapshot: snap }),

  applyRoundEnd: (p) =>
    set((state) => {
      if (!state.snapshot) return {};
      const roundWinners = [...state.snapshot.roundWinners];
      roundWinners[p.roundIndex] = p.winner;
      return {
        snapshot: {
          ...state.snapshot,
          roundIndex: p.roundIndex,
          roundsWon: p.roundsWon,
          roundWinners,
        },
        lastRoundEnd: p,
        // The round is fully over — drop spectator overlay and snapshot.
        spectating: null,
        ownDeadSnapshot: null,
      };
    }),

  applyMatchEnd: (p) =>
    set((state) => {
      if (!state.snapshot) return { status: "complete" };
      return {
        status: "complete",
        snapshot: {
          ...state.snapshot,
          roundsWon: p.roundsWon,
          winner: p.winner,
          endReason: p.reason,
        },
      };
    }),

  reset: () => set({ ...INITIAL }),
}));
