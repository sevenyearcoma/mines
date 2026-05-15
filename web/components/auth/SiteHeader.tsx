"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { UserMenu } from "./UserMenu";
import { ProToggle } from "@/components/pro/ProToggle";

export function SiteHeader() {
  const { user, isGuest, loading } = useAuth();
  return (
    <header
      style={{
        height: 48,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        borderBottom: "1px solid var(--gold-deep)",
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.22) 100%)",
        boxShadow:
          "0 1px 0 rgba(255,212,114,0.18), 0 4px 18px rgba(0,0,0,0.55)",
        position: "relative",
        zIndex: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Link
          href="/"
          className="glow-gold"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontStyle: "italic",
            letterSpacing: "0.10em",
            fontSize: 20,
            color: "var(--gold-glow)",
            textDecoration: "none",
          }}
        >
          MINES
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <NavLink href="/daily">daily</NavLink>
          <NavLink href="/match">match</NavLink>
          <NavLink href="/leaderboard">leaderboard</NavLink>
          {user && <NavLink href="/friends">friends</NavLink>}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ProToggle size="sm" label="Pro" />
        {!loading && !user && !isGuest && (
          <Link
            href="/auth/sign-in"
            className="btn btn-gold sparkle"
            style={{ padding: "6px 14px", fontSize: 12 }}
          >
            play
          </Link>
        )}
        {(user || isGuest) && <UserMenu />}
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mono upper"
      style={{
        fontSize: 10,
        letterSpacing: "0.22em",
        color: "var(--ink-2)",
        textDecoration: "none",
        padding: "4px 0",
      }}
    >
      {children}
    </Link>
  );
}
