import Phaser from "phaser";
import { roundConfigFromDifficulty, type RoundConfig } from "@/lib/engine";

export default class PreloadScene extends Phaser.Scene {
  private initialRound: RoundConfig = roundConfigFromDifficulty("intermediate");

  constructor() {
    super({ key: "PreloadScene" });
  }

  init(data: { round?: RoundConfig }) {
    if (data?.round) this.initialRound = data.round;
  }

  preload() {
    this.load.audio("snd-reveal", "/assets/audio/open_tiles.ogg");
    this.load.audio("snd-flag", "/assets/audio/flag.ogg");
    this.load.audio("snd-loss", "/assets/audio/loss.ogg");
  }

  create() {
    this.scene.start("BoardScene", { round: this.initialRound });
  }
}
