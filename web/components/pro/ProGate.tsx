"use client";

import { useProMode } from "./ProProvider";
import { ProToggle } from "./ProToggle";

/**
 * Wraps a Pro-only feature. When Pro mode is off, renders a teaser card with
 * the toggle inline so the user can flip Pro on without leaving the page.
 *
 * Use `inline` for compact teasers (table rows, sidebar items); the default
 * variant renders a full panel.
 */
export function ProGate({
  children,
  title,
  body,
  variant = "panel",
}: {
  children: React.ReactNode;
  title: string;
  body: string;
  variant?: "panel" | "inline";
}) {
  const { isPro } = useProMode();
  if (isPro) return <>{children}</>;

  if (variant === "inline") {
    return (
      <div
        className="mono upper"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 10px",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: "var(--ink-mute)",
          border: "1px dashed var(--line-soft)",
          borderRadius: 4,
          background: "rgba(0,0,0,0.2)",
        }}
        title={body}
      >
        <span>{title}</span>
        <ProToggle size="sm" label={null} />
      </div>
    );
  }

  return (
    <section
      className="panel panel-gold"
      style={{
        padding: 22,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 18,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            color: "var(--gold)",
            letterSpacing: "0.28em",
          }}
        >
          Pro feature
        </div>
        <div
          className="disp"
          style={{
            fontSize: 24,
            fontStyle: "italic",
            letterSpacing: "-0.01em",
            lineHeight: 1.05,
          }}
        >
          <span className="foil">{title}</span>
        </div>
        <p
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-2)",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {body}
        </p>
      </div>
      <ProToggle size="lg" label="Enable Pro" />
    </section>
  );
}
