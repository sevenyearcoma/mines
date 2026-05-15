import Phaser from "phaser";
import { roundConfigFromDifficulty, type RoundConfig } from "@/lib/engine";
import type { SoloProgressSnapshot } from "@/lib/solo/progress";
import { GAME_AUDIO_SAMPLES } from "../audio/samples";

export default class PreloadScene extends Phaser.Scene {
  private initialRound: RoundConfig = roundConfigFromDifficulty("intermediate");
  private initialProgress: SoloProgressSnapshot | null = null;

  constructor() {
    super({ key: "PreloadScene" });
  }

  init(data: { round?: RoundConfig; progress?: SoloProgressSnapshot }) {
    if (data?.round) this.initialRound = data.round;
    this.initialProgress = data?.progress ?? null;
  }

  preload() {
    for (const sample of GAME_AUDIO_SAMPLES) {
      this.load.audio(sample.key, sample.url);
    }
  }

  create() {
    this.scene.start("BoardScene", {
      round: this.initialRound,
      progress: this.initialProgress ?? undefined,
    });
  }
}
