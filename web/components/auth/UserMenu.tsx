"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

export function UserMenu() {
  const { user, profile, guest, isGuest, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user && !isGuest) return null;

  const name = user
    ? profile?.username ?? user.email?.split("@")[0] ?? "player"
    : guest?.name ?? "guest";
  const initial = name.charAt(0).toUpperCase();
  const ringColor = isGuest ? "#8c7e57" : "var(--gold)";
  const ringText = isGuest ? "#1a1812" : "#1a1206";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "6px 10px 6px 6px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: ringColor,
            color: ringText,
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontFamily: "var(--font-display)",
            fontSize: 13,
          }}
        >
          {initial}
        </span>
        <span className="mono" style={{ fontSize: 12 }}>
          {name}
          {isGuest && (
            <span
              className="mono upper"
              style={{
                marginLeft: 6,
                fontSize: 9,
                letterSpacing: "0.18em",
                color: "var(--ink-mute)",
              }}
            >
              guest
            </span>
          )}
        </span>
      </button>

      {open && (
        <div
          className="panel"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 200,
            padding: 6,
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Link
            href="/profile"
            className="btn btn-ghost"
            onClick={() => setOpen(false)}
            style={{
              justifyContent: "flex-start",
              padding: "8px 10px",
              fontSize: 12,
              border: "none",
            }}
          >
            profile
          </Link>
          {isGuest && (
            <Link
              href="/auth/sign-in"
              className="btn btn-ghost"
              onClick={() => setOpen(false)}
              style={{
                justifyContent: "flex-start",
                padding: "8px 10px",
                fontSize: 12,
                border: "none",
                color: "var(--gold)",
              }}
            >
              sign up to save
            </Link>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            style={{
              justifyContent: "flex-start",
              padding: "8px 10px",
              fontSize: 12,
              border: "none",
              textAlign: "left",
            }}
          >
            {isGuest ? "leave the table" : "sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
