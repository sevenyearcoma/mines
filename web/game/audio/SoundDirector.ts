import Phaser from "phaser";
import { bridge } from "../bridge";

const CASCADE_SAMPLE_MIN_CELLS = 5;
const CASCADE_SAMPLE_DEBOUNCE_MS = 95;
const MILESTONE_SAMPLE_DEBOUNCE_MS = 140;
const COIN_LAYER_GAIN = 1 / 3;

type RevealSoundPayload = {
  count: number;
  streak?: number;
  accuracyStreak?: number;
  multiplier?: number;
  speedMultiplier?: number;
  accuracyMultiplier?: number;
  tier?: 0 | 1 | 2 | 3;
  hesitated?: boolean;
  milestone?: boolean;
};

// Routes engine events to Phaser's shared SoundManager. Debounces cascades
// so a full-board flood doesn't fire 80 overlapping clacks.
export class SoundDirector {
  private scene: Phaser.Scene;
  private lastRevealAt = 0;
  private lastCascadeSampleAt = 0;
  private lastMilestoneSampleAt = 0;
  private synthContext: AudioContext | null = null;
  private synthBus: GainNode | null = null;
  private muted = false;
  private volume = 1;

  private onReveal: (p: RevealSoundPayload) => void;
  private onFlag: (p: { on: boolean }) => void;
  private onChord: () => void;
  private onMistake: (p: { lives: number; stunMs: number }) => void;
  private onBoom: () => void;
  private onWin: () => void;
  private onMute: (v: boolean) => void;
  private onVolume: (v: number) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.onReveal = (payload) => {
      const now = performance.now();
      const count = payload.count;
      if (now - this.lastRevealAt >= 60) {
        this.lastRevealAt = now;
        this.play("snd-reveal", {
          rate:
            0.9 +
            Math.random() * 0.12 +
            Math.min(0.26, ((payload.multiplier ?? 1) - 1) * 0.08),
          volume: Math.min(
            1,
            0.58 +
              Math.log10(Math.max(1, count)) * 0.18 +
              (payload.tier ?? 0) * 0.06,
          ),
        });
      }

      if (count >= CASCADE_SAMPLE_MIN_CELLS) {
        this.playCascadeSample(count);
      }

      if (payload.milestone || (payload.tier ?? 0) >= 3) {
        this.playMilestoneSample(payload);
      }

      if (payload.hesitated) {
        this.playComboBreak();
      } else if ((payload.tier ?? 0) > 0) {
        this.playComboTone(payload);
      }
    };

    this.onFlag = () => {
      this.play("snd-flag", { volume: 0.2 });
    };

    this.onChord = () => {
      this.playCascadeSample(10);
      this.play("snd-reveal", { rate: 0.82, volume: 0.88 });
    };

    this.onMistake = () => {
      this.play("snd-loss", { rate: 1.22, volume: 0.42 });
      this.playComboBreak();
    };

    this.onBoom = () => {
      this.play("snd-boom-thump", { rate: 0.94, volume: 0.95 });
      this.play("snd-loss", { volume: 1 });
    };

    this.onWin = () => {
      this.play("snd-win-fanfare", { volume: 0.58 });
      this.play("snd-reveal", { rate: 1.35, volume: 1 });
    };

    this.onMute = (v) => {
      this.muted = v;
      if (this.scene.sound) this.scene.sound.mute = v;
      this.syncSynthBus();
    };

    this.onVolume = (v) => {
      this.volume = v;
      if (this.scene.sound) this.scene.sound.volume = v;
      this.syncSynthBus();
    };

