"use client";

import { useEffect, useRef } from "react";
import {
  roundConfigFromDifficulty,
  type RoundConfig,
} from "@/lib/engine";

export default function PhaserGame({
  initialRound,
}: {
  initialRound?: RoundConfig;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy: (b: boolean) => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Phaser = (await import("phaser")).default;
      const BootScene = (await import("./scenes/BootScene")).default;
      const PreloadScene = (await import("./scenes/PreloadScene")).default;
      const BoardScene = (await import("./scenes/BoardScene")).default;
      if (cancelled || !hostRef.current) return;

      const round =
        initialRound ?? roundConfigFromDifficulty("intermediate");

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        transparent: true,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: hostRef.current.clientWidth,
          height: hostRef.current.clientHeight,
        },
        scene: [BootScene, PreloadScene, BoardScene],
        render: { antialias: true, roundPixels: false },
        audio: { disableWebAudio: false },
      });

      gameRef.current = game;
      game.scene.start("BootScene", { round });
    })();

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    />
  );
}
