"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useGameStats } from "@/components/hud/useGameStats";
import { MatchHUD } from "@/components/hud/MatchHUD";
import { MatchResultOverlay } from "@/components/hud/MatchResultOverlay";
import { MiniBoard } from "@/components/hud/MiniBoard";
import { MatchDemoRecorder } from "@/components/demo/MatchDemoRecorder";
import { useMascotPose } from "@/components/mascot/MascotRail";
import { ServerStatusCard } from "@/components/multiplayer/ServerStatusCard";
import type { ConnectionState } from "@/lib/multiplayer/socket";
import { capture } from "@/lib/analytics/posthog";
import { matchDemoId } from "@/lib/demo/types";
import {
  useMultiplayerMatch,
  type ChallengeState,
  type InviteState,
} from "@/lib/multiplayer/useMultiplayerMatch";
import { fetchFriends, type FriendListEntry } from "@/lib/friends/ops";
import { countryName, flagEmoji } from "@/lib/leaderboard/country";

const PhaserGame = dynamic(() => import("@/game/PhaserGame"), {
  ssr: false,
});

// Wrap the body so useSearchParams (a client hook that needs Suspense) works
// at the page root in App Router.
export default function MatchPage() {
  return (
    <Suspense fallback={<Centered>connecting…</Centered>}>
      <MatchPageInner />
    </Suspense>
  );
}

