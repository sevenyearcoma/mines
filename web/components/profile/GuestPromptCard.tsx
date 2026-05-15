"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProfileMascotPose } from "./ProfileMascotPose";

export function GuestPromptCard() {
  const { guest, isGuest } = useAuth();

  if (!isGuest || !guest) {
    return (
      <main
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 40,
        }}
      >
        <ProfileMascotPose pose="waiting" caption="no table reserved yet" />
        <div
          className="panel"
          style={{
            width: 420,
            padding: 28,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            className="mono upper"
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              color: "var(--ink-mute)",
            }}
          >
            profile locked
          </div>
          <div
            className="disp"
            style={{
              fontSize: 30,
              fontStyle: "italic",
              letterSpacing: "-0.01em",
            }}
          >
            <span className="foil">sit down first</span>
          </div>
          <p
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--ink-2)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            sign in or play as a guest to claim a profile.
          </p>
          <Link
            href="/auth/sign-in?next=/profile"
            className="btn btn-gold sparkle"
            style={{ justifyContent: "center" }}
          >
            sit at the table
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 22,
        padding: "32px 28px 48px",
        maxWidth: 1060,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <ProfileMascotPose pose="point" caption="sign up — keep your wins" />

      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            color: "var(--gold)",
            letterSpacing: "0.3em",
          }}
        >
          guest mode · session-only
        </div>
        <div
          className="wordmark disp"
          data-text={guest.name}
          style={{
            fontSize: 64,
            fontStyle: "italic",
            letterSpacing: "0.02em",
          }}
        >
          {guest.name}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--ink-mute)",
            lineHeight: 1.55,
          }}
        >
          stats vanish when you close the tab. sign up to keep your runs on the
          board forever.
        </div>
      </header>

      <section
        className="panel panel-gold"
        style={{
          padding: 28,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 22,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            className="mono upper"
            style={{
              fontSize: 10,
              color: "var(--gold)",
              letterSpacing: "0.22em",
            }}
          >
            save your runs forever
          </div>
          <div
            className="disp"
            style={{
              fontSize: 30,
              fontStyle: "italic",
              letterSpacing: "-0.01em",
              lineHeight: 1.05,
            }}
          >
            <span className="foil">claim the seat</span>
          </div>
          <p
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--ink-2)",
              lineHeight: 1.55,
              margin: 0,
              maxWidth: 480,
            }}
          >
            sign in and unlock the leaderboard climb, deep cuts on your action
            logs, friend challenges, and demo replays.
          </p>
        </div>
        <Link
          href="/auth/sign-in?next=/profile"
          className="btn btn-gold sparkle"
          style={{
            padding: "14px 22px",
            justifyContent: "center",
            whiteSpace: "nowrap",
          }}
        >
          sign up
        </Link>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <PromptHint
          chip="leaderboard"
          chipClass="chip chip-gold"
          title="climb the boards"
          body="regional & global rankings refresh as you play."
        />
        <PromptHint
          chip="deep cuts"
          chipClass="chip chip-green"
          title="see your tells"
          body="action logs turn into ranked insights about your play."
        />
        <PromptHint
          chip="demos"
          chipClass="chip chip-red"
          title="rewind every loss"
          body="every match round saves a replay you can scrub."
        />
      </section>
    </main>
  );
}

function PromptHint({
  chip,
  chipClass,
  title,
  body,
}: {
  chip: string;
  chipClass: string;
  title: string;
  body: string;
}) {
  return (
    <article
      className="panel"
      style={{
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <span
        className={chipClass}
        style={{ alignSelf: "flex-start", padding: "4px 10px" }}
      >
        {chip}
      </span>
      <div
        className="disp"
        style={{
          fontSize: 22,
          fontStyle: "italic",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <p
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--ink-2)",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {body}
      </p>
    </article>
  );
}
