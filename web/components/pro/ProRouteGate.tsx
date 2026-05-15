"use client";

import Link from "next/link";
import { useProMode } from "./ProProvider";
import { ProToggle } from "./ProToggle";

export function ProRouteGate({
  children,
  title,
  body,
  backHref,
}: {
  children: React.ReactNode;
  title: string;
  body: string;
  backHref?: string;
}) {
  const { isPro } = useProMode();
  if (isPro) return <>{children}</>;

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
        className="panel panel-gold"
        style={{
          width: "min(460px, calc(100vw - 32px))",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          textAlign: "center",
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
          Pro feature
        </div>
        <div
          className="disp"
          style={{
            fontSize: 30,
            fontStyle: "italic",
            letterSpacing: "-0.01em",
          }}
        >
          <span className="foil">{title}</span>
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
          {body}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 8,
          }}
        >
          <ProToggle size="lg" label="Enable Pro" />
        </div>
        {backHref && (
          <Link
            href={backHref}
            className="mono upper"
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              color: "var(--ink-mute)",
              textDecoration: "none",
            }}
          >
            ← back
          </Link>
        )}
      </div>
    </main>
  );
}
