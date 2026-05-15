"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { capture } from "@/lib/analytics/posthog";

const GUEST_NAME_PATTERN = /^[a-zA-Z0-9 _-]{2,20}$/;

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const search = useSearchParams();
  const callbackError = search.get("error");
  const next = search.get("next");
  const { signInAsGuest } = useAuth();

  const [email, setEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestError, setGuestError] = useState<string | null>(null);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; email: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback${
          next ? `?next=${encodeURIComponent(next)}` : ""
        }`
      : undefined;

  async function signInWithGitHub() {
    capture("sign_in_initiated", { method: "github" });
    setStatus({ kind: "sending" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });
    if (error) setStatus({ kind: "error", message: error.message });
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    capture("sign_in_initiated", { method: "magic_link", email });
    setStatus({ kind: "sending" });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) setStatus({ kind: "error", message: error.message });
    else {
      capture("sign_in_email_sent", { email });
      setStatus({ kind: "sent", email });
    }
  }

  function startAsGuest(e: React.FormEvent) {
    e.preventDefault();
    setGuestError(null);
    const trimmed = guestName.trim();
    if (!GUEST_NAME_PATTERN.test(trimmed)) {
      setGuestError("2-20 chars, letters, numbers, space, _ or -");
      return;
    }
    signInAsGuest(trimmed);
    router.push(next ?? "/");
  }

  return (
    <main
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        padding: 40,
      }}
    >
      <div
        className="panel"
        style={{
          width: 380,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            className="disp"
            style={{ fontSize: 30, fontStyle: "italic", letterSpacing: "-0.01em" }}
          >
            sit at the table
          </div>
          <div
            className="mono upper"
            style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.3em", marginTop: 6 }}
          >
            no chips needed
          </div>
        </div>

        {callbackError && status.kind === "idle" && (
          <div
            className="chip chip-red"
            style={{ alignSelf: "center", padding: "6px 10px" }}
          >
            sign-in failed · try again
          </div>
        )}

        <form
          onSubmit={startAsGuest}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div
            className="mono upper"
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              color: "var(--gold)",
            }}
          >
            play as guest
          </div>
          <input
            type="text"
            required
            placeholder="your name at the table"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            maxLength={20}
            className="mono"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--r-2)",
              border: "1px solid var(--line)",
              background: "rgba(0,0,0,.25)",
              color: "var(--ink)",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            type="submit"
            className="btn btn-gold sparkle"
            style={{ padding: "12px 16px", justifyContent: "center" }}
          >
            start playing
          </button>
          {guestError && (
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--red-glow)",
                textAlign: "center",
              }}
            >
              {guestError}
            </div>
          )}
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--ink-mute)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            session-only · sign in to save your runs
          </div>
        </form>

        <div className="div-label">or sign in</div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={signInWithGitHub}
          disabled={status.kind === "sending"}
          style={{ padding: "10px 14px", justifyContent: "center" }}
        >
          continue with github
        </button>

        <form
          onSubmit={sendMagicLink}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mono"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--r-2)",
              border: "1px solid var(--line)",
              background: "rgba(0,0,0,.25)",
              color: "var(--ink)",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            type="submit"
            className="btn btn-ghost"
            disabled={status.kind === "sending" || !email}
            style={{ padding: "10px 14px", justifyContent: "center" }}
          >
            send magic link
          </button>
        </form>

        {status.kind === "sent" && (
          <div
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--green)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            check {status.email}
            <br />
            click the link to finish signing in.
          </div>
        )}

        {status.kind === "error" && (
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--red-glow)", textAlign: "center" }}
          >
            {status.message}
          </div>
        )}
      </div>
    </main>
  );
}
