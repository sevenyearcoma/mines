// Direct-match invite tokens. A player generates a token, shares the URL,
// and the recipient redeems it to bypass regular queue matchmaking.

import { randomUUID } from "node:crypto";
import type { ConnectedPlayer } from "./types.js";

const INVITE_TTL_MS = 10 * 60 * 1000; // 10 minutes.
const INVITE_TOKEN_BYTES = 16;

interface PendingInvite {
  token: string;
  inviterUserId: string;
  targetUserId?: string;
  expiresAt: number;
  expireTimer: NodeJS.Timeout;
}

const invites = new Map<string, PendingInvite>();
// Reverse index so a player can have at most one active invite at a time.
const inviteByInviter = new Map<string, PendingInvite>();

export interface InviteSnapshot {
  token: string;
  ttlMs: number;
  targetUserId?: string;
}

function snapshotInvite(invite: PendingInvite): InviteSnapshot {
  return {
    token: invite.token,
    ttlMs: Math.max(0, invite.expiresAt - Date.now()),
    targetUserId: invite.targetUserId,
  };
}

export function createInvite(
  player: ConnectedPlayer,
  targetUserId?: string,
): InviteSnapshot {
  // Cancel any prior outstanding invite from this user.
  const prior = inviteByInviter.get(player.handle.id);
  if (prior) {
    clearTimeout(prior.expireTimer);
    invites.delete(prior.token);
    inviteByInviter.delete(player.handle.id);
  }

  const token = randomUUID().replace(/-/g, "").slice(0, INVITE_TOKEN_BYTES * 2);
  const expiresAt = Date.now() + INVITE_TTL_MS;
  const invite: PendingInvite = {
    token,
    inviterUserId: player.handle.id,
    targetUserId,
    expiresAt,
    expireTimer: setTimeout(() => {
      invites.delete(token);
      inviteByInviter.delete(player.handle.id);
    }, INVITE_TTL_MS),
  };
  invites.set(token, invite);
  inviteByInviter.set(player.handle.id, invite);
  return snapshotInvite(invite);
}

export type ConsumeResult =
  | { ok: true; inviterUserId: string }
  | { ok: false; code: "expired"; message: string }
  | { ok: false; code: "self_invite"; message: string };

export function consumeInvite(
  token: string,
  joinerUserId: string,
): ConsumeResult {
  const invite = invites.get(token);
  if (!invite) {
    return {
      ok: false,
      code: "expired",
      message: "That invite link is no longer valid.",
    };
  }
  if (invite.inviterUserId === joinerUserId) {
    return {
      ok: false,
      code: "self_invite",
      message: "You can't accept your own invite.",
    };
  }
  // One-shot consumption: clear before returning so a double click can't
  // race two matches into existence.
  clearTimeout(invite.expireTimer);
  invites.delete(invite.token);
  inviteByInviter.delete(invite.inviterUserId);
  return { ok: true, inviterUserId: invite.inviterUserId };
}

export function readInvite(
  token: string,
  joinerUserId: string,
): ConsumeResult {
  const invite = invites.get(token);
  if (!invite) {
    return {
      ok: false,
      code: "expired",
      message: "That invite link is no longer valid.",
    };
  }
  if (invite.inviterUserId === joinerUserId) {
    return {
      ok: false,
      code: "self_invite",
      message: "You can't accept your own invite.",
    };
  }
  return { ok: true, inviterUserId: invite.inviterUserId };
}

export function getInviteByInviter(userId: string): InviteSnapshot | null {
  const invite = inviteByInviter.get(userId);
  if (!invite) return null;
  return snapshotInvite(invite);
}

// Used by the disconnect path. If the player drops, their invite is stale.
export function cancelInviteByUser(userId: string): void {
  const prior = inviteByInviter.get(userId);
  if (!prior) return;
  clearTimeout(prior.expireTimer);
  invites.delete(prior.token);
  inviteByInviter.delete(userId);
}
