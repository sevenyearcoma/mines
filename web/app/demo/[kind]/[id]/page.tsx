import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoPlayer } from "@/components/demo/DemoPlayer";
import { MatchDemoPlayer } from "@/components/demo/MatchDemoPlayer";
import { fetchDemo } from "@/lib/demo/fetch";
import type { Demo, DemoKind, MatchDemo } from "@/lib/demo/types";

export const dynamic = "force-dynamic";

function isDemoKind(value: string): value is DemoKind {
  return value === "solo" || value === "daily" || value === "match";
}

function isMatchDemo(demo: Demo | MatchDemo): demo is MatchDemo {
  return "player0" in demo;
}

function subtitle(demo: Demo | MatchDemo): string {
  if (isMatchDemo(demo)) return `1x1 - round ${demo.roundIndex + 1}`;
  return demo.kind === "daily"
    ? `daily - ${demo.date ?? ""}`
    : `solo - ${demo.difficulty}`;
}

function backHref(demo: Demo | MatchDemo): string {
  if (isMatchDemo(demo)) return "/match";
  return demo.kind === "daily" ? "/leaderboard" : "/profile";
}

export default async function DemoPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!isDemoKind(kind)) notFound();
  const demo = await fetchDemo(kind, id);
  if (!demo) notFound();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div
        style={{
          padding: "18px 28px",
          borderBottom: "1px solid var(--line-soft)",
          display: "flex",
          alignItems: "baseline",
          gap: 14,
        }}
      >
        <div
          className="disp"
          style={{ fontSize: 30, fontStyle: "italic", letterSpacing: "-0.02em" }}
        >
          Demo
        </div>
        <div
          className="mono upper"
          style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.3em" }}
        >
          {subtitle(demo)}
        </div>
        <div style={{ flex: 1 }} />
        <Link
          href={backHref(demo)}
          className="mono upper"
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            color: "var(--ink-2)",
            textDecoration: "none",
          }}
        >
          back
        </Link>
      </div>
      {isMatchDemo(demo) ? (
        <MatchDemoPlayer demo={demo} />
      ) : (
        <DemoPlayer demo={demo} />
      )}
    </div>
  );
}