function MatchPageInner() {
  const { user, guest, isGuest, loading, signInAsAutoGuest } = useAuth();
  const myId = user?.id ?? guest?.id ?? "";

  // First-time visitors land at /match anonymously — auto-create a guest so
  // they go straight to the lobby. They can rename via UserMenu later. Same
  // pattern protects /daily and /play implicitly (those allow null user).
  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (isGuest) return;
    signInAsAutoGuest();
  }, [loading, user, isGuest, signInAsAutoGuest]);
  const { stats } = useGameStats();
  const search = useSearchParams();
  const inviteToken = search.get("invite");
  const inviteTo = search.get("inviteTo");
  const signInNext = useMemo(() => {
    const params = new URLSearchParams();
    if (inviteToken) params.set("invite", inviteToken);
    if (inviteTo) params.set("inviteTo", inviteTo);
    const qs = params.toString();
    return qs ? `/match?${qs}` : "/match";
  }, [inviteToken, inviteTo]);

  const {
    status,
    snapshot,
    currentRound,
    lastRoundEnd,
    opponentLive,
    spectating,
    ownDeadSnapshot,
    errorMessage,
    invite,
    challenge,
    connectionState,
    findMatch,
    retryConnection,
    cancelSearch,
    leaveMatch,
    createInvite,
    cancelInvite,
    joinInvite,
    challengeFriend,
    respondChallenge,
    cancelChallenge,
  } = useMultiplayerMatch();

  // If we landed here with ?invite=<token>, redeem it as soon as the socket
  // is ready. Guard with a one-shot ref so a re-render doesn't re-fire it.
  const [redeemed, setRedeemed] = useState<string | null>(null);
  const [savedDemoIds, setSavedDemoIds] = useState<Record<string, true>>({});
  useEffect(() => {
    if (!user && !isGuest) return;
    if (!inviteToken) return;
    if (redeemed === inviteToken) return;
    if (status !== "idle") return;
    setRedeemed(inviteToken);
    capture("match_invite_redeemed");
    joinInvite(inviteToken);
  }, [user, isGuest, inviteToken, redeemed, status, joinInvite]);

  const currentDemoId =
    snapshot && lastRoundEnd
      ? matchDemoId(lastRoundEnd.matchId, lastRoundEnd.roundIndex)
      : null;
  const currentDemoHref =
    currentDemoId && savedDemoIds[currentDemoId]
      ? `/demo/match/${currentDemoId}`
      : null;
  const savedRoundDemoLinks = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.roundWinners
      .map((_, roundIndex) => {
        const id = matchDemoId(snapshot.matchId, roundIndex);
        if (!savedDemoIds[id]) return null;
        return {
          label: `round ${roundIndex + 1}`,
          href: `/demo/match/${id}`,
        };
      })
      .filter((link): link is { label: string; href: string } => link !== null);
  }, [savedDemoIds, snapshot]);

  if (loading) return <Centered>connecting…</Centered>;
  if (!user && !isGuest) {
    return (
      <Centered>
        <p style={{ color: "var(--ink-mute)", marginBottom: 14 }}>
          sit at the table — sign in or play as guest.
        </p>
        <Link
          className="btn btn-gold sparkle"
          href={`/auth/sign-in?next=${encodeURIComponent(signInNext)}`}
        >
          play
        </Link>
      </Centered>
    );
  }

  return (
    <div
      className="screen play-screen match-screen"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        paddingLeft: "clamp(28px, 5vw, 72px)",
      }}
    >
      {snapshot ? (
        <MatchHUD stats={stats} snapshot={snapshot} opponentLive={opponentLive} />
      ) : (
        <div style={{ height: 70 }} />
      )}
      <div
        className="play-board-stage match-board-stage"
        style={{
          flex: 1,
          position: "relative",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {status === "idle" && (
          <Lobby
            myId={myId}
            invite={invite}
            error={errorMessage}
            connectionState={connectionState}
            onRetryConnection={retryConnection}
            onFindMatch={() => {
              capture("match_search_started");
              findMatch();
            }}
            onCreateInvite={() => {
              capture("match_invite_created");
              createInvite();
            }}
            onCancelInvite={cancelInvite}
            onJoinInvite={joinInvite}
            onChallengeFriend={challengeFriend}
            inviteTo={inviteTo}
          />
        )}
        {status === "searching" && (
          <Searching
            invite={invite}
            onCancel={() => {
              capture("match_search_cancelled");
              cancelSearch();
            }}
          />
        )}
        {(status === "in_match" || status === "complete") &&
          snapshot &&
          currentRound && (
            <PhaserGame key={snapshot.matchId} initialRound={currentRound} />
          )}
        {(status === "in_match" || status === "complete") &&
          snapshot &&
          !currentRound &&
          !lastRoundEnd &&
          status !== "complete" && (
            <Centered>
              <p style={{ color: "var(--ink-mute)" }}>waiting for round…</p>
            </Centered>
          )}

        {spectating && ownDeadSnapshot && (
          <SpectatorSidebar
            opponentName={spectating.opponentName}
            ownSnapshot={ownDeadSnapshot}
          />
        )}
        {spectating && <WatchingBanner opponentName={spectating.opponentName} />}

        <MatchDemoRecorder
          snapshot={snapshot}
          roundEnd={lastRoundEnd}
          onSaved={(id) =>
            setSavedDemoIds((prev) => (prev[id] ? prev : { ...prev, [id]: true }))
          }
        />

        <MatchResultOverlay
          roundEnd={lastRoundEnd}
          snapshot={snapshot}
          matchComplete={status === "complete"}
          demoHref={currentDemoHref}
          demoLinks={savedRoundDemoLinks}
          onFindAnother={findMatch}
          onLeave={leaveMatch}
        />

        {challenge.outgoing && status === "idle" && (
          <OutgoingChallenge
            challenge={challenge.outgoing}
            onCancel={() => cancelChallenge(challenge.outgoing!.challengeId)}
          />
        )}
        {challenge.incoming && status !== "in_match" && status !== "complete" && (
          <IncomingChallenge
            challenge={challenge.incoming}
            onAccept={() =>
              respondChallenge(challenge.incoming!.challengeId, true)
            }
            onDecline={() =>
              respondChallenge(challenge.incoming!.challengeId, false)
            }
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LOBBY
// ============================================================================

function Lobby({
  myId,
  invite,
  error,
  connectionState,
  onRetryConnection,
  onFindMatch,
  onCreateInvite,
  onCancelInvite,
  onJoinInvite,
  onChallengeFriend,
  inviteTo,
}: {
  myId: string;
  invite: InviteState;
  error: string | null;
  connectionState: ConnectionState;
  onRetryConnection: () => void;
  onFindMatch: () => void;
  onCreateInvite: () => void;
  onCancelInvite: () => void;
  onJoinInvite: (token: string) => void;
  onChallengeFriend: (userId: string) => void;
  inviteTo: string | null;
}) {
  useMascotPose("chipCount", "racking up the chips — pick a table");
  const online = connectionState === "online";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "auto",
        padding: "32px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <LobbyHeader />
        {/* Status sits above all action cards — when offline this replaces
            the inline error and shows actionable next steps. */}
        <ServerStatusCard
          state={connectionState}
          errorMessage={error}
          onRetry={onRetryConnection}
        />
        <QuickMatchCard onFindMatch={onFindMatch} disabled={!online} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
            alignItems: "start",
          }}
        >
          <InviteLinkCard
            invite={invite}
            onCreate={onCreateInvite}
            onCancel={onCancelInvite}
            disabled={!online}
          />
          <FriendsCard
            myId={myId}
            invite={invite}
            inviteTo={inviteTo}
            onChallengeFriend={onChallengeFriend}
            disabled={!online}
          />
        </div>
        {error && online && (
          <div
            className="panel"
            style={{
              padding: "12px 16px",
              borderColor: "var(--red-deep)",
              color: "var(--red-glow, #ff8a8a)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function LobbyHeader() {
  return (
    <div style={{ textAlign: "center", marginTop: 8 }}>
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          letterSpacing: "0.3em",
          color: "var(--gold)",
        }}
      >
        PvP table
      </div>
      <div
        className="disp"
        style={{
          fontSize: 56,
          fontStyle: "italic",
          letterSpacing: "-0.02em",
          marginTop: 4,
        }}
      >
        <span className="foil">RANKED BO5</span>
      </div>
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          color: "var(--ink-mute)",
          marginTop: 6,
        }}
      >
        first to three · 16×16 · 40 mines · 2 min per round
      </div>
    </div>
  );
}

function QuickMatchCard({
  onFindMatch,
  disabled,
}: {
  onFindMatch: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="panel panel-gold"
      style={{
        padding: 22,
        display: "flex",
        alignItems: "center",
        gap: 18,
      }}
    >
      <div style={{ flex: 1 }}>
        <div className="mono upper" style={{ fontSize: 10, letterSpacing: "0.22em", color: "var(--ink-mute)" }}>
          quick match
        </div>
        <div
          className="disp"
          style={{ fontSize: 26, fontStyle: "italic", fontWeight: 800, marginTop: 4 }}
        >
          <span className="foil">drop me into a table</span>
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6 }}>
          paired with the next opponent in queue.
        </div>
      </div>
      <button
        className="btn btn-gold sparkle"
        onClick={onFindMatch}
        disabled={disabled}
        title={disabled ? "server offline — try again in a moment" : undefined}
        style={{
          fontSize: 16,
          padding: "14px 26px",
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        ▸ find match
      </button>
    </div>
  );
}

function InviteLinkCard({
  invite,
  onCreate,
  onCancel,
  disabled,
}: {
  invite: InviteState;
  onCreate: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  const copyToClipboard = async () => {
    if (!invite.url) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
    } catch {
      // Fallback: select-all via prompt if clipboard API isn't available.
      window.prompt("Copy this invite link:", invite.url);
    }
  };

  return (
    <div
      className="panel"
      style={{
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            className="mono upper"
            style={{ fontSize: 10, letterSpacing: "0.22em", color: "var(--ink-mute)" }}
          >
            play with a friend
          </div>
          <div
            className="disp"
            style={{ fontSize: 22, fontStyle: "italic", fontWeight: 800, marginTop: 4 }}
          >
            share a one-shot link
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}
          >
            generates a private 1v1 invite that pairs you with the first person to open it.
            link expires in 10 minutes.
          </div>
        </div>
        {!invite.token ? (
          <button
            className="btn btn-red"
            onClick={onCreate}
            disabled={disabled}
            title={disabled ? "server offline" : undefined}
            style={{
              fontSize: 14,
              padding: "12px 18px",
              minWidth: 150,
              opacity: disabled ? 0.55 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            ▸ create link
          </button>
        ) : (
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            style={{ fontSize: 12, padding: "10px 14px" }}
          >
            cancel
          </button>
        )}
      </div>
      {invite.url && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 8,
            padding: 10,
            background: "rgba(0,0,0,0.45)",
            border: "1px solid var(--gold-deep)",
            borderRadius: 8,
          }}
        >
          <input
            type="text"
            value={invite.url}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="mono"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              color: "var(--gold)",
              fontSize: 12,
              outline: "none",
              padding: "4px 0",
            }}
          />
          <button
            className="btn btn-gold"
            onClick={copyToClipboard}
            style={{ padding: "6px 14px", fontSize: 12, minWidth: 90 }}
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
      )}
      {invite.token && (
        <div
          className="mono upper"
          style={{
            fontSize: 9,
            letterSpacing: "0.22em",
            color: "var(--gold)",
            marginTop: -4,
          }}
        >
          ● waiting for someone to join…
        </div>
      )}
    </div>
  );
}