    bridge.on("sound:reveal", this.onReveal);
    bridge.on("sound:flag", this.onFlag);
    bridge.on("sound:chord", this.onChord);
    bridge.on("sound:mistake", this.onMistake);
    bridge.on("sound:boom", this.onBoom);
    bridge.on("sound:win", this.onWin);
    bridge.on("cmd:setMuted", this.onMute);
    bridge.on("cmd:setVolume", this.onVolume);
  }

  private play(key: string, config?: Phaser.Types.Sound.SoundConfig) {
    // Guard: skip if the sound hasn't been loaded yet (race during startup).
    const audioCache = this.scene.cache?.audio;
    if (!this.scene.sound || !audioCache || !audioCache.has(key)) return;
    this.scene.sound.play(key, config);
  }

  private playCascadeSample(count: number) {
    const now = performance.now();
    if (now - this.lastCascadeSampleAt < CASCADE_SAMPLE_DEBOUNCE_MS) return;
    this.lastCascadeSampleAt = now;
    this.play("snd-chip-clatter", {
      rate: 0.94 + Math.random() * 0.11,
      volume: Math.min(0.82, 0.34 + Math.log10(Math.max(2, count)) * 0.22),
    });
  }

  private playMilestoneSample(payload: RevealSoundPayload) {
    const now = performance.now();
    if (now - this.lastMilestoneSampleAt < MILESTONE_SAMPLE_DEBOUNCE_MS) return;
    this.lastMilestoneSampleAt = now;
    const tier = payload.tier ?? 1;
    const volume = Math.min(0.9, 0.46 + tier * 0.1) * COIN_LAYER_GAIN;
    this.play("snd-combo-ching", {
      rate: 0.96 + tier * 0.035,
      volume,
    });
  }

  private ensureSynthContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.synthContext) {
      const AudioContextCtor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) return null;
      this.synthContext = new AudioContextCtor();
      this.synthBus = this.synthContext.createGain();
      this.synthBus.connect(this.synthContext.destination);
      this.syncSynthBus();
    }
    if (this.synthContext.state === "suspended") {
      void this.synthContext.resume();
    }
    return this.synthContext;
  }

  private syncSynthBus() {
    if (!this.synthBus) return;
    this.synthBus.gain.value = this.muted ? 0 : 0.22 * this.volume;
  }

  private playComboTone(payload: RevealSoundPayload) {
    const ctx = this.ensureSynthContext();
    if (!ctx || !this.synthBus) return;

    const tier = payload.tier ?? 1;
    const multiplier = payload.multiplier ?? 1;
    const speedMultiplier = payload.speedMultiplier ?? multiplier;
    const accuracyMultiplier = payload.accuracyMultiplier ?? 1;
    const streak = payload.streak ?? 1;
    const notes = tier >= 3 || payload.milestone ? 3 : tier >= 2 ? 2 : 1;
    const base =
      220 +
      Math.min(
        460,
        streak * 15 + speedMultiplier * 54 + accuracyMultiplier * 32,
      );

    for (let i = 0; i < notes; i++) {
      const start = ctx.currentTime + i * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = base * (1 + i * 0.24) * (tier >= 3 ? 1.08 : 1);

      osc.type = tier >= 3 ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.22, start + 0.09);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.035 + tier * 0.026, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18 + tier * 0.025);
      osc.connect(gain);
      gain.connect(this.synthBus);
      osc.start(start);
      osc.stop(start + 0.24 + tier * 0.025);
    }

    if (tier >= 2) this.playCoinNoise(tier);
  }

  private playComboBreak() {
    const ctx = this.ensureSynthContext();
    if (!ctx || !this.synthBus) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(190, start);
    osc.frequency.exponentialRampToValueAtTime(88, start + 0.18);
    gain.gain.setValueAtTime(0.025, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain);
    gain.connect(this.synthBus);
    osc.start(start);
    osc.stop(start + 0.24);
  }

  private playCoinNoise(tier: number) {
    const ctx = this.ensureSynthContext();
    if (!ctx || !this.synthBus) return;

    const length = Math.floor(ctx.sampleRate * 0.07);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const fade = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * fade * fade;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const start = ctx.currentTime + 0.015;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(tier >= 3 ? 2400 : 1700, start);
    filter.Q.value = 7;
    gain.gain.setValueAtTime((0.018 + tier * 0.012) * COIN_LAYER_GAIN, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.synthBus);
    source.start(start);
    source.stop(start + 0.09);
  }

  destroy() {
    bridge.off("sound:reveal", this.onReveal);
    bridge.off("sound:flag", this.onFlag);
    bridge.off("sound:chord", this.onChord);
    bridge.off("sound:mistake", this.onMistake);
    bridge.off("sound:boom", this.onBoom);
    bridge.off("sound:win", this.onWin);
    bridge.off("cmd:setMuted", this.onMute);
    bridge.off("cmd:setVolume", this.onVolume);
    void this.synthContext?.close();
    this.synthContext = null;
    this.synthBus = null;
  }
}
