import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const audioRoot = resolve(__dirname, "..", "assets");
const force = process.argv.includes("--force");
const TAU = Math.PI * 2;

let seed = 0x5eedcafe;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

function tone(freq, t, phase = 0) {
  return Math.sin(TAU * freq * t + phase);
}

function normalize(samples, ceiling = 0.92) {
  let peak = 0.0001;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const gain = ceiling / peak;
  return samples.map((sample) => Math.max(-1, Math.min(1, sample * gain)));
}

function writeWav(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  }
  return buffer;
}

async function save(name, samples, sampleRate) {
  const out = resolve(audioRoot, name);
  if (!force && existsSync(out)) {
    console.log(`[audio] kept ${name}`);
    return;
  }
  await writeFile(out, writeWav(normalize(samples), sampleRate));
  console.log(`[audio] wrote ${name}`);
}

function makeChipClatter() {
  const sampleRate = 24000;
  const duration = 0.24;
  const samples = new Array(Math.floor(sampleRate * duration)).fill(0);
  const hits = Array.from({ length: 14 }, (_, i) => ({
    start: 0.006 + i * 0.012 + rand() * 0.018,
    freq: 620 + rand() * 3100,
    dur: 0.032 + rand() * 0.05,
    gain: 0.22 + rand() * 0.42,
    phase: rand() * TAU,
  }));

  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    let v = (rand() * 2 - 1) * 0.04 * Math.exp(-t * 8);
    for (const hit of hits) {
      const dt = t - hit.start;
      if (dt < 0 || dt > hit.dur) continue;
      const click = Math.exp(-dt * 42);
      v += tone(hit.freq, dt, hit.phase) * hit.gain * click;
      v += (rand() * 2 - 1) * 0.06 * click;
    }
    samples[i] = v;
  }
  return { samples, sampleRate };
}

function makeComboChing() {
  const sampleRate = 24000;
  const duration = 0.48;
  const samples = new Array(Math.floor(sampleRate * duration)).fill(0);
  const partials = [1046.5, 1318.5, 1760, 2349.3, 3136];
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.012);
    const decay = Math.exp(-t * 5.8);
    let v = 0;
    partials.forEach((freq, idx) => {
      v += tone(freq * (1 + t * 0.012), t, idx * 0.7) * (0.44 / (idx + 1));
    });
    samples[i] = v * attack * decay;
  }
  return { samples, sampleRate };
}

function makeBoomThump() {
  const sampleRate = 24000;
  const duration = 0.68;
  const samples = new Array(Math.floor(sampleRate * duration)).fill(0);
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const freq = 78 * Math.exp(-t * 3.9) + 31;
    phase += TAU * freq / sampleRate;
    const body = Math.sin(phase) * Math.exp(-t * 4.7);
    const knock = tone(118, t) * Math.exp(-t * 16);
    samples[i] = body * 0.9 + knock * 0.18;
  }
  return { samples, sampleRate };
}

function makeWinFanfare() {
  const sampleRate = 24000;
  const duration = 1.35;
  const samples = new Array(Math.floor(sampleRate * duration)).fill(0);
  const notes = [
    { start: 0.02, freq: 659.25 },
    { start: 0.18, freq: 830.61 },
    { start: 0.34, freq: 987.77 },
    { start: 0.52, freq: 1318.51 },
  ];
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    let v = 0;
    for (const note of notes) {
      const dt = t - note.start;
      if (dt < 0) continue;
      const attack = Math.min(1, dt / 0.018);
      const decay = Math.exp(-dt * 3.2);
      v += tone(note.freq, dt) * 0.42 * attack * decay;
      v += tone(note.freq * 2.01, dt) * 0.16 * attack * decay;
    }
    samples[i] = v;
  }
  return { samples, sampleRate };
}

await mkdir(audioRoot, { recursive: true });
for (const [name, factory] of [
  ["chip_clatter.wav", makeChipClatter],
  ["combo_ching.wav", makeComboChing],
  ["boom_thump.wav", makeBoomThump],
  ["win_fanfare.wav", makeWinFanfare],
]) {
  const { samples, sampleRate } = factory();
  await save(name, samples, sampleRate);
}