function FriendsCard({
  myId,
  invite,
  inviteTo,
  onChallengeFriend,
  disabled,
}: {
  myId: string;
  invite: InviteState;
  inviteTo: string | null;
  onChallengeFriend: (userId: string) => void;
  disabled?: boolean;
}) {
  const [friends, setFriends] = useState<FriendListEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [autoChallenged, setAutoChallenged] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchFriends(myId);
      if (cancelled) return;
      setFriends(list.filter((f) => f.status === "accepted"));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [myId]);

  useEffect(() => {
    if (!loaded || !inviteTo || autoChallenged === inviteTo) return;
    const target = friends.find(
      (f) =>
        f.user_id === inviteTo ||
        f.username.toLowerCase() === inviteTo.toLowerCase(),
    );
    if (!target) return;
    setAutoChallenged(inviteTo);
    capture("match_friend_challenge_started", {
      source: "inviteTo",
      target_user_id: target.user_id,
    });
    onChallengeFriend(target.user_id);
  }, [autoChallenged, friends, inviteTo, loaded, onChallengeFriend]);

  return (
    <div
      className="panel"
      style={{
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "sticky",
        top: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          className="mono upper"
          style={{ fontSize: 10, letterSpacing: "0.22em", color: "var(--ink-mute)" }}
        >
          friends ({friends.length})
        </div>
        <Link
          href="/friends"
          className="mono upper"
          style={{
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--gold)",
            textDecoration: "none",
          }}
        >
          manage →
        </Link>
      </div>
      <div
        className="mono"
        style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.5 }}
      >
        Challenge a friend directly. If they are not at the table yet, a private link appears here.
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxHeight: 260,
          overflow: "auto",
        }}
      >
        {!loaded ? (
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-mute)", padding: 6 }}
          >
            loading…
          </div>
        ) : friends.length === 0 ? (
          <div
            className="mono"
            style={{
              padding: 14,
              background: "rgba(0,0,0,0.25)",
              border: "1px dashed var(--line-soft)",
              borderRadius: 6,
              fontSize: 11,
              color: "var(--ink-mute)",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            <div>
              no friends yet —{" "}
              <Link
                href="/friends"
                style={{ color: "var(--gold)", textDecoration: "underline" }}
              >
                add one
              </Link>
            </div>
            <div style={{ marginTop: 4, fontSize: 10 }}>
              or just hit{" "}
              <span style={{ color: "var(--gold-glow)" }}>find match</span> above.
            </div>
          </div>
        ) : (
          friends.map((f) => (
            <FriendInviteRow
              key={f.user_id}
              friend={f}
              inviteUrl={invite.targetUserId === f.user_id ? invite.url : null}
              disabled={disabled}
              onChallenge={() => {
                capture("match_friend_challenge_started", {
                  source: "friends_card",
                  target_user_id: f.user_id,
                });
                onChallengeFriend(f.user_id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FriendInviteRow({
  friend,
  inviteUrl,
  onChallenge,
  disabled,
}: {
  friend: FriendListEntry;
  inviteUrl: string | null;
  onChallenge: () => void;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      window.prompt("Copy this invite link:", inviteUrl);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        background: "rgba(0,0,0,0.25)",
        border: "1px solid var(--line-soft)",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 14,
          flex: 1,
          minWidth: 0,
        }}
      >
        {friend.country && (
          <span title={countryName(friend.country)}>{flagEmoji(friend.country)}</span>
        )}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {friend.username}
        </span>
      </div>
      <button
        className="mono upper"
        title={
          disabled
            ? "server offline"
            : inviteUrl
              ? "Your friend is not connected right now. Send them this private invite link."
              : "Challenge this friend directly if they are connected."
        }
        onClick={inviteUrl ? copyInvite : onChallenge}
        disabled={disabled && !inviteUrl}
        style={{
          fontSize: 9,
          letterSpacing: "0.16em",
          color: inviteUrl ? "#241704" : "var(--ink-2)",
          background: inviteUrl ? "var(--gold)" : "rgba(255,255,255,0.06)",
          border: "1px solid var(--line-soft)",
          borderRadius: 5,
          padding: "6px 8px",
          cursor: disabled && !inviteUrl ? "not-allowed" : "pointer",
          fontWeight: 800,
          whiteSpace: "nowrap",
          opacity: disabled && !inviteUrl ? 0.55 : 1,
        }}
      >
        {inviteUrl ? (copied ? "copied" : "copy link") : "challenge"}
      </button>
    </div>
  );
}

function IncomingChallenge({
  challenge,
  onAccept,
  onDecline,
}: {
  challenge: NonNullable<ChallengeState["incoming"]>;
  onAccept: () => void;
  onDecline: () => void;
}) {
  useMascotPose("allIn", `${challenge.from.name} pushed chips forward`);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 70,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(ellipse at center, rgba(0,0,0,.45), rgba(0,0,0,.78))",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        className="panel panel-gold"
        style={{
          width: 680,
          maxWidth: "calc(100vw - 32px)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div
          className="mono upper"
          style={{ fontSize: 10, letterSpacing: "0.22em", color: "var(--ink-mute)" }}
        >
          challenge received
        </div>
        <div
          className="disp"
          style={{
            fontSize: 34,
            fontStyle: "italic",
            fontWeight: 800,
            marginTop: 6,
          }}
        >
          <span className="foil">{challenge.from.name}</span>
        </div>
        <div
          className="mono"
          style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 8 }}
        >
          wants a BO5 table.
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            className="btn btn-gold sparkle"
            onClick={onAccept}
            style={{ padding: "12px 22px", fontSize: 14 }}
          >
            agree
          </button>
          <button
            className="btn btn-ghost"
            onClick={onDecline}
            style={{ padding: "12px 18px", fontSize: 14 }}
          >
            not agree
          </button>
        </div>
      </div>
    </div>
  );
}

function OutgoingChallenge({
  challenge,
  onCancel,
}: {
  challenge: NonNullable<ChallengeState["outgoing"]>;
  onCancel: () => void;
}) {
  useMascotPose("allIn", `waiting on ${challenge.to.name}`);
  return (
    <div
      className="panel"
      style={{
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 40,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: 420,
        background: "rgba(0,0,0,0.68)",
      }}
    >
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          color: "var(--gold)",
          zIndex: 2,
        }}
      >
        waiting for {challenge.to.name}
      </div>
      <button
        className="btn btn-ghost"
        onClick={onCancel}
        style={{ padding: "6px 10px", fontSize: 11, zIndex: 2 }}
      >
        cancel
      </button>
    </div>
  );
}

// ============================================================================
// SEARCHING / SPECTATOR / SHARED
// ============================================================================

function Searching({
  invite,
  onCancel,
}: {
  invite: InviteState;
  onCancel: () => void;
}) {
  const isHost = invite.role === "host";
  const isInvite = invite.role === "joiner";
  useMascotPose(
    isHost || isInvite ? "waiting" : "inspect",
    isHost
      ? "holding the private table"
      : isInvite
        ? "checking your invite chip"
        : "scanning the room",
  );
  if (isHost) {
    return <InviteWaiting invite={invite} onCancel={onCancel} />;
  }
  return (
    <Centered>
      <div
        className="disp"
        style={{ fontSize: 36, fontStyle: "italic", marginBottom: 8 }}
      >
        <span className="foil">{isInvite ? "joining…" : "searching…"}</span>
      </div>
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          color: "var(--ink-mute)",
          marginBottom: 22,
        }}
      >
        {isInvite ? "redeeming invite link" : "looking for an opponent"}
      </div>
      <button
        className="btn btn-ghost"
        onClick={onCancel}
        style={{ fontSize: 13, padding: "10px 18px" }}
      >
        cancel
      </button>
    </Centered>
  );
}

function InviteWaiting({
  invite,
  onCancel,
}: {
  invite: InviteState;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  const copyToClipboard = async () => {
    if (!invite.url) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
    } catch {
      window.prompt("Copy this invite link:", invite.url);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(980px, calc(100vw - 32px))",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(430px, 100%), 1fr))",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            className="mono upper"
            style={{
              fontSize: 10,
              letterSpacing: "0.26em",
              color: "var(--gold)",
            }}
          >
            private table
          </div>
          <div
            className="disp"
            style={{
              fontSize: "clamp(30px, 8vw, 46px)",
              fontStyle: "italic",
              fontWeight: 900,
              marginTop: 6,
            }}
          >
            <span className="foil">waiting for friend</span>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--ink-2)",
              lineHeight: 1.6,
              marginTop: 8,
              maxWidth: 430,
            }}
          >
            {invite.url
              ? "Send this link. The match starts instantly when your friend opens it."
              : "Opening a private table…"}
          </div>

          {invite.url && (
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 8,
                marginTop: 18,
                padding: 10,
                background: "rgba(0,0,0,0.48)",
                border: "1px solid var(--gold-deep)",
                borderRadius: 8,
              }}
            >
              <input
                type="text"
                value={invite.url}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                className="mono"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "transparent",
                  border: "none",
                  color: "var(--gold)",
                  fontSize: 12,
                  outline: "none",
                  padding: "4px 0",
                }}
              />
              <button
                className="btn btn-gold"
                onClick={copyToClipboard}
                style={{ padding: "6px 14px", fontSize: 12, minWidth: 90 }}
              >
                {copied ? "copied" : "copy"}
              </button>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-ghost"
              onClick={onCancel}
              style={{ fontSize: 13, padding: "10px 18px" }}
            >
              cancel table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        minHeight: 0,
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>{children}</div>
    </div>
  );
}

function WatchingBanner({ opponentName }: { opponentName: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "6px 14px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,90,90,0.45)",
        boxShadow: "0 0 18px rgba(255,90,90,0.25)",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          color: "var(--red, #ff8a8a)",
        }}
      >
        ● watching {opponentName}
      </div>
    </div>
  );
}

function SpectatorSidebar({
  opponentName,
  ownSnapshot,
}: {
  opponentName: string;
  ownSnapshot: import("@/game/bridge").BoardSnapshot;
}) {
  void opponentName;
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        bottom: 12,
        width: 260,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      <MiniBoard snapshot={ownSnapshot} label="your last run" />
    </div>
  );
}
