import Phaser from "phaser";
import { roundConfigFromDifficulty, type RoundConfig } from "@/lib/engine";
import { GAME_AUDIO_SAMPLES } from "../audio/samples";

export default class PreloadScene extends Phaser.Scene {
  private initialRound: RoundConfig = roundConfigFromDifficulty("intermediate");

  constructor() {
    super({ key: "PreloadScene" });
  }

  init(data: { round?: RoundConfig }) {
    if (data?.round) this.initialRound = data.round;
  }

  preload() {
    for (const sample of GAME_AUDIO_SAMPLES) {
      this.load.audio(sample.key, sample.url);
    }
  }

  create() {
    this.scene.start("BoardScene", { round: this.initialRound });
  }
}
