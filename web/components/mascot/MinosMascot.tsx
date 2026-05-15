"use client";

import type { CSSProperties } from "react";

export type MascotPose =
  | "idle"
  | "point"
  | "inspect"
  | "approve"
  | "wince"
  | "chipCount"
  | "allIn"
  | "waiting";

const POSE_SRC: Record<MascotPose, string> = {
  idle: "/assets/media/idle.png",
  point: "/assets/media/point.png",
  inspect: "/assets/media/inspect.png",
  approve: "/assets/media/approve.png",
  wince: "/assets/media/wince.png",
  chipCount: "/assets/media/chip-count.png",
  allIn: "/assets/media/allIn.png",
  waiting: "/assets/media/waiting.png",
};

const POSE_ALT: Record<MascotPose, string> = {
  idle: "mascot standing at the table",
  point: "mascot pointing at the board",
  inspect: "mascot inspecting the board",
  approve: "mascot approving a strong move",
  wince: "mascot reacting to a mistake",
  chipCount: "mascot counting chips",
  allIn: "mascot pushing chips all in",
  waiting: "mascot waiting at the table",
};

export function MinosMascot({
  pose,
  size = 620,
  caption,
  variant = "stage",
  align = "center",
  side = "right",
  name = "MINES",
  style,
}: {
  pose: MascotPose;
  size?: number;
  caption?: string;
  variant?: "stage" | "novel" | "panel" | "cutout";
  align?: "left" | "center";
  side?: "left" | "right";
  name?: string;
  style?: CSSProperties;
}) {
  const image = (
    <img
      src={POSE_SRC[pose]}
      alt={POSE_ALT[pose]}
      width={size}
      height={size}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter:
          "drop-shadow(0 5px 0 rgba(0,0,0,0.45)) drop-shadow(0 22px 34px rgba(0,0,0,0.45))",
        userSelect: "none",
        pointerEvents: "none",
        transform: side === "right" ? "scaleX(-1)" : undefined,
      }}
    />
  );

  if (variant === "cutout") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: align === "left" ? "flex-start" : "center",
          gap: caption ? 6 : 0,
          ...style,
        }}
      >
        {image}
        {caption && <MascotCaption>{caption}</MascotCaption>}
      </div>
    );
  }

  if (variant === "stage") {
    const dialogueSidePad = Math.min(280, Math.round(size * 0.36));
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 1,
          ...style,
        }}
      >
        <div
          style={{
            position: "fixed",
            zIndex: 0,
            [side]: -Math.round(size * 0.34),
            bottom: -Math.round(size * 0.02),
            width: size,
            height: size,
            display: "grid",
            placeItems: "center",
            opacity: 0.58,
          }}
        >
          {image}
        </div>

        {caption && (
          <div
            style={{
              position: "fixed",
              zIndex: 2,
              left: 18,
              right: 18,
              bottom: 18,
              minHeight: 88,
              paddingTop: 22,
              paddingBottom: 18,
              paddingLeft: side === "left" ? dialogueSidePad : 22,
              paddingRight: side === "right" ? dialogueSidePad : 22,
              background:
                "linear-gradient(180deg, rgba(28,34,41,0.96), rgba(10,13,18,0.95))",
              border: "1.5px solid var(--gold-deep)",
              borderRadius: 9,
              boxShadow:
                "0 3px 0 #000, 0 18px 38px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,212,114,0.16)",
              overflow: "hidden",
            }}
          >
            <div
              className="mono upper"
              style={{
                position: "absolute",
                top: -1,
                [side]: Math.max(18, dialogueSidePad - 42),
                padding: "5px 12px",
                background: "linear-gradient(180deg, var(--gold-glow), var(--gold))",
                color: "#281a04",
                border: "1px solid #6b4810",
                borderTop: "none",
                borderRadius: "0 0 5px 5px",
                fontSize: 10,
                letterSpacing: "0.18em",
                fontWeight: 900,
                boxShadow: "0 2px 0 #000",
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(20px, 2.1vw, 28px)",
                lineHeight: 1.08,
                fontWeight: 850,
                fontStyle: "italic",
                color: "var(--ink)",
                textShadow: "0 1px 0 #000",
              }}
            >
              {caption}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === "novel" || variant === "panel") {
    const imageInset = Math.round(size * 0.32);
    const dialogueStyle: CSSProperties =
      side === "left"
        ? { marginLeft: imageInset, paddingLeft: Math.round(size * 0.48) }
        : { marginRight: imageInset, paddingRight: Math.round(size * 0.48) };
    return (
      <div
        style={{
          position: "relative",
          minHeight: Math.max(132, Math.round(size * 0.86)),
          display: "flex",
          alignItems: "flex-end",
          justifyContent: side === "left" ? "flex-start" : "flex-end",
          isolation: "isolate",
          ...style,
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: -Math.round(size * 0.08),
            [side]: -Math.round(size * 0.2),
            zIndex: 2,
            width: size,
            height: size,
            display: "grid",
            placeItems: "center",
          }}
        >
          {image}
        </div>

        {caption && (
          <div
            style={{
              ...dialogueStyle,
              position: "relative",
              zIndex: 1,
              width: `calc(100% - ${imageInset}px)`,
              minHeight: 70,
              paddingTop: 18,
              paddingBottom: 14,
              background:
                "linear-gradient(180deg, rgba(28,34,41,0.96), rgba(10,13,18,0.94))",
              border: "1.5px solid var(--gold-deep)",
              borderRadius: 8,
              boxShadow:
                "0 3px 0 #000, 0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,212,114,0.16)",
              overflow: "hidden",
            }}
          >
            <div
              className="mono upper"
              style={{
                position: "absolute",
                top: -1,
                [side]: Math.max(12, Math.round(size * 0.38)),
                padding: "4px 10px",
                background: "linear-gradient(180deg, var(--gold-glow), var(--gold))",
                color: "#281a04",
                border: "1px solid #6b4810",
                borderTop: "none",
                borderRadius: "0 0 5px 5px",
                fontSize: 9,
                letterSpacing: "0.18em",
                fontWeight: 900,
                boxShadow: "0 2px 0 #000",
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                lineHeight: 1.15,
                fontWeight: 800,
                fontStyle: "italic",
                color: "var(--ink)",
                textShadow: "0 1px 0 #000",
              }}
            >
              {caption}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="panel panel-gold"
      style={{
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
        minWidth: 0,
        overflow: "hidden",
        ...style,
      }}
    >
      <div style={{ flex: "0 0 auto" }}>{image}</div>
      {caption && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <MascotCaption>{caption}</MascotCaption>
        </div>
      )}
    </div>
  );
}

function MascotCaption({ children }: { children: string }) {
  return (
    <div
      className="mono upper"
      style={{
        fontSize: 10,
        letterSpacing: "0.18em",
        color: "var(--gold)",
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  );
}
