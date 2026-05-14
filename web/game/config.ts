import type Phaser from "phaser";

export const TILE_COLORS = {
  bg: 0x0e1318,
  panel: 0x1a2229,
  tileFace: 0xd6c69a,
  tileFace2: 0xc2b079,
  tileEdgeHi: 0xf0e2b8,
  tileEdgeLo: 0x8c7943,
  tileEmpty: 0x1a1f25,
  tileEmpty2: 0x232b33,
  gold: 0xe3b248,
  goldGlow: 0xffd472,
  red: 0xd63b3b,
  redGlow: 0xff6a6a,
  green: 0x4caf6a,
} as const;

export const NUM_COLORS: Record<number, string> = {
  1: "#5b9eff",
  2: "#4caf6a",
  3: "#ff7a7a",
  4: "#c97aff",
  5: "#ffaa42",
  6: "#5fdada",
  7: "#ffd472",
  8: "#f1e9d6",
};

// cell size matches the prototype's scaling logic (game-screen.jsx:38)
export function cellSize(cols: number): number {
  return cols > 20 ? 30 : cols > 10 ? 34 : 42;
}

export function buildPhaserConfig(parent: HTMLElement, bootScenes: typeof Phaser.Scene[]): Phaser.Types.Core.GameConfig {
  return {
    type: 0, // Phaser.AUTO — resolved at runtime via dynamic import; literal avoids ssr import
    parent,
    backgroundColor: "#0e1318",
    transparent: true,
    scale: {
      mode: 3, // Phaser.Scale.RESIZE
      autoCenter: 1, // Phaser.Scale.CENTER_BOTH
      width: parent.clientWidth,
      height: parent.clientHeight,
    },
    scene: bootScenes,
    audio: {
      disableWebAudio: false,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
  };
}
