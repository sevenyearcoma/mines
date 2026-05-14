"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { bridge, type GameOverPayload } from "@/game/bridge";
import { fmtTime } from "@/lib/format";
import { HudReadout } from "../primitives/HudReadout";
import { Ornament } from "../primitives/Ornament";
import type { SaveState } from "@/components/auth/GameRecorder";

const AUTO_RESET_SECONDS = 3;

export function ResultOverlay({
  over,
  autoReset = true,
  saveState,
}: {
  over: GameOverPayload | null;
  autoReset?: boolean;
  saveState?: SaveState;
}) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!over) {
      setCountdown(null);
      return;
    }
    if (!autoReset) {
      setCountdown(null);
      return;
    }
    let n = AUTO_RESET_SECONDS;
    setCountdown(n);
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        setCountdown(null);
        bridge.emit("cmd:reset");
      } else {
        setCountdown(n);
      }
    }, 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        clearInterval(id);
        setCountdown(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [over, autoReset]);

  return (
    <AnimatePresence>
      {over && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,.55), rgba(0,0,0,.85))",
            backdropFilter: "blur(2px)",
            zIndex: 50,
            pointerEvents: "auto",
          }}
        >
          <motion.div
            initial={{ y: 12, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 6, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className={over.won ? "panel panel-gold" : "panel"}
            style={{
              width: 460,
              padding: 32,
              textAlign: "center",
              borderColor: over.won ? "var(--gold-deep)" : "var(--red-deep)",
            }}
          >
            <Ornament w={120} color={over.won ? "var(--gold)" : "var(--red)"} />
            <div
              className="disp"
              style={{
                fontSize: 72,
                marginTop: 8,
                fontStyle: "italic",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              <span
                className={over.won ? "foil" : ""}
                style={
                  !over.won
                    ? {
                        color: "var(--red-glow)",
                        textShadow:
                          "0 0 24px rgba(255,106,106,.6), 0 2px 0 #000",
                      }
                    : {}
                }
              >
                {over.won ? "GOOD RUN" : "BOOM."}
              </span>
            </div>
            <div
              className="mono upper"
              style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 12 }}
            >
              {over.won
                ? `cleared in ${fmtTime(Math.floor(over.elapsedMs / 1000))}`
                : `lost at ${fmtTime(Math.floor(over.elapsedMs / 1000))} · click #${over.clicks}`}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                margin: "22px 0 8px",
              }}
            >
              <HudReadout
                label="time"
                value={fmtTime(Math.floor(over.elapsedMs / 1000))}
                tone={over.won ? "gold" : "red"}
              />
              <HudReadout
                label="opens"
                value={over.opens}
                tone={over.won ? "gold" : "red"}
              />
              <HudReadout
                label="elo"
                value={over.won ? "+18" : "−24"}
                tone={over.won ? "green" : "red"}
              />
            </div>

            {!over.won && (
              <div
                className="panel"
                style={{
                  padding: 12,
                  marginTop: 12,
                  textAlign: "left",
                  background: "rgba(0,0,0,.3)",
                }}
              >
                <div
                  className="mono upper"
                  style={{ fontSize: 9, color: "var(--ink-mute)", marginBottom: 4 }}
                >
                  probability-thinking · cells you could have deduced
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 18,
                    color: "var(--green)",
                  }}
                >
                  {over.postLossHintCount} safe cells were knowable
                </div>
              </div>
            )}

            {saveState && saveState.kind !== "idle" && (
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {saveState.kind === "saving" && (
                  <span
                    className="chip"
                    style={{ color: "var(--ink-mute)" }}
                  >
                    saving…
                  </span>
                )}
                {saveState.kind === "saved" && (
                  <span className="chip chip-green">saved ✓</span>
                )}
                {saveState.kind === "error" && (
                  <span className="chip chip-red">save failed</span>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-gold sparkle"
                onClick={() => bridge.emit("cmd:reset")}
              >
                ↻ {over.won ? "next" : "try again"}
                {countdown !== null ? ` (${countdown})` : ""}
              </button>
            </div>
            {autoReset && countdown !== null && (
              <div
                className="mono upper"
                style={{ fontSize: 9, color: "var(--ink-mute)", marginTop: 14 }}
              >
                auto-reset · esc to cancel
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
