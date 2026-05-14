"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
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

  if (!user) return null;

  const name = profile?.username ?? user.email?.split("@")[0] ?? "player";
  const initial = name.charAt(0).toUpperCase();

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
            background: "var(--gold)",
            color: "#1a1206",
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
        </span>
      </button>

      {open && (
        <div
          className="panel"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 180,
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
            sign out
          </button>
        </div>
      )}
    </div>
  );
}
