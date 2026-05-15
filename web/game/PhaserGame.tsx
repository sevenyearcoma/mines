"use client";

import { useEffect, useRef } from "react";
import {
  roundConfigFromDifficulty,
  type RoundConfig,
} from "@/lib/engine";
import type { SoloProgressSnapshot } from "@/lib/solo/progress";

export default function PhaserGame({
  initialRound,
  initialProgress,
}: {
  initialRound?: RoundConfig;
  initialProgress?: SoloProgressSnapshot | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // We only call .scene and .destroy on the game from the cleanup path;
  // a structural type keeps Phaser out of this file's static type surface.
  const gameRef = useRef<{
    destroy: (b: boolean) => void;
    scene: {
      scenes: Array<{ scene?: { key?: string } }>;
      stop: (key: string) => unknown;
      start: (key: string, data?: object) => unknown;
    };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Phaser = (await import("phaser")).default;
      const BootScene = (await import("./scenes/BootScene")).default;
      const PreloadScene = (await import("./scenes/PreloadScene")).default;
      const BoardScene = (await import("./scenes/BoardScene")).default;
      if (cancelled || !hostRef.current) return;

      const round =
        initialProgress?.round ??
        initialRound ??
        roundConfigFromDifficulty("intermediate");

      // Mobile detection — narrow viewport OR coarse pointer (real touch).
      // Both heuristics catch tablets too, which we treat as "mobile-class"
      // for rendering purposes.
      const isMobile =
        window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;

      // Cap the renderer pixel ratio. Retina iPhones report DPR=3 → canvas
      // backing store at 9x the pixel count. That's the single biggest GPU
      // bottleneck on mobile; capping at 1.25 looks nearly identical to
      // DPR=3 but cuts pixel work by ~85%.
      if (isMobile) {
        const cappedDpr = 1.25;
        const realDpr = window.devicePixelRatio || 1;
        if (realDpr > cappedDpr) {
          // Phaser reads window.devicePixelRatio at boot; spoof it.
          // The original is preserved via the global object on cleanup so
          // we don't leak the override to the rest of the app.
          Object.defineProperty(window, "devicePixelRatio", {
            configurable: true,
            get: () => cappedDpr,
          });
        }
      }

      const game = new Phaser.Game({
        // Canvas2D on mobile, WebGL on desktop. Canvas2D has a much smaller
        // fixed per-frame cost on weak mobile GPUs (no shader setup, no
        // vertex buffer upload). For a simple-shape game like Minesweeper
        // that's a huge net win — budget Androids that stuttered at 25 FPS
        // on WebGL routinely hit 50+ on Canvas2D.
        type: isMobile ? Phaser.CANVAS : Phaser.AUTO,
        parent: hostRef.current,
        transparent: true,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: hostRef.current.clientWidth,
          height: hostRef.current.clientHeight,
        },
        scene: [BootScene, PreloadScene, BoardScene],
        // On mobile/touch devices we drop multisample AA (huge GPU win on
        // retina phones) and round pixels. Tiles are mostly flat colors so
        // the visual cost is negligible compared to the FPS gain.
        render: {
          antialias: !isMobile,
          antialiasGL: !isMobile,
          roundPixels: isMobile,
          pixelArt: false,
          powerPreference: "default",
        },
        // 30 FPS on mobile — Minesweeper is turn-based, the eye can't tell
        // during static boards, and 30 leaves real headroom for cascades.
        fps: { target: isMobile ? 30 : 60, forceSetTimeOut: false },
        audio: { disableWebAudio: false },
      });

      gameRef.current = game;
      game.scene.start("BootScene", { round, progress: initialProgress ?? undefined });
    })();

    return () => {
      cancelled = true;
      const game = gameRef.current;
      gameRef.current = null;
      if (game) {
        // Stop active scenes first so each scene's SHUTDOWN event fires —
        // that's where bridge listeners detach. Without this, a StrictMode
        // double-mount can leave listeners pointing at a destroyed scene
        // whose `this.tweens` / `this.add` are null, throwing the next time
        // an event arrives.
        try {
          for (const scene of game.scene.scenes) {
            const key = scene.scene?.key;
            if (key) game.scene.stop(key);
          }
        } catch {
          // Best effort — Phaser's scene plugin can already be torn down.
        }
        game.destroy(true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
      }}
    />
  );
}
