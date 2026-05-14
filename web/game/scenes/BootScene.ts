import Phaser from "phaser";
import { roundConfigFromDifficulty, type RoundConfig } from "@/lib/engine";

// BootScene only exists to pass the initial RoundConfig into the loading chain.
export default class BootScene extends Phaser.Scene {
  private initialRound: RoundConfig = roundConfigFromDifficulty("intermediate");

  constructor() {
    super({ key: "BootScene" });
  }

  init(data: { round?: RoundConfig }) {
    if (data?.round) this.initialRound = data.round;
  }

  create() {
    this.scene.start("PreloadScene", { round: this.initialRound });
  }
}
