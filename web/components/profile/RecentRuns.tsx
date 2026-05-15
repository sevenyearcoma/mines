"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtTime } from "@/lib/format";
import { flagEmoji } from "@/lib/leaderboard/country";
import type { Game } from "@/lib/types/db";
import { useProMode } from "@/components/pro/ProProvider";

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return fmtTime(Math.floor(ms / 1000));
}

export type RecentMatchRow = {
  matchId: string;
  opponentName: string;
  opponentCountry: string | null;
  playedAt: string;
  myRoundsWon: number;
  opponentRoundsWon: number;
  result: "won" | "lost" | "draw";
  rounds: Array<{
    id: string;
    round_index: number;
    won: boolean;
    draw: boolean;
  }>;
};

type Tab = "matches" | "solo";

export function RecentRuns({
  matches,
  games,
}: {
  matches: RecentMatchRow[];
  games: Game[];
}) {
  const [tab, setTab] = useState<Tab>(
    matches.length > 0 ? "matches" : "solo",
  );

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div
          className="disp"
          style={{
            fontSize: 26,
            fontStyle: "italic",
            letterSpacing: "-0.01em",
          }}
        >
          <span className="foil-deep">recent runs</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <TabButton
            active={tab === "matches"}
            onClick={() => setTab("matches")}
            count={matches.length}
          >
            1v1
          </TabButton>
          <TabButton
            active={tab === "solo"}
            onClick={() => setTab("solo")}
            count={games.length}
          >
            solo
          </TabButton>
        </div>
      </div>

      {tab === "matches" ? (
        <MatchesList matches={matches} />
      ) : (
        <SoloList games={games} />
      )}
    </section>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono upper"
      style={{
        fontSize: 10,
        letterSpacing: "0.22em",
        padding: "8px 14px",
        borderRadius: 4,
        border: active ? "1px solid var(--gold-deep)" : "1px solid var(--line-soft)",
        background: active
          ? "linear-gradient(180deg, rgba(227,178,72,0.18), rgba(227,178,72,0.04))"
          : "rgba(0,0,0,0.25)",
        color: active ? "var(--gold-glow)" : "var(--ink-2)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>{children}</span>
      <span style={{ color: "var(--ink-mute)", fontSize: 9 }}>{count}</span>
    </button>
  );
}

function MatchesList({ matches }: { matches: RecentMatchRow[] }) {
  const { isPro } = useProMode();
  if (matches.length === 0) {
    return <EmptyState label="no 1v1 demos saved yet." />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {matches.map((match) => (
        <div
          key={match.matchId}
          className="panel"
          style={{
            padding: "12px 14px",
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr) auto auto",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span
            className={
              "chip " +
              (match.result === "won"
                ? "chip-green"
                : match.result === "lost"
                  ? "chip-red"
                  : "")
            }
          >
            {match.result === "won"
              ? "WON"
              : match.result === "lost"
                ? "LOST"
                : "DRAW"}
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              className="mono upper"
              style={{
                fontSize: 10,
                color: "var(--ink-mute)",
                letterSpacing: "0.16em",
              }}
            >
              vs{" "}
              {match.opponentCountry && (
                <span style={{ marginRight: 4 }}>
                  {flagEmoji(match.opponentCountry)}
                </span>
              )}
              <span className="foil">{match.opponentName}</span>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-2)",
                marginTop: 4,
              }}
            >
              {match.rounds.length} round
              {match.rounds.length === 1 ? "" : "s"} saved
            </div>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 16,
              color: "var(--gold-glow)",
              fontVariantNumeric: "tabular-nums",
              fontWeight: 800,
            }}
          >
            {match.myRoundsWon}-{match.opponentRoundsWon}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--ink-mute)",
                marginRight: 2,
              }}
              title={new Date(match.playedAt).toLocaleString()}
            >
              {new Date(match.playedAt).toLocaleDateString()}
            </span>
            {match.rounds.map((round) =>
              isPro ? (
                <Link
                  key={round.id}
                  href={`/demo/match/${round.id}`}
                  className="mono upper"
                  title={`round ${round.round_index + 1}`}
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    color: round.draw
                      ? "var(--ink-2)"
                      : round.won
                        ? "var(--gold)"
                        : "var(--red-glow)",
                    textDecoration: "none",
                    padding: "4px 7px",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 4,
                    background: "rgba(0,0,0,0.2)",
                  }}
                >
                  r{round.round_index + 1}
                </Link>
              ) : (
                <span
                  key={round.id}
                  className="mono upper"
                  title="Pro: demo replays"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    color: "var(--ink-mute)",
                    padding: "4px 7px",
                    border: "1px dashed var(--line-soft)",
                    borderRadius: 4,
                    background: "rgba(0,0,0,0.2)",
                    opacity: 0.55,
                  }}
                >
                  r{round.round_index + 1} 🔒
                </span>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SoloList({ games }: { games: Game[] }) {
  const { isPro } = useProMode();
  if (games.length === 0) {
    return <EmptyState label="no games yet — play one and come back." />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {games.map((g) => {
        const hasDemo = Array.isArray(g.actions) && g.actions.length > 0;
        return (
          <div
            key={g.id}
            className="panel"
            style={{
              padding: "10px 14px",
              display: "grid",
              gridTemplateColumns: "auto 1fr auto auto auto auto",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span className={"chip " + (g.won ? "chip-green" : "chip-red")}>
              {g.won ? "WIN" : "BOOM"}
            </span>
            <span
              className="mono upper"
              style={{ fontSize: 10, color: "var(--ink-mute)" }}
            >
              {g.difficulty}
            </span>
            <span
              className="mono gold"
              style={{
                fontSize: 13,
                color: "var(--gold-glow)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtMs(g.elapsed_ms)}
            </span>
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-mute)" }}
            >
              {g.opens} opens
            </span>
            <span
              className="mono"
              style={{ fontSize: 10, color: "var(--ink-mute)" }}
              title={new Date(g.played_at).toLocaleString()}
            >
              {new Date(g.played_at).toLocaleDateString()}
            </span>
            {hasDemo ? (
              isPro ? (
                <Link
                  href={`/demo/solo/${g.id}`}
                  className="mono upper"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color: "var(--gold)",
                    textDecoration: "none",
                    padding: "4px 8px",
                    border: "1px solid var(--gold-deep)",
                    borderRadius: 4,
                  }}
                >
                  ▶ demo
                </Link>
              ) : (
                <span
                  className="mono upper"
                  title="Pro: demo replays"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color: "var(--ink-mute)",
                    padding: "4px 8px",
                    border: "1px dashed var(--line-soft)",
                    borderRadius: 4,
                    opacity: 0.6,
                  }}
                >
                  🔒 pro
                </span>
              )
            ) : (
              <span
                className="mono upper"
                style={{
                  fontSize: 9,
                  color: "var(--ink-mute)",
                  letterSpacing: "0.18em",
                }}
              >
                —
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      className="panel"
      style={{
        padding: "26px 18px",
        textAlign: "center",
        color: "var(--ink-mute)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: "0.04em",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div>{label}</div>
      <Link
        href="/play"
        className="btn btn-ghost"
        style={{ fontSize: 12, padding: "8px 14px" }}
      >
        start playing →
      </Link>
    </div>
  );
}
