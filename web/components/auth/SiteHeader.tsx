"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { UserMenu } from "./UserMenu";

export function SiteHeader() {
  const { user, loading } = useAuth();
  return (
    <header
      style={{
        height: 48,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        borderBottom: "1px solid var(--line-soft)",
        background: "rgba(0,0,0,.18)",
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontStyle: "italic",
          letterSpacing: "0.08em",
          fontSize: 18,
          color: "var(--gold)",
          textDecoration: "none",
        }}
      >
        MINES
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!loading && !user && (
          <Link
            href="/auth/sign-in"
            className="btn btn-ghost"
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            sign in
          </Link>
        )}
        {user && <UserMenu />}
      </div>
    </header>
  );
}
