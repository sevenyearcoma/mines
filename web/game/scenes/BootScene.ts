import Phaser from "phaser";
import { roundConfigFromDifficulty, type RoundConfig } from "@/lib/engine";
import type { SoloProgressSnapshot } from "@/lib/solo/progress";

// BootScene only exists to pass the initial RoundConfig into the loading chain.
export default class BootScene extends Phaser.Scene {
  private initialRound: RoundConfig = roundConfigFromDifficulty("intermediate");
  private initialProgress: SoloProgressSnapshot | null = null;

  constructor() {
    super({ key: "BootScene" });
  }

  init(data: { round?: RoundConfig; progress?: SoloProgressSnapshot }) {
    if (data?.round) this.initialRound = data.round;
    this.initialProgress = data?.progress ?? null;
  }

  create() {
    this.scene.start("PreloadScene", {
      round: this.initialRound,
      progress: this.initialProgress ?? undefined,
    });
  }
}
