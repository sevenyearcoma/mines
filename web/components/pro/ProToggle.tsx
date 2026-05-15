"use client";

import { useProMode } from "./ProProvider";

export function ProToggle({
  size = "md",
  label = "Pro",
}: {
  size?: "sm" | "md" | "lg";
  label?: string | null;
}) {
  const { isPro, toggle } = useProMode();

  const dims = {
    sm: { w: 32, h: 18, knob: 12, fontSize: 9 },
    md: { w: 44, h: 24, knob: 18, fontSize: 11 },
    lg: { w: 60, h: 32, knob: 24, fontSize: 13 },
  }[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPro}
      onClick={toggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: isPro ? "var(--gold-glow)" : "var(--ink-mute)",
        fontFamily: "var(--font-mono)",
        fontSize: dims.fontSize,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        fontWeight: 700,
      }}
    >
      {label && <span>{label}</span>}
      <span
        style={{
          position: "relative",
          width: dims.w,
          height: dims.h,
          borderRadius: 999,
          border: "1px solid",
          borderColor: isPro ? "var(--gold-deep)" : "var(--line)",
          background: isPro
            ? "linear-gradient(180deg, rgba(227, 178, 72, 0.45), rgba(180, 129, 39, 0.55))"
            : "rgba(0,0,0,0.45)",
          boxShadow: isPro
            ? "inset 0 1px 0 rgba(255,212,114,0.35), 0 0 14px rgba(227,178,72,0.35)"
            : "inset 0 2px 4px rgba(0,0,0,0.55)",
          transition: "background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease",
          flex: "0 0 auto",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: (dims.h - dims.knob) / 2 - 1,
            left: isPro ? dims.w - dims.knob - 3 : 2,
            width: dims.knob,
            height: dims.knob,
            borderRadius: "50%",
            background: isPro
              ? "linear-gradient(180deg, #ffe294 0%, #e3b248 60%, #b48127 100%)"
              : "linear-gradient(180deg, #595d66, #2a2f37)",
            boxShadow: isPro
              ? "0 1px 0 #6b4810, 0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.45)"
              : "0 1px 0 #000, 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
            transition: "left 0.22s cubic-bezier(.34, 1.56, .64, 1), background 0.22s ease",
          }}
        />
      </span>
    </button>
  );
}
