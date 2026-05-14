import Phaser from "phaser";
import { bridge } from "../bridge";

// Routes engine events to Phaser's shared SoundManager. Debounces cascades
// so a full-board flood doesn't fire 80 overlapping clacks.
export class SoundDirector {
  private scene: Phaser.Scene;
  private lastRevealAt = 0;

  private onReveal: (p: { count: number }) => void;
  private onFlag: (p: { on: boolean }) => void;
  private onChord: () => void;
  private onBoom: () => void;
  private onWin: () => void;
  private onMute: (v: boolean) => void;
  private onVolume: (v: number) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.onReveal = ({ count }) => {
      const now = performance.now();
      if (now - this.lastRevealAt < 60) return;
      this.lastRevealAt = now;
      this.play("snd-reveal", {
        rate: 0.92 + Math.random() * 0.16,
        volume: Math.min(1, 0.65 + Math.log10(Math.max(1, count)) * 0.18),
      });
    };

    this.onFlag = () => {
      this.play("snd-flag", { volume: 0.2 });
    };

    this.onChord = () => {
      this.play("snd-reveal", { rate: 0.82, volume: 0.88 });
    };

    this.onBoom = () => {
      this.play("snd-loss", { volume: 1 });
    };

    this.onWin = () => {
      this.play("snd-reveal", { rate: 1.35, volume: 1 });
    };

    this.onMute = (v) => {
      this.scene.sound.mute = v;
    };

    this.onVolume = (v) => {
      this.scene.sound.volume = v;
    };

    bridge.on("sound:reveal", this.onReveal);
    bridge.on("sound:flag", this.onFlag);
    bridge.on("sound:chord", this.onChord);
    bridge.on("sound:boom", this.onBoom);
    bridge.on("sound:win", this.onWin);
    bridge.on("cmd:setMuted", this.onMute);
    bridge.on("cmd:setVolume", this.onVolume);
  }

  private play(key: string, config?: Phaser.Types.Sound.SoundConfig) {
    // Guard: skip if the sound hasn't been loaded yet (race during startup).
    if (!this.scene.cache.audio.has(key)) return;
    this.scene.sound.play(key, config);
  }

  destroy() {
    bridge.off("sound:reveal", this.onReveal);
    bridge.off("sound:flag", this.onFlag);
    bridge.off("sound:chord", this.onChord);
    bridge.off("sound:boom", this.onBoom);
    bridge.off("sound:win", this.onWin);
    bridge.off("cmd:setMuted", this.onMute);
    bridge.off("cmd:setVolume", this.onVolume);
  }
}
