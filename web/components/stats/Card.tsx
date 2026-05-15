"use client";

export function Card({
  title,
  sub,
  children,
  pad = 18,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  pad?: number;
}) {
  return (
    <div
      className="panel"
      style={{
        padding: pad,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div>
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            color: "var(--ink-mute)",
          }}
        >
          {title}
        </div>
        {sub && (
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}
          >
            {sub}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        padding: 14,
        background: "rgba(0,0,0,0.25)",
        border: "1px dashed var(--line-soft)",
        borderRadius: 8,
        fontSize: 11,
        color: "var(--ink-mute)",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}
