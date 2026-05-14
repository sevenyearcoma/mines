"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth/AuthProvider";
import { useGameStats } from "@/components/hud/useGameStats";
import { MatchHUD } from "@/components/hud/MatchHUD";
import { MatchResultOverlay } from "@/components/hud/MatchResultOverlay";
import { MiniBoard } from "@/components/hud/MiniBoard";
import { useMultiplayerMatch } from "@/lib/multiplayer/useMultiplayerMatch";

const PhaserGame = dynamic(() => import("@/game/PhaserGame"), {
  ssr: false,
});

export default function MatchPage() {
  const { user, loading } = useAuth();
  const { stats } = useGameStats();
  const {
    status,
    snapshot,
    currentRound,
    lastRoundEnd,
    opponentLive,
    spectating,
    ownDeadSnapshot,
    errorMessage,
    findMatch,
    cancelSearch,
    leaveMatch,
  } = useMultiplayerMatch();

  if (loading) return <Centered>connecting…</Centered>;
  if (!user) {
    return (
      <Centered>
        <p style={{ color: "var(--ink-mute)", marginBottom: 14 }}>
          you must sign in to play ranked matches.
        </p>
      </Centered>
    );
  }

  return (
    <div
      className="screen"
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      {snapshot ? (
        <MatchHUD
          stats={stats}
          snapshot={snapshot}
          opponentLive={opponentLive}
        />
      ) : (
        <div style={{ height: 70 }} />
      )}
      <div
        style={{
          flex: 1,
          position: "relative",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {status === "idle" && (
          <LobbyIdle onFindMatch={findMatch} error={errorMessage} />
        )}
        {status === "searching" && <LobbySearching onCancel={cancelSearch} />}
        {(status === "in_match" || status === "complete") &&
          snapshot &&
          currentRound && (
            <PhaserGame
              key={snapshot.matchId}
              initialRound={currentRound}
            />
          )}
        {(status === "in_match" || status === "complete") &&
          snapshot &&
          !currentRound && (
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
        {spectating && (
          <WatchingBanner opponentName={spectating.opponentName} />
        )}

        <MatchResultOverlay
          roundEnd={lastRoundEnd}
          snapshot={snapshot}
          matchComplete={status === "complete"}
          onFindAnother={findMatch}
          onLeave={leaveMatch}
        />
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

function LobbyIdle({
  onFindMatch,
  error,
}: {
  onFindMatch: () => void;
  error: string | null;
}) {
  return (
    <Centered>
      <div
        className="disp"
        style={{
          fontSize: 56,
          fontStyle: "italic",
          letterSpacing: "-0.02em",
          marginBottom: 6,
        }}
      >
        <span className="foil">RANKED</span>
      </div>
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          color: "var(--ink-mute)",
          marginBottom: 26,
        }}
      >
        best-of-5 · 16×16 · 40 mines · 2 min per round
      </div>
      <button
        className="btn btn-gold sparkle"
        onClick={onFindMatch}
        style={{ fontSize: 16, padding: "14px 28px" }}
      >
        ▸ find match
      </button>
      {error && (
        <div
          className="mono upper"
          style={{
            color: "var(--red-glow, #ff8888)",
            marginTop: 18,
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}
    </Centered>
  );
}

function LobbySearching({ onCancel }: { onCancel: () => void }) {
  return (
    <Centered>
      <div
        className="disp"
        style={{ fontSize: 36, fontStyle: "italic", marginBottom: 8 }}
      >
        <span className="foil">searching…</span>
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
        looking for an opponent
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
