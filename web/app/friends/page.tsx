"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { countryName, flagEmoji } from "@/lib/leaderboard/country";
import {
  acceptRequest,
  fetchFriends,
  findUserIdByUsername,
  removeFriendship,
  sendRequest,
  type FriendListEntry,
} from "@/lib/friends/ops";

type Phase = "loading" | "unauth" | "ready";
type Notice = { kind: "ok" | "err"; text: string } | null;

export default function FriendsPage() {
  const { user, loading } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [list, setList] = useState<FriendListEntry[]>([]);
  const [notice, setNotice] = useState<Notice>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    const friends = await fetchFriends(user.id);
    setList(friends);
  }, [user]);

  useEffect(() => {
    if (loading) {
      setPhase("loading");
      return;
    }
    if (!user) {
      setPhase("unauth");
      return;
    }
    setPhase("ready");
    void reload();
  }, [user, loading, reload]);

  const pendingIncoming = list.filter(
    (f) => f.status === "pending" && !f.iAmRequester,
  );
  const pendingOutgoing = list.filter(
    (f) => f.status === "pending" && f.iAmRequester,
  );
  const accepted = list.filter((f) => f.status === "accepted");

  if (phase === "loading") return <Centered>connecting…</Centered>;
  if (phase === "unauth") {
    return (
      <Centered>
        <p style={{ color: "var(--ink-mute)", marginBottom: 14 }}>
          sign in to manage your friends list.
        </p>
        <Link className="btn btn-gold sparkle" href="/auth/sign-in?next=/friends">
          sign in
        </Link>
      </Centered>
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
        maxWidth: 880,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div
          className="disp"
          style={{ fontSize: 42, fontStyle: "italic", letterSpacing: "-0.02em" }}
        >
          Friends
        </div>
        <div
          className="mono upper"
          style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.3em" }}
        >
          {accepted.length} friend{accepted.length === 1 ? "" : "s"}
        </div>
      </header>

      <AddFriendForm
        onSent={(n) => {
          setNotice(n);
          void reload();
        }}
        myId={user!.id}
      />

      {notice && (
        <div
          className="panel"
          style={{
            padding: "10px 14px",
            fontSize: 12,
            borderColor:
              notice.kind === "err" ? "var(--red-deep)" : "var(--gold-deep)",
            color:
              notice.kind === "err"
                ? "var(--red-glow, #ff8a8a)"
                : "var(--gold)",
          }}
        >
          {notice.text}
        </div>
      )}

      <Section title="Incoming requests" count={pendingIncoming.length}>
        {pendingIncoming.length === 0 ? (
          <Empty>nothing waiting for you.</Empty>
        ) : (
          pendingIncoming.map((f) => (
            <Row key={f.user_id} entry={f}>
              <ActionBtn
                onClick={async () => {
                  const r = await acceptRequest(user!.id, f.user_id);
                  setNotice(
                    r.ok
                      ? { kind: "ok", text: `now friends with ${f.username}` }
                      : { kind: "err", text: r.error },
                  );
                  void reload();
                }}
                tone="gold"
              >
                accept
              </ActionBtn>
              <ActionBtn
                onClick={async () => {
                  await removeFriendship(user!.id, f.user_id);
                  void reload();
                }}
              >
                decline
              </ActionBtn>
            </Row>
          ))
        )}
      </Section>

      <Section title="Awaiting reply" count={pendingOutgoing.length}>
        {pendingOutgoing.length === 0 ? (
          <Empty>no outgoing requests.</Empty>
        ) : (
          pendingOutgoing.map((f) => (
            <Row key={f.user_id} entry={f}>
              <ActionBtn
                onClick={async () => {
                  await removeFriendship(user!.id, f.user_id);
                  void reload();
                }}
              >
                cancel
              </ActionBtn>
            </Row>
          ))
        )}
      </Section>

      <Section title="Friends" count={accepted.length}>
        {accepted.length === 0 ? (
          <Empty>
            no friends yet — add someone by their username above.
          </Empty>
        ) : (
          accepted.map((f) => (
            <Row key={f.user_id} entry={f}>
              <Link
                href={`/match?inviteTo=${encodeURIComponent(f.username)}`}
                className="mono upper"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "var(--gold)",
                  textDecoration: "none",
                  padding: "6px 12px",
                  border: "1px solid var(--gold-deep)",
                  borderRadius: 4,
                }}
              >
                ▶ play
              </Link>
              <ActionBtn
                onClick={async () => {
                  if (!confirm(`Remove ${f.username} from friends?`)) return;
                  await removeFriendship(user!.id, f.user_id);
                  void reload();
                }}
              >
                remove
              </ActionBtn>
            </Row>
          ))
        )}
      </Section>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>{children}</div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          color: "var(--ink-mute)",
          marginBottom: 8,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <span>{title}</span>
        <span style={{ color: "var(--gold)" }}>{count}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        padding: 14,
        background: "rgba(0,0,0,0.2)",
        border: "1px dashed var(--line-soft)",
        borderRadius: 8,
        fontSize: 12,
        color: "var(--ink-mute)",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function Row({
  entry,
  children,
}: {
  entry: FriendListEntry;
  children: React.ReactNode;
}) {
  return (
    <div
      className="panel"
      style={{
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 18,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: 1,
          minWidth: 0,
        }}
      >
        {entry.country && (
          <span title={countryName(entry.country)}>{flagEmoji(entry.country)}</span>
        )}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.username}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>{children}</div>
    </div>
  );
}

function ActionBtn({
  onClick,
  tone,
  children,
}: {
  onClick: () => void;
  tone?: "gold";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={tone === "gold" ? "btn btn-gold" : "btn btn-ghost"}
      style={{ padding: "6px 12px", fontSize: 12 }}
    >
      {children}
    </button>
  );
}

function AddFriendForm({
  onSent,
  myId,
}: {
  onSent: (n: Notice) => void;
  myId: string;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const target = await findUserIdByUsername(trimmed);
      if (!target) {
        onSent({ kind: "err", text: `no user named "${trimmed}".` });
        return;
      }
      if (target.id === myId) {
        onSent({ kind: "err", text: "you can't friend yourself." });
        return;
      }
      const r = await sendRequest(myId, target.id);
      if (!r.ok) {
        // Most common failure: row already exists. Surface a humane hint.
        const friendly =
          /duplicate|conflict|unique/i.test(r.error)
            ? `you already have a pending or accepted request with ${target.username}.`
            : r.error;
        onSent({ kind: "err", text: friendly });
        return;
      }
      onSent({ kind: "ok", text: `request sent to ${target.username}.` });
      setName("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "stretch",
      }}
    >
      <input
        type="text"
        placeholder="add friend by username"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={busy}
        style={{
          flex: 1,
          padding: "10px 12px",
          fontSize: 14,
          fontFamily: "var(--font-mono)",
          background: "rgba(0,0,0,0.4)",
          color: "var(--ink)",
          border: "1px solid var(--line-soft)",
          borderRadius: 6,
        }}
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="btn btn-gold"
        style={{ padding: "10px 18px", fontSize: 13, minWidth: 110 }}
      >
        {busy ? "sending…" : "send request"}
      </button>
    </form>
  );
}
