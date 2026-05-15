"use client";

import Link from "next/link";
import type { ConnectionState } from "@/lib/multiplayer/socket";

export function ServerStatusCard({
  state,
  errorMessage,
  onRetry,
}: {
  state: ConnectionState;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  if (state === "online") return null;

  if (state === "connecting") {
    return (
      <div
        className="panel"
        style={{
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderColor: "var(--line-soft)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "var(--gold)",
            boxShadow: "0 0 12px var(--gold-glow)",
            animation: "pulse-dot 1.2s ease-in-out infinite",
          }}
        />
        <div
          className="mono upper"
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            color: "var(--gold)",
          }}
        >
          connecting to PvP server…
        </div>
        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 0.5; transform: scale(0.85); }
            50% { opacity: 1; transform: scale(1.15); }
          }
        `}</style>
      </div>
    );
  }

  // offline
  return (
    <div
      className="panel"
      style={{
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderColor: "var(--red-deep)",
        background:
          "linear-gradient(180deg, rgba(214, 59, 59, 0.08), rgba(0,0,0,0.25))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden
          style={{
            fontSize: 16,
            filter: "drop-shadow(0 0 6px rgba(255,106,106,0.45))",
          }}
        >
          🔌
        </span>
        <div
          className="mono upper"
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            color: "var(--red-glow)",
          }}
        >
          PvP server unreachable
        </div>
      </div>
      <div
        className="mono"
        style={{
          fontSize: 12,
          color: "var(--ink-2)",
          lineHeight: 1.5,
        }}
      >
        {errorMessage ??
          "Couldn't reach the matchmaking server. Try again, or run the daily / solo board while it comes back."}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-gold"
          onClick={onRetry}
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          retry connection
        </button>
        <Link
          href="/daily"
          className="btn btn-ghost"
          style={{ padding: "8px 14px", fontSize: 12 }}
        >
          daily →
        </Link>
        <Link
          href="/play"
          className="btn btn-ghost"
          style={{ padding: "8px 14px", fontSize: 12 }}
        >
          solo sprint →
        </Link>
      </div>
    </div>
  );
}
