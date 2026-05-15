import Phaser from "phaser";
import {
  applyMistake,
  applyRevealWithFeedback,
  chord as engineChord,
  countFlags,
  deducibleSafe,
  emptyBoard,
  finalizeScore,
  flag as engineFlag,
  isWin,
  newScoreState,
  plant,
  reveal as engineReveal,
  revealAllMines,
  roundConfigFromDifficulty,
  SCORE_CONSTANTS,
  type ActionLogEntry,
  type Board,
  type Difficulty,
  type RoundConfig,
  type RoundEndReason,
  type RoundResult,
  type RevealScoreFeedback,
  type ScoreBreakdown,
  type ScoreState,
} from "@/lib/engine";
import type { CellEvent } from "@/lib/multiplayer/protocol";
import {
  isSoloProgressSnapshot,
  SOLO_PROGRESS_VERSION,
  type SoloProgressSnapshot,
} from "@/lib/solo/progress";
import { bridge, type BoardSnapshot, type GameStats } from "../bridge";
import { NUM_COLORS, TILE_COLORS, cellSize as cellSizeFor } from "../config";
import { SoundDirector } from "../audio/SoundDirector";

type TileVisual = {
  container: Phaser.GameObjects.Container;
  cover: Phaser.GameObjects.Graphics;
  reveal: Phaser.GameObjects.Graphics;
  number: Phaser.GameObjects.Text;
  flag: Phaser.GameObjects.Graphics;
  bomb: Phaser.GameObjects.Graphics;
  hint: Phaser.GameObjects.Graphics;
  isRevealed: boolean;
  isFlagged: boolean;
};

export default class BoardScene extends Phaser.Scene {
  private round: RoundConfig = roundConfigFromDifficulty("intermediate");
  private board!: Board;
  private tiles: TileVisual[][] = [];
  private rows = 16;
  private cols = 16;
  private mines = 40;
  private seed = 0;
  private planted = false;
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  private gameOver = false;
  private won = false;
  private opens = 0;
  private clicks = 0;
  private chains = 0;
  private lives: number = SCORE_CONSTANTS.MAX_LIVES;
  private stunnedUntilMs: number | null = null;
  // Cross-game win streak. Casual mode only; match mode resets per match.
  private streak = 0;
  private streakBest = 0;
  private size = 34;
  private actions: ActionLogEntry[] = [];
  private scoreState: ScoreState = newScoreState();
  private soundDirector?: SoundDirector;
  private gridContainer!: Phaser.GameObjects.Container;
  private frame!: Phaser.GameObjects.Graphics;

  private leftDown = false;
  private rightDown = false;
  private chordConsumed = false;
  private hoverCell: { r: number; c: number } | null = null;
  private touchDownCell: { r: number; c: number } | null = null;
  private touchHoldTimer?: Phaser.Time.TimerEvent;
  private touchHandled = false;
  private touchCancelled = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private statsTimer?: Phaser.Time.TimerEvent;
  private originX = 0;
  private originY = 0;
  private readonly gap = 2;
  private readonly touchHoldMs = 420;
  private readonly touchMoveTolerance = 12;
  // Spectator state: when on, all input is disabled and the local engine is
  // frozen. Remote events drive the visuals only.
  private spectator = false;
  private spectatorName = "";
  private pendingProgress: SoloProgressSnapshot | null = null;
  private lastProgressEmitAt = 0;
  // Visual overlay shown during the post-mistake stun. Holds every transient
  // object so a round reset / scene shutdown can rip them out cleanly.
  private stunFx: {
    objects: Phaser.GameObjects.GameObject[];
    timers: Phaser.Time.TimerEvent[];
    tweens: Phaser.Tweens.Tween[];
    sparkTimer?: Phaser.Time.TimerEvent;
  } | null = null;

  // True on mobile / touch devices. Used to skip non-essential tweens and
  // particle effects — the single biggest CPU cost during cascades on a
  // mid-tier phone. Final visual difference is a slightly less juicy reveal
  // animation in exchange for a stable 45+ FPS.
  private lowEnd = false;

  constructor() {
    super({ key: "BoardScene" });
  }

  init(data: {
    round?: RoundConfig;
    difficulty?: Difficulty;
    progress?: SoloProgressSnapshot;
  }) {
    if (data?.progress && isSoloProgressSnapshot(data.progress)) {
      this.pendingProgress = data.progress;
      this.round = data.progress.round;
    } else if (data?.round) {
      this.round = data.round;
    } else if (data?.difficulty) {
      this.round = roundConfigFromDifficulty(data.difficulty);
    }
  }

  create() {
    // Detect once at scene creation — viewport size and pointer fidelity
    // are stable enough for the lifetime of a session.
    this.lowEnd =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;

    // Transparent canvas (set via `transparent: true` in PhaserGame's game
    // config) lets the mascot rail behind show through the empty space
    // around the board.

    this.gridContainer = this.add.container(0, 0);
    this.frame = this.add.graphics();
    this.gridContainer.add(this.frame);

    // SoundDirector lives here so it survives for the entire game session.
    // BootScene shuts down after handing off to PreloadScene, so it cannot host it.
    this.soundDirector = new SoundDirector(this);

    this.input.mouse?.disableContextMenu();
    this.setDefaultCursor("pointer");

    this.setupBoard();
    this.layout();

    this.scale.on("resize", () => this.layout());

    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);

    // command channel from React
    bridge.on("cmd:reset", this.resetBoard);
    bridge.on("cmd:setDifficulty", this.changeDifficulty);
    bridge.on("cmd:loadRound", this.loadRound);
    bridge.on("cmd:loadProgress", this.loadProgress);
    bridge.on("cmd:enterSpectator", this.enterSpectator);
    bridge.on("cmd:applyRemoteEvents", this.applyRemoteEvents);

    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.round.mode === "casual") this.resetBoard();
    });

    // 4 fps stats tick for the React HUD (also drives timer enforcement)
    this.statsTimer = this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.tick(),
    });

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.soundDirector?.destroy();
      this.clearStunFx();
      this.clearTouchGesture();
      bridge.off("cmd:reset", this.resetBoard);
      bridge.off("cmd:setDifficulty", this.changeDifficulty);
      bridge.off("cmd:loadRound", this.loadRound);
      bridge.off("cmd:loadProgress", this.loadProgress);
      bridge.off("cmd:enterSpectator", this.enterSpectator);
      bridge.off("cmd:applyRemoteEvents", this.applyRemoteEvents);
      this.statsTimer?.remove();
      this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);
    });
  }

  private setupBoard() {
    const progress =
      this.pendingProgress &&
      isSoloProgressSnapshot(this.pendingProgress, this.round.difficulty)
        ? this.pendingProgress
        : null;
    this.pendingProgress = null;
    this.rows = this.round.rows;
    this.cols = this.round.cols;
    this.mines = this.round.mines;
    this.seed = this.round.seed;
    this.size = cellSizeFor(this.cols);
    this.board = emptyBoard(this.rows, this.cols);
    this.planted = false;
    this.startedAt = this.round.mode === "match" ? Date.now() : null;
    this.endedAt = null;
    this.gameOver = false;
    this.won = false;
    this.opens = 0;
    this.clicks = 0;
    this.chains = 0;
    this.lives = this.round.maxLives ?? SCORE_CONSTANTS.MAX_LIVES;
    this.stunnedUntilMs = null;
    this.actions = [];
    this.scoreState = newScoreState();
    this.leftDown = false;
    this.rightDown = false;
    this.chordConsumed = false;
    this.hoverCell = null;
    this.clearTouchGesture();
    this.spectator = false;
    this.spectatorName = "";
    this.lastProgressEmitAt = 0;
    this.clearStunFx();

    // destroy any previous tile visuals
    this.tiles.flat().forEach((t) => t?.container?.destroy());
    this.tiles = [];

    for (let r = 0; r < this.rows; r++) {
      const row: TileVisual[] = [];
      for (let c = 0; c < this.cols; c++) {
        row.push(this.makeTile(r, c));
      }
      this.tiles.push(row);
    }

    bridge.emit("round:start", { config: this.round });
    // legacy event for the existing casual HUD / GameRecorder
    if (this.round.mode === "casual") {
      bridge.emit("game:start", {
        difficulty: this.round.difficulty ?? "intermediate",
        seed: this.seed,
        restored: progress !== null,
      });
    }

    if (progress) {
      this.restoreProgress(progress);
    }

    // Pre-planted rounds place mines deterministically and open the anchor
    // cell so every player sees the same starting position. Match clocks start
    // on board load; daily clocks start on the first real interaction.
    if (!progress && this.round.prePlant) {
      const { r, c } = this.round.prePlant;
      plant(this.board, this.mines, this.seed, r, c);
      this.planted = true;
      const res = engineReveal(this.board, r, c);
      this.opens = res.revealed.length;
      this.emitCellEvents(this.toRevealEvents(res.revealed));
      // Stagger the open by BFS distance so the centre "blooms" outward —
      // sells the daily as a curated starting position.
      for (const rev of res.revealed) {
        const stagger = rev.dist * 18;
        this.time.delayedCall(stagger, () =>
          this.applyRevealVisual(rev.r, rev.c),
        );
      }
    }

    this.emitStats();
    this.emitProgress(true);
  }

  private resetBoard = () => {
    // Match-mode rounds aren't player-resettable — only the match controller
    // decides when the next round loads. Daily challenges are one-shot per
    // UTC day, so they're not resettable either.
    if (this.round.mode === "match" || this.round.mode === "daily") return;
    const carryStreak = this.gameOver && this.won;
    const prevStreak = this.streak;
    const prevBest = Math.max(this.streakBest, this.streak);
    // Re-roll the seed for the next casual game.
    this.round = roundConfigFromDifficulty(
      this.round.difficulty ?? "intermediate",
      undefined,
      "casual",
    );
    this.setupBoard();
    this.streak = carryStreak ? prevStreak : 0;
    this.streakBest = prevBest;
    bridge.emit("game:reset");
    this.layout();
    this.emitStats();
  };

  private changeDifficulty = (d: Difficulty) => {
    if (this.round.mode === "match" || this.round.mode === "daily") return;
    if (d === this.round.difficulty) return;
    this.round = roundConfigFromDifficulty(d, undefined, "casual");
    this.streak = 0;
    this.streakBest = Math.max(this.streakBest, this.streak);
    this.setupBoard();
    this.layout();
    this.emitStats();
  };

  private loadRound = (config: RoundConfig) => {
    if (!this.input?.manager) return;
    this.round = config;
    // Streak is a casual concept; match rounds are sovereign.
    this.streak = 0;
    this.streakBest = 0;
    this.setupBoard();
    this.layout();
    this.emitStats();
  };

  private loadProgress = (progress: SoloProgressSnapshot) => {
    if (!this.input?.manager) return;
    if (!isSoloProgressSnapshot(progress)) return;
    if (progress.round.mode !== "casual") return;
    this.pendingProgress = progress;
    this.round = progress.round;
    this.setupBoard();
    this.layout();
    this.emitStats();
  };

  private makeTile(r: number, c: number): TileVisual {
    const s = this.size;
    const container = this.add.container(0, 0);
    container.setSize(s, s);

    const cover = this.add.graphics();
    this.drawCover(cover, s);

    const revealG = this.add.graphics();
    revealG.setVisible(false);

    const number = this.add
      .text(s / 2, s / 2, "", {
        fontFamily: "Fraunces, serif",
        fontSize: `${Math.floor(s * 0.62)}px`,
        fontStyle: "800",
        color: "#fff",
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    const flagG = this.add.graphics();
    flagG.setVisible(false);

    const bombG = this.add.graphics();
    bombG.setVisible(false);

    const hint = this.add.graphics();
    hint.setVisible(false);

    container.add([cover, revealG, hint, number, flagG, bombG]);

    return {
      container,
      cover,
      reveal: revealG,
      number,
      flag: flagG,
      bomb: bombG,
      hint,
      isRevealed: false,
      isFlagged: false,
    };
  }

  private drawCover(g: Phaser.GameObjects.Graphics, s: number, hover = false) {
    g.clear();
    const top = hover ? 0xe6d8aa : TILE_COLORS.tileFace;
    const bottom = hover ? 0xd0bd85 : TILE_COLORS.tileFace2;
    g.fillStyle(bottom);
    g.fillRoundedRect(0, 0, s, s, 4);
    g.fillStyle(top);
    g.fillRoundedRect(0, 0, s, s - 3, 4);
    // bevel highlights
    g.lineStyle(1.5, TILE_COLORS.tileEdgeHi, 0.9);
    g.beginPath();
    g.moveTo(2, 1);
    g.lineTo(s - 2, 1);
    g.strokePath();
    g.lineStyle(1.5, TILE_COLORS.tileEdgeLo, 0.9);
    g.beginPath();
    g.moveTo(2, s - 1);
    g.lineTo(s - 2, s - 1);
    g.strokePath();
  }

  private drawRevealed(g: Phaser.GameObjects.Graphics, s: number) {
    g.clear();
    g.fillStyle(TILE_COLORS.tileEmpty);
    g.fillRoundedRect(0, 0, s, s, 4);
    g.fillStyle(TILE_COLORS.tileEmpty2, 0.6);
    g.fillRoundedRect(1, 1, s - 2, s - 2, 3);
    g.lineStyle(1, 0x000000, 0.6);
    g.strokeRoundedRect(0.5, 0.5, s - 1, s - 1, 4);
  }

  private drawFlag(g: Phaser.GameObjects.Graphics, s: number) {
    g.clear();
    // flag base tile background tint
    g.fillStyle(0xe8d8a8);
    g.fillRoundedRect(0, 0, s, s, 4);
    g.fillStyle(0xc2b079, 0.5);
    g.fillRoundedRect(0, s * 0.7, s, s * 0.3, 4);
    // flag triangle
    const pad = s * 0.18;
    g.fillStyle(TILE_COLORS.red);
    g.beginPath();
    g.moveTo(pad, pad);
    g.lineTo(s - pad, pad + (s - 2 * pad) * 0.22);
    g.lineTo(pad, pad + (s - 2 * pad) * 0.44);
    g.closePath();
    g.fillPath();
    // pole
    g.lineStyle(2, 0x2a0a0a, 1);
    g.beginPath();
    g.moveTo(pad, pad);
    g.lineTo(pad, s - pad);
    g.strokePath();
  }

  private drawBomb(g: Phaser.GameObjects.Graphics, s: number, isBoom = false) {
    g.clear();
    // background
    if (isBoom) {
      g.fillStyle(0xff8a3c);
      g.fillRoundedRect(0, 0, s, s, 4);
      g.fillStyle(TILE_COLORS.red, 0.85);
      g.fillCircle(s / 2, s / 2, s * 0.55);
    } else {
      g.fillStyle(0x3a0a0a);
      g.fillRoundedRect(0, 0, s, s, 4);
      g.fillStyle(0x8a1f1f);
      g.fillCircle(s / 2, s / 2, s * 0.42);
      g.fillStyle(0xff5b5b);
      g.fillCircle(s / 2, s * 0.4, s * 0.25);
    }
    // bomb sphere
    g.fillStyle(0x0a0a0a);
    g.fillCircle(s / 2, s / 2, s * 0.28);
    // shine
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(s * 0.4, s * 0.4, s * 0.07);
  }

  private drawHint(g: Phaser.GameObjects.Graphics, s: number) {
    g.clear();
    g.lineStyle(2, TILE_COLORS.green, 0.95);
    g.strokeRoundedRect(1, 1, s - 2, s - 2, 4);
  }

  private framePadForSize(s: number): number {
    return Math.max(6, Math.min(18, Math.round(s * 0.45)));
  }

  private frameRadiusForSize(s: number): number {
    return Math.max(6, Math.min(14, Math.round(s * 0.45)));
  }

  private fittedCellSize(): number {
    const base = cellSizeFor(this.cols);
    const width = Math.max(1, this.scale.width);
    const height = Math.max(1, this.scale.height);
    const margin = width <= 520 ? 8 : 16;
    let fitted = base;

    for (let i = 0; i < 2; i++) {
      const pad = this.framePadForSize(fitted);
      const fitW = Math.floor(
        (width - margin * 2 - pad * 2 - (this.cols - 1) * this.gap) /
          this.cols,
      );
      const fitH = Math.floor(
        (height - margin * 2 - pad * 2 - (this.rows - 1) * this.gap) /
          this.rows,
      );
      fitted = Math.min(base, fitW, fitH);
    }

    const min = this.cols > 20 ? 7 : this.cols > 10 ? 10 : 18;
    return Math.max(min, Math.min(base, Math.floor(fitted)));
  }

  private resizeTileVisuals() {
    const s = this.size;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.tiles[r]?.[c];
        if (!t) continue;

        t.container.setSize(s, s);
        t.number.setPosition(s / 2, s / 2);
        t.number.setFontSize(`${Math.floor(s * 0.62)}px`);
        this.drawCover(t.cover, s, false);
        if (t.reveal.visible) this.drawRevealed(t.reveal, s);
        if (t.flag.visible) this.drawFlag(t.flag, s);
        if (t.bomb.visible) this.drawBomb(t.bomb, s, false);
        if (t.hint.visible) this.drawHint(t.hint, s);
      }
    }
  }

  private layout() {
    const nextSize = this.fittedCellSize();
    if (nextSize !== this.size) {
      this.size = nextSize;
      this.resizeTileVisuals();
    }

    const s = this.size;
    const pad = this.framePadForSize(s);
    const radius = this.frameRadiusForSize(s);
    const innerRadius = Math.max(4, radius - 5);
    const w = this.cols * s + (this.cols - 1) * this.gap;
    const h = this.rows * s + (this.rows - 1) * this.gap;

    const frameW = w + pad * 2;
    const frameH = h + pad * 2;
    const ox = Math.max(4, Math.round((this.scale.width - frameW) / 2));
    const oy = Math.max(4, Math.round((this.scale.height - frameH) / 2));

    this.frame.clear();
    // outer frame: very faint panel fill so the mascot reads through, plus the
    // signature gold border.
    this.frame.fillStyle(0x0f1418, 0.55);
    this.frame.fillRoundedRect(ox, oy, frameW, frameH, radius);
    this.frame.lineStyle(2, 0xb48127);
    this.frame.strokeRoundedRect(ox, oy, frameW, frameH, radius);
    this.frame.lineStyle(1, 0xe3b248, 0.3);
    this.frame.strokeRoundedRect(
      ox + 6,
      oy + 6,
      frameW - 12,
      frameH - 12,
      innerRadius,
    );

    // position tiles and cache origin for pointer math
    const x0 = ox + pad;
    const y0 = oy + pad;
    this.originX = x0;
    this.originY = y0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.tiles[r][c];
        t.container.x = x0 + c * (s + this.gap);
        t.container.y = y0 + r * (s + this.gap);
      }
    }
    // clear stale hover after layout shift
    this.hoverCell = null;
  }

  // Convert world pointer position → grid cell. Gaps are absorbed into the
  // adjacent tile so there are no dead zones.
  private cellFromPointer(p: Phaser.Input.Pointer): { r: number; c: number } | null {
    const step = this.size + this.gap;
    const lx = p.worldX - this.originX;
    const ly = p.worldY - this.originY;
    const c = Math.floor(lx / step);
    const r = Math.floor(ly / step);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols || lx < 0 || ly < 0) return null;
    return { r, c };
  }

  private isTouchPointer(p: Phaser.Input.Pointer): boolean {
    const pointerType = (p as { pointerType?: string }).pointerType;
    const event = p.event as
      | (Event & {
          pointerType?: string;
          touches?: TouchList;
          changedTouches?: TouchList;
        })
      | undefined;
    return (
      pointerType === "touch" ||
      pointerType === "pen" ||
      event?.pointerType === "touch" ||
      event?.pointerType === "pen" ||
      event?.touches !== undefined ||
      event?.changedTouches !== undefined
    );
  }

  private preventTouchDefault(p: Phaser.Input.Pointer): void {
    p.event?.preventDefault?.();
  }

  private clearTouchGesture() {
    this.touchHoldTimer?.remove(false);
    this.touchHoldTimer = undefined;
    this.touchDownCell = null;
    this.touchHandled = false;
    this.touchCancelled = false;
  }

  private handlePointerMove = (p: Phaser.Input.Pointer) => {
    if (this.isTouchPointer(p)) {
      if (this.touchDownCell) {
        const dx = p.x - this.touchStartX;
        const dy = p.y - this.touchStartY;
        if (Math.hypot(dx, dy) > this.touchMoveTolerance) {
          this.touchCancelled = true;
          this.touchHoldTimer?.remove(false);
          this.touchHoldTimer = undefined;
        }
      }
      return;
    }

    const cell = this.cellFromPointer(p);
    const prevR = this.hoverCell?.r;
    const prevC = this.hoverCell?.c;
    if (cell?.r === prevR && cell?.c === prevC) return;
    // clear previous hover
    if (prevR !== undefined && prevC !== undefined) {
      const t = this.tiles[prevR][prevC];
      if (t && !t.isRevealed && !t.isFlagged) {
        this.drawCover(t.cover, this.size, false);
      }
    }
    this.hoverCell = cell;
    if (cell && !this.gameOver && !this.isStunned()) {
      const t = this.tiles[cell.r][cell.c];
      if (t && !t.isRevealed && !t.isFlagged) {
        this.drawCover(t.cover, this.size, true);
      }
    }
  };

  private handlePointerDown = (p: Phaser.Input.Pointer) => {
    if (this.gameOver || this.spectator || this.isStunned()) return;
    if (this.isTouchPointer(p)) {
      this.preventTouchDefault(p);
      this.clearTouchGesture();
      const cell = this.cellFromPointer(p);
      this.touchDownCell = cell;
      this.touchStartX = p.x;
      this.touchStartY = p.y;
      if (cell) {
        this.touchHoldTimer = this.time.delayedCall(this.touchHoldMs, () => {
          const held = this.touchDownCell;
          if (!held || this.gameOver || this.spectator || this.isStunned()) return;
          this.touchHandled = true;
          const boardCell = this.board[held.r]?.[held.c];
          if (boardCell?.revealed) this.tryChord(held.r, held.c);
          else this.tryFlag(held.r, held.c);
        });
      }
      return;
    }

    if (p.leftButtonDown()) this.leftDown = true;
    if (p.rightButtonDown()) this.rightDown = true;
    if (this.leftDown && this.rightDown && !this.chordConsumed) {
      const cell = this.cellFromPointer(p);
      if (cell) {
        this.chordConsumed = true;
        this.tryChord(cell.r, cell.c);
      }
    }
  };

  private handlePointerUp = (p: Phaser.Input.Pointer) => {
    if (this.isTouchPointer(p)) {
      this.preventTouchDefault(p);
      const downCell = this.touchDownCell;
      const handled = this.touchHandled;
      const cancelled = this.touchCancelled;
      const upCell = this.cellFromPointer(p);
      this.clearTouchGesture();

      if (
        !handled &&
        !cancelled &&
        !this.gameOver &&
        !this.spectator &&
        !this.isStunned() &&
        downCell &&
        upCell &&
        downCell.r === upCell.r &&
        downCell.c === upCell.c
      ) {
        const boardCell = this.board[upCell.r]?.[upCell.c];
        if (boardCell?.revealed) this.tryChord(upCell.r, upCell.c);
        else this.tryReveal(upCell.r, upCell.c);
      }
      return;
    }

    const wasLeft = p.leftButtonReleased();
    const wasRight = p.rightButtonReleased();
    if (!this.gameOver && !this.spectator && !this.isStunned() && !this.chordConsumed) {
      const cell = this.cellFromPointer(p);
      if (cell) {
        if (wasLeft && !this.rightDown) this.tryReveal(cell.r, cell.c);
        else if (wasRight && !this.leftDown) this.tryFlag(cell.r, cell.c);
      }
    }
    if (wasLeft) this.leftDown = false;
    if (wasRight) this.rightDown = false;
    if (!this.leftDown && !this.rightDown) this.chordConsumed = false;
  };

  // ms since round start. Casual/daily rounds start on first interaction;
  // match rounds start as soon as the board loads.
  private nowMs(): number {
    return this.startedAt === null ? 0 : Date.now() - this.startedAt;
  }

  private stunRemainingMs(): number {
    if (this.stunnedUntilMs === null) return 0;
    return Math.max(0, this.stunnedUntilMs - this.nowMs());
  }

  private isStunned(): boolean {
    return this.stunRemainingMs() > 0;
  }

  private logAction(kind: ActionLogEntry["kind"], r: number, c: number) {
    this.actions.push({ kind, r, c, atMs: this.nowMs() });
  }

  private tryReveal(r: number, c: number) {
    if (this.gameOver || this.spectator || this.isStunned()) return;
    const cell = this.board[r][c];
    if (cell.flagged || cell.revealed) return;

    if (!this.planted) {
      plant(this.board, this.mines, this.seed, r, c);
      this.planted = true;
      if (this.startedAt === null) this.startedAt = Date.now();
    } else if (this.startedAt === null) {
      // Pre-planted round (daily) — clock starts on first real interaction.
      this.startedAt = Date.now();
    }

    const atMs = this.nowMs();
    this.logAction("reveal", r, c);

    const res = engineReveal(this.board, r, c);
    this.clicks += 1;

    if (res.hitMine) {
      this.handleMistake(res.revealed, { r, c }, atMs);
      return;
    }

    this.opens += res.revealed.length;
    if (res.revealed.length > 4) this.chains += 1;

    // Score the reveal. Flag actions deliberately do not feed the scorer.
    const scored = applyRevealWithFeedback(
      this.scoreState,
      res.revealed.length,
      atMs,
    );
    this.scoreState = scored.state;

    this.emitCellEvents(this.toRevealEvents(res.revealed));

    // animate reveals with stagger by BFS distance
    for (const rev of res.revealed) {
      const stagger = rev.dist * 18;
      this.time.delayedCall(stagger, () => this.applyRevealVisual(rev.r, rev.c));
    }
    bridge.emit("sound:reveal", this.soundPayload(scored.feedback));
    this.applyComboJuice(scored.feedback, res.revealed);

    // particles for first 8 cells
    for (const rev of res.revealed.slice(0, 8)) {
      const stagger = rev.dist * 18;
      this.time.delayedCall(stagger, () => this.spawnParticles(rev.r, rev.c));
    }

    if (isWin(this.board)) {
      this.stunnedUntilMs = null;
      bridge.emit("sound:win");
      this.endRound("won");
      return;
    }

    this.emitStats();
    this.emitProgress(true);
  }

  private tryFlag(r: number, c: number) {
    if (this.gameOver || this.spectator || this.isStunned()) return;
    const cell = this.board[r][c];
    if (cell.revealed) return;
    // Flagging is a valid first interaction on a pre-planted board.
    if (this.planted && this.startedAt === null) this.startedAt = Date.now();
    const now = engineFlag(this.board, r, c);
    this.logAction(now ? "flag" : "unflag", r, c);
    const t = this.tiles[r][c];
    if (now) {
      this.drawFlag(t.flag, this.size);
      t.flag.setVisible(true);
      t.cover.setVisible(false);
      t.isFlagged = true;
      // plant animation
      t.flag.setScale(0.4);
      this.tweens.add({
        targets: t.flag,
        scale: 1,
        ease: "Back.Out",
        duration: 220,
      });
    } else {
      t.flag.setVisible(false);
      t.cover.setVisible(true);
      t.isFlagged = false;
    }
    bridge.emit("sound:flag", { on: now });
    this.emitCellEvents([{ kind: "flag", r, c, on: now }]);
    this.emitStats();
    this.emitProgress(true);
  }

  private tryChord(r: number, c: number) {
    if (this.gameOver || this.spectator || this.isStunned()) return;
    const cell = this.board[r][c];
    if (!cell.revealed || cell.adj === 0) return;
    const res = engineChord(this.board, r, c);
    if (res.revealed.length === 0) return;
    // Chord on a pre-revealed cell is a valid first interaction (daily).
    if (this.planted && this.startedAt === null) this.startedAt = Date.now();
    const atMs = this.nowMs();
    this.logAction("chord", r, c);
    const safeRevealed = res.revealed.filter((x) => !this.board[x.r][x.c].mine);
    this.opens += safeRevealed.length;
    if (safeRevealed.length > 4) this.chains += 1;

    if (res.hitMine) {
      const boom = res.revealed.find((x) => this.board[x.r][x.c].mine);
      this.handleMistake(res.revealed, boom ?? null, atMs);
      return;
    }

    // Score the reveal cascade. Chords explicitly opt into the multiplier
    // chain — they're a single committed click just like a normal reveal.
    const scored = applyRevealWithFeedback(
      this.scoreState,
      safeRevealed.length,
      atMs,
    );
    this.scoreState = scored.state;

    this.emitCellEvents(this.toRevealEvents(res.revealed));

    for (const rev of res.revealed) {
      const stagger = rev.dist * 18;
      this.time.delayedCall(stagger, () => this.applyRevealVisual(rev.r, rev.c));
    }
    bridge.emit("sound:chord");
    bridge.emit("sound:reveal", this.soundPayload(scored.feedback));
    this.applyComboJuice(scored.feedback, res.revealed);

    if (isWin(this.board)) {
      bridge.emit("sound:win");
      this.endRound("won");
      return;
    }
    this.emitStats();
    this.emitProgress(true);
  }

  private handleMistake(
    revealed: { r: number; c: number; dist: number }[],
    boom: { r: number; c: number } | null,
    atMs: number,
  ) {
    this.scoreState = applyMistake(this.scoreState, atMs).state;
    this.lives = Math.max(0, this.lives - 1);
    this.leftDown = false;
    this.rightDown = false;
    this.chordConsumed = false;
    this.clearTouchGesture();

    const events: CellEvent[] = [...this.toRevealEvents(revealed)];
    if (boom) events.push({ kind: "boom", r: boom.r, c: boom.c });
    this.emitCellEvents(events);

    if (this.lives <= 0) {
      const revealedMines = revealAllMines(this.board);
      this.emitCellEvents(
        revealedMines.map(({ r, c }) => ({
          kind: "reveal",
          r,
          c,
          adj: 0,
          mine: true,
        })),
      );
      const hints = deducibleSafe(this.board);
      this.renderAll(hints, boom);
      this.cameras.main.shake(650, 0.012);
      bridge.emit("sound:boom");
      this.endRound("exploded", boom ?? undefined, hints.length);
      return;
    }

    this.stunnedUntilMs = atMs + SCORE_CONSTANTS.MISTAKE_STUN_MS;
    for (const rev of revealed) {
      const stagger = rev.dist * 18;
      this.time.delayedCall(stagger, () => this.applyRevealVisual(rev.r, rev.c));
    }
    this.applyMistakeJuice(boom, this.lives);
    this.playStunOverlay(boom, SCORE_CONSTANTS.MISTAKE_STUN_MS);
    bridge.emit("sound:mistake", {
      lives: this.lives,
      stunMs: SCORE_CONSTANTS.MISTAKE_STUN_MS,
    });

    if (isWin(this.board)) {
      bridge.emit("sound:win");
      this.endRound("won");
      return;
    }

    this.emitStats();
    this.emitProgress(true);
  }

  private applyRevealVisual(r: number, c: number) {
    const cell = this.board[r][c];
    const t = this.tiles[r][c];
    if (!t || t.isRevealed) return;
    t.isRevealed = true;
    const s = this.size;
    this.drawRevealed(t.reveal, s);
    t.reveal.setVisible(true);
    t.cover.setVisible(false);
    if (cell.mine) {
      this.drawBomb(t.bomb, s, true);
      t.bomb.setVisible(true);
    } else if (cell.adj > 0) {
      t.number.setText(String(cell.adj));
      t.number.setColor(NUM_COLORS[cell.adj] ?? "#fff");
      t.number.setVisible(true);
      // On low-end devices, skip the back-out scale tween — instant pop
      // saves a tween per revealed cell during cascades (50+ cells = 50+
      // overlapping tweens). The number still appears immediately.
      if (this.lowEnd) {
        t.number.setScale(1);
      } else {
        t.number.setScale(0.001);
        this.tweens.add({
          targets: t.number,
          scale: 1,
          ease: "Back.Out",
          duration: 320,
        });
      }
    }
    // pop the reveal layer — same cascade-cost story; skip on low-end.
    if (this.lowEnd) {
      t.reveal.setScale(1);
    } else {
      t.reveal.setScale(0.84);
      this.tweens.add({
        targets: t.reveal,
        scale: 1,
        ease: "Back.Out",
        duration: 280,
      });
    }
  }

  private spawnParticles(r: number, c: number) {
    // Particles are 4 add-blend circles per cell with a 700ms tween each —
    // gorgeous on desktop, devastating on mobile during big cascades. Skip.
    if (this.lowEnd) return;
    const t = this.tiles[r][c];
    if (!t) return;
    const cx = t.container.x + this.size / 2;
    const cy = t.container.y + this.size / 2;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.6;
      const dist = 14 + Math.random() * 22;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const size = 3 + Math.random() * 3;
      const p = this.add.circle(cx, cy, size, 0xe3b248, 1);
      p.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: p,
        x: cx + dx,
        y: cy + dy,
        alpha: 0,
        scale: 0,
        duration: 700,
        ease: "Cubic.Out",
        onComplete: () => p.destroy(),
      });
    }
  }

  private soundPayload(feedback: RevealScoreFeedback) {
    return {
      count: feedback.revealedCount,
      streak: feedback.streak,
      accuracyStreak: feedback.accuracyStreak,
      multiplier: feedback.multiplier,
      speedMultiplier: feedback.speedMultiplier,
      accuracyMultiplier: feedback.accuracyMultiplier,
      tier: feedback.tier,
      hesitated: feedback.hesitated && feedback.previousStreak >= 3,
      milestone: feedback.speedMilestoneBonus > 0,
    };
  }

  private applyComboJuice(
    feedback: RevealScoreFeedback,
    revealed: { r: number; c: number; dist: number }[],
  ) {
    if (feedback.tier <= 0 || revealed.length === 0) return;

    const anchor = revealed[Math.min(revealed.length - 1, Math.floor(revealed.length / 2))];
    const shakeDuration = 70 + feedback.tier * 42;
    const shakeIntensity = 0.0015 + feedback.tier * 0.0012;
    this.cameras.main.shake(shakeDuration, shakeIntensity);
    this.spawnComboText(anchor.r, anchor.c, feedback);
    this.spawnComboBurst(anchor.r, anchor.c, feedback.tier);

    if (feedback.tier >= 3) {
      this.time.delayedCall(70, () => {
        this.spawnComboBurst(anchor.r, anchor.c, feedback.tier);
      });
    }
  }

  private spawnComboText(r: number, c: number, feedback: RevealScoreFeedback) {
    const t = this.tiles[r][c];
    if (!t) return;

    const hot = feedback.tier >= 3;
    const x = t.container.x + this.size / 2;
    const y = t.container.y - this.size * 0.35;
    const label =
      feedback.speedMilestoneBonus > 0
        ? `x${feedback.multiplier.toFixed(2)} HOT`
        : `x${feedback.multiplier.toFixed(2)}`;
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Georgia, serif",
        fontSize: `${18 + feedback.tier * 5}px`,
        fontStyle: "bold italic",
        color: hot ? "#ff6a6a" : "#ffd472",
        stroke: "#050607",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(80)
      .setBlendMode(Phaser.BlendModes.ADD);

    text.setScale(0.7);
    this.tweens.add({
      targets: text,
      y: y - 26 - feedback.tier * 5,
      scale: 1.15,
      alpha: { from: 1, to: 0 },
      duration: 680 + feedback.tier * 90,
      ease: "Cubic.Out",
      onComplete: () => text.destroy(),
    });
  }

  private spawnComboBurst(r: number, c: number, tier: RevealScoreFeedback["tier"]) {
    const t = this.tiles[r][c];
    if (!t) return;

    const cx = t.container.x + this.size / 2;
    const cy = t.container.y + this.size / 2;
    const colors = tier >= 3 ? [0xff6a6a, 0xffaa42, 0xffd472] : [0xe3b248, 0x5fdada, 0x4caf6a];
    const count = 8 + tier * 5;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const dist = 20 + tier * 12 + Math.random() * 34;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const size = 2 + Math.random() * (3 + tier);
      const p = this.add.circle(cx, cy, size, colors[i % colors.length], 1);
      p.setDepth(70);
      p.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: p,
        x: cx + dx,
        y: cy + dy,
        alpha: 0,
        scale: 0,
        duration: 520 + tier * 110,
        ease: "Cubic.Out",
        onComplete: () => p.destroy(),
      });
    }
  }

  // Big, theatrical "you are frozen" overlay so the 3s lockout reads as a
  // deliberate consequence rather than a hung frame. Tinted glass, pulsing
  // red frame, radial cracks at the boom cell, countdown that lands like a
  // metronome, then a release shatter.
  private playStunOverlay(
    boom: { r: number; c: number } | null,
    durationMs: number,
  ) {
    this.clearStunFx();

    const pad = 18;
    const w = this.cols * this.size + (this.cols - 1) * this.gap;
    const h = this.rows * this.size + (this.rows - 1) * this.gap;
    const ox = this.originX - pad;
    const oy = this.originY - pad;
    const fw = w + pad * 2;
    const fh = h + pad * 2;
    const cx = ox + fw / 2;
    const cy = oy + fh / 2;

    const objects: Phaser.GameObjects.GameObject[] = [];
    const timers: Phaser.Time.TimerEvent[] = [];
    const tweens: Phaser.Tweens.Tween[] = [];

    // 1. Dim wash — knocks the grid back so the player feels locked out.
    const wash = this.add.rectangle(cx, cy, fw, fh, 0x230808, 0).setDepth(55);
    objects.push(wash);
    tweens.push(
      this.tweens.add({
        targets: wash,
        alpha: 0.55,
        duration: 140,
        ease: "Cubic.Out",
      }),
    );

    // 2. Pulsing red frame around the grid. Matches the existing gold frame
    //    so it reads as "your board is in alarm state".
    const frame = this.add.graphics().setDepth(58);
    const drawFrame = (alpha: number, inset: number) => {
      frame.clear();
      frame.lineStyle(3, 0xff4d4d, alpha);
      frame.strokeRoundedRect(ox + inset, oy + inset, fw - inset * 2, fh - inset * 2, 14);
      frame.lineStyle(1, 0xff8a8a, alpha * 0.6);
      frame.strokeRoundedRect(ox + inset + 4, oy + inset + 4, fw - (inset + 4) * 2, fh - (inset + 4) * 2, 10);
    };
    drawFrame(0.9, 0);
    objects.push(frame);
    const frameState = { a: 0.9, i: 0 };
    tweens.push(
      this.tweens.add({
        targets: frameState,
        a: 0.4,
        i: 3,
        duration: 480,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
        onUpdate: () => drawFrame(frameState.a, frameState.i),
      }),
    );

    // 3. Radial cracks from the boom cell. Hand-drawn lines + chips so it
    //    feels like the board itself fractured.
    if (boom) {
      const t = this.tiles[boom.r]?.[boom.c];
      if (t) {
        const bx = t.container.x + this.size / 2;
        const by = t.container.y + this.size / 2;
        const cracks = this.add.graphics().setDepth(57);
        cracks.lineStyle(2.2, 0xffd0d0, 0.95);
        const arms = 7;
        for (let i = 0; i < arms; i++) {
          const angle = (Math.PI * 2 * i) / arms + Math.random() * 0.5;
          const len = this.size * (2.6 + Math.random() * 1.6);
          let x = bx;
          let y = by;
          let a = angle;
          cracks.beginPath();
          cracks.moveTo(x, y);
          // Polyline with kinks — readable as a crack rather than a beam.
          const segs = 4;
          for (let k = 0; k < segs; k++) {
            const segLen = len / segs;
            a += (Math.random() - 0.5) * 0.7;
            x += Math.cos(a) * segLen;
            y += Math.sin(a) * segLen;
            cracks.lineTo(x, y);
          }
          cracks.strokePath();
        }
        cracks.setAlpha(0);
        objects.push(cracks);
        tweens.push(
          this.tweens.add({
            targets: cracks,
            alpha: 1,
            scale: { from: 0.6, to: 1 },
            duration: 220,
            ease: "Back.Out",
          }),
        );
      }
    }

    // 4. "FROZEN" label + big countdown number.
    const label = this.add
      .text(cx, cy - this.size * 1.4, "FROZEN", {
        fontFamily: "Georgia, serif",
        fontSize: `${Math.round(this.size * 0.95)}px`,
        fontStyle: "bold italic",
        color: "#ffd6d6",
        stroke: "#3a0808",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(70)
      .setBlendMode(Phaser.BlendModes.ADD);
    label.setScale(0.4);
    objects.push(label);
    tweens.push(
      this.tweens.add({
        targets: label,
        scale: 1,
        duration: 240,
        ease: "Back.Out",
      }),
    );
    tweens.push(
      this.tweens.add({
        targets: label,
        alpha: { from: 1, to: 0.7 },
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      }),
    );

    const countdown = this.add
      .text(cx, cy + this.size * 0.5, "", {
        fontFamily: "Georgia, serif",
        fontSize: `${Math.round(this.size * 3.2)}px`,
        fontStyle: "bold",
        color: "#ff6a6a",
        stroke: "#1a0303",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(72)
      .setBlendMode(Phaser.BlendModes.ADD);
    objects.push(countdown);

    const seconds = Math.max(1, Math.round(durationMs / 1000));
    const popNumber = (n: number) => {
      countdown.setText(String(n));
      countdown.setScale(0.001);
      countdown.setAlpha(1);
      tweens.push(
        this.tweens.add({
          targets: countdown,
          scale: 1,
          duration: 220,
          ease: "Back.Out",
        }),
      );
      tweens.push(
        this.tweens.add({
          targets: countdown,
          alpha: 0.55,
          duration: 800,
          ease: "Sine.InOut",
        }),
      );
    };
    popNumber(seconds);
    for (let i = 1; i < seconds; i++) {
      timers.push(
        this.time.delayedCall(i * 1000, () => popNumber(seconds - i)),
      );
    }

    // 5. Continuous sparks around the boom cell — keeps motion alive during
    //    the otherwise-quiet wait window.
    const sparkTimer = boom
      ? this.time.addEvent({
          delay: 130,
          loop: true,
          callback: () => {
            const t = this.tiles[boom.r]?.[boom.c];
            if (!t) return;
            const bx = t.container.x + this.size / 2;
            const by = t.container.y + this.size / 2;
            for (let i = 0; i < 3; i++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = this.size * (0.4 + Math.random() * 1.4);
              const p = this.add
                .circle(bx, by, 2 + Math.random() * 2, 0xffb4b4, 1)
                .setDepth(73)
                .setBlendMode(Phaser.BlendModes.ADD);
              this.tweens.add({
                targets: p,
                x: bx + Math.cos(angle) * dist,
                y: by + Math.sin(angle) * dist,
                alpha: 0,
                scale: 0,
                duration: 520,
                ease: "Cubic.Out",
                onComplete: () => p.destroy(),
              });
            }
          },
        })
      : undefined;

    // 6. Soft repeated micro-shakes so the camera doesn't go totally still.
    const shakeTimer = this.time.addEvent({
      delay: 360,
      loop: true,
      callback: () => this.cameras.main.shake(120, 0.0028),
    });
    timers.push(shakeTimer);

    // 7. Cursor signals "no go".
    this.setDefaultCursor("not-allowed");

    // 8. Auto-release with a final flash + shatter feel.
    timers.push(
      this.time.delayedCall(durationMs, () => this.releaseStunFx(cx, cy, fw, fh)),
    );

    this.stunFx = { objects, timers, tweens, sparkTimer };
  }

  private releaseStunFx(cx: number, cy: number, fw: number, fh: number) {
    if (!this.stunFx) return;
    // Quick white flash that snaps the player back to attention.
    const flash = this.add
      .rectangle(cx, cy, fw, fh, 0xffe4e4, 0.65)
      .setDepth(80)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 220,
      ease: "Cubic.Out",
      onComplete: () => flash.destroy(),
    });
    this.cameras.main.shake(140, 0.004);
    this.clearStunFx();
  }

  private clearStunFx() {
    this.setDefaultCursor("pointer");
    if (!this.stunFx) return;
    for (const tw of this.stunFx.tweens) tw.stop();
    for (const tm of this.stunFx.timers) tm.remove(false);
    this.stunFx.sparkTimer?.remove(false);
    for (const o of this.stunFx.objects) o.destroy();
    this.stunFx = null;
  }

  private setDefaultCursor(cursor: string) {
    try {
      this.input?.setDefaultCursor(cursor);
    } catch {
      // Phaser can null its canvas/input internals during scene teardown while
      // Socket.IO round events are still arriving. Ignore stale scene writes.
    }
  }

  private applyMistakeJuice(boom: { r: number; c: number } | null, lives: number) {
    if (!boom) return;
    const t = this.tiles[boom.r]?.[boom.c];
    if (!t) return;

    const x = t.container.x + this.size / 2;
    const y = t.container.y - this.size * 0.35;
    this.cameras.main.shake(260, 0.0065);

    const text = this.add
      .text(x, y, lives > 0 ? `-1 HP  ${lives} LEFT` : "BUST", {
        fontFamily: "Georgia, serif",
        fontSize: "24px",
        fontStyle: "bold italic",
        color: "#ff6a6a",
        stroke: "#050607",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(90)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: text,
      y: y - 34,
      scale: 1.12,
      alpha: { from: 1, to: 0 },
      duration: 950,
      ease: "Cubic.Out",
      onComplete: () => text.destroy(),
    });

    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.25;
      const dist = 24 + Math.random() * 42;
      const p = this.add.circle(x, y + this.size * 0.35, 3 + Math.random() * 3, 0xff4d4d, 1);
      p.setDepth(75);
      p.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + this.size * 0.35 + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0,
        duration: 620,
        ease: "Cubic.Out",
        onComplete: () => p.destroy(),
      });
    }
  }

  private renderAll(hints: { r: number; c: number }[], boom: { r: number; c: number } | null) {
    const hintSet = new Set(hints.map((h) => h.r * this.cols + h.c));
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        const t = this.tiles[r][c];
        if (cell.revealed && !t.isRevealed) {
          t.isRevealed = true;
          this.drawRevealed(t.reveal, this.size);
          t.reveal.setVisible(true);
          t.cover.setVisible(false);
          if (cell.mine) {
            const isBoom = boom?.r === r && boom?.c === c;
            this.drawBomb(t.bomb, this.size, isBoom);
            t.bomb.setVisible(true);
          } else if (cell.adj > 0) {
            t.number.setText(String(cell.adj));
            t.number.setColor(NUM_COLORS[cell.adj] ?? "#fff");
            t.number.setVisible(true);
          }
        }
        if (hintSet.has(r * this.cols + c)) {
          this.drawHint(t.hint, this.size);
          t.hint.setVisible(true);
          this.tweens.add({
            targets: t.hint,
            alpha: { from: 0.6, to: 1 },
            duration: 700,
            yoyo: true,
            repeat: -1,
          });
        }
      }
    }
  }

  // Walks the planted board to derive correct flags / misflags. Cheap (O(N))
  // and avoids having to mutate counters on every flag toggle.
  private flagAccuracy(): { correctFlags: number; misflags: number } {
    let correct = 0;
    let mis = 0;
    for (const row of this.board) {
      for (const cell of row) {
        if (!cell.flagged) continue;
        if (cell.mine) correct++;
        else mis++;
      }
    }
    return { correctFlags: correct, misflags: mis };
  }

  private currentScore(reason: RoundEndReason, elapsedMs: number): ScoreBreakdown {
    return finalizeScore(
      this.scoreState,
      elapsedMs,
      reason,
      this.countSafeRevealed(),
      this.rows * this.cols - this.mines,
    );
  }

  private endRound(
    reason: RoundEndReason,
    boom?: { r: number; c: number },
    postLossHintCount = 0,
  ) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.won = reason === "won";
    this.endedAt = Date.now();
    // A round can end mid-stun (timeout, forced explode on no-lives). Wipe
    // overlay so the result screen isn't fighting a "FROZEN" banner.
    this.clearStunFx();
    const elapsedMs =
      this.endedAt - (this.startedAt ?? this.endedAt);

    if (this.round.mode === "casual") {
      if (reason === "won") {
        this.streak += 1;
        this.streakBest = Math.max(this.streakBest, this.streak);
      } else {
        this.streak = 0;
      }
    }

    // Flag accuracy is post-round stats only — it does NOT feed into score.
    const { correctFlags, misflags } = this.flagAccuracy();
    const score = this.currentScore(reason, elapsedMs);
    const flagged = countFlags(this.board);

    const result: RoundResult = {
      config: this.round,
      reason,
      elapsedMs,
      opens: this.opens,
      clicks: this.clicks,
      chains: this.chains,
      flagged,
      correctFlags,
      misflags,
      postLossHintCount,
      boomCell: boom,
      score,
      actions: this.actions.slice(),
    };

    // Snapshot our final board state for the side mini-board in spectator
    // mode. Cheap to compute; only the React side decides whether to render.
    bridge.emit("board:snapshot", this.snapshotBoard(boom ?? null));

    bridge.emit("round:end", result);
    bridge.emit("score:update", score);

    // Solo flows (casual + daily) share this overlay/recorder path. Match
    // mode uses round:end → MatchHUD instead.
    if (this.round.mode === "casual" || this.round.mode === "daily") {
      if (this.round.mode === "casual") {
        bridge.emit("progress:clear", {
          difficulty: this.round.difficulty ?? "intermediate",
        });
      }
      bridge.emit("game:over", {
        won: this.won,
        elapsedMs,
        opens: this.opens,
        clicks: this.clicks,
        flagged,
        postLossHintCount,
        boomCell: boom,
      });
    }

    this.emitStats();
  }

  // Called by the 4Hz timer. Two jobs: refresh HUD stats, enforce round
  // deadline if one is set.
  private tick() {
    if (
      !this.gameOver &&
      this.round.timeLimitMs !== null &&
      this.startedAt !== null
    ) {
      const elapsed = Date.now() - this.startedAt;
      if (elapsed >= this.round.timeLimitMs) {
        this.endRound("timeout");
        return;
      }
    }
    this.emitStats();
    this.emitProgress(false);
  }

  private emitStats() {
    const elapsedMs =
      this.startedAt === null
        ? 0
        : this.gameOver && this.endedAt
        ? this.endedAt - this.startedAt
        : Date.now() - this.startedAt;
    const flagged = countFlags(this.board);
    const timeLeftMs =
      this.round.timeLimitMs === null
        ? null
        : Math.max(0, this.round.timeLimitMs - elapsedMs);

    // Live score: same formula as final, but a non-win reason zeroes out
    // the speed bonus so the in-progress preview doesn't lie.
    const liveScore = this.gameOver
      ? this.currentScore(this.won ? "won" : "exploded", elapsedMs)
      : this.currentScore("exploded", elapsedMs);

    // Hesitation preview: if the player has been idle long enough that a
    // reveal right now would reset speed, show that loss in the HUD
    // immediately. Accuracy persists until an actual mistake.
    const sinceLastReveal =
      this.scoreState.lastRevealAt < 0
        ? 0
        : this.nowMs() - this.scoreState.lastRevealAt;
    const hesitating =
      !this.gameOver &&
      this.scoreState.lastRevealAt >= 0 &&
      sinceLastReveal >= SCORE_CONSTANTS.HESITATION_MS;
    const liveStreak = hesitating ? 0 : this.scoreState.streak;
    const liveSpeedMultiplier = hesitating ? 1.0 : this.scoreState.speedMultiplier;
    const liveAccuracyMultiplier = this.scoreState.accuracyMultiplier;
    const liveMultiplier = liveSpeedMultiplier * liveAccuracyMultiplier;
    const stunRemainingMs = this.stunRemainingMs();

    const stats: GameStats = {
      elapsedMs,
      opens: this.opens,
      clicks: this.clicks,
      chains: this.chains,
      flagged,
      remaining: Math.max(0, this.mines - flagged),
      streak: this.streak,
      streakBest: this.streakBest,
      difficulty: this.round.difficulty ?? "intermediate",
      seed: this.seed,
      score: liveScore,
      liveStreak,
      liveMultiplier,
      liveSpeedMultiplier,
      liveAccuracyMultiplier,
      accuracyStreak: this.scoreState.accuracyStreak,
      lives: this.lives,
      maxLives: this.round.maxLives ?? SCORE_CONSTANTS.MAX_LIVES,
      stunRemainingMs,
      timeLeftMs,
      cellsRevealed: this.countSafeRevealed(),
    };
    bridge.emit("stats:update", stats);
    bridge.emit("score:update", liveScore);
  }

  // ----------------------------- cell event I/O ----------------------------

  private toRevealEvents(
    revealed: { r: number; c: number; dist: number }[],
  ): CellEvent[] {
    const out: CellEvent[] = [];
    for (const { r, c } of revealed) {
      const cell = this.board[r][c];
      if (cell.mine) {
        out.push({ kind: "reveal", r, c, adj: 0, mine: true });
      } else {
        out.push({ kind: "reveal", r, c, adj: cell.adj });
      }
    }
    return out;
  }

  private emitCellEvents(events: CellEvent[]): void {
    if (!events.length) return;
    if (this.spectator) return; // shouldn't happen, but never echo back
    bridge.emit("cells:events", events);
  }

  private countSafeRevealed(): number {
    let n = 0;
    for (const row of this.board) {
      for (const cell of row) {
        if (cell.revealed && !cell.mine) n++;
      }
    }
    return n;
  }

  private snapshotBoard(boom: { r: number; c: number } | null): BoardSnapshot {
    const cells = new Int8Array(this.rows * this.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        const idx = r * this.cols + c;
        if (cell.flagged && !cell.revealed) cells[idx] = -2;
        else if (cell.revealed && cell.mine) cells[idx] = -3;
        else if (cell.revealed) cells[idx] = cell.adj;
        else cells[idx] = -1;
      }
    }
    return { rows: this.rows, cols: this.cols, cells, boom };
  }

  private restoreProgress(progress: SoloProgressSnapshot): void {
    if (
      progress.board.rows !== this.rows ||
      progress.board.cols !== this.cols ||
      progress.board.cells.length !== this.rows * this.cols
    ) {
      return;
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const saved = progress.board.cells[r * this.cols + c];
        this.board[r][c] = {
          r,
          c,
          mine: saved.m,
          adj: saved.a,
          revealed: saved.r,
          flagged: saved.f,
        };
      }
    }

    this.planted = progress.planted;
    this.startedAt =
      progress.elapsedMs === null ? null : Date.now() - progress.elapsedMs;
    this.endedAt = progress.gameOver ? Date.now() : null;
    this.gameOver = progress.gameOver;
    this.won = progress.won;
    this.opens = progress.opens;
    this.clicks = progress.clicks;
    this.chains = progress.chains;
    this.lives = progress.lives;
    this.stunnedUntilMs = progress.stunnedUntilMs;
    this.streak = progress.streak;
    this.streakBest = progress.streakBest;
    this.actions = progress.actions.slice();
    this.scoreState = { ...newScoreState(), ...progress.scoreState };

    this.renderRestoredBoard();
  }

  private renderRestoredBoard(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        const t = this.tiles[r]?.[c];
        if (!t) continue;

        t.isRevealed = false;
        t.isFlagged = false;
        t.reveal.setVisible(false);
        t.number.setVisible(false);
        t.bomb.setVisible(false);
        t.flag.setVisible(false);
        t.hint.setVisible(false);
        t.cover.setVisible(true);
        this.drawCover(t.cover, this.size, false);

        if (cell.revealed) {
          t.isRevealed = true;
          this.drawRevealed(t.reveal, this.size);
          t.reveal.setVisible(true);
          t.cover.setVisible(false);
          if (cell.mine) {
            this.drawBomb(t.bomb, this.size, false);
            t.bomb.setVisible(true);
          } else if (cell.adj > 0) {
            t.number.setText(String(cell.adj));
            t.number.setColor(NUM_COLORS[cell.adj] ?? "#fff");
            t.number.setVisible(true);
          }
        } else if (cell.flagged) {
          t.isFlagged = true;
          this.drawFlag(t.flag, this.size);
          t.flag.setVisible(true);
          t.cover.setVisible(false);
        }
      }
    }
  }

  private buildProgressSnapshot(): SoloProgressSnapshot | null {
    if (this.round.mode !== "casual") return null;
    const difficulty = this.round.difficulty;
    if (!difficulty) return null;

    const elapsedMs =
      this.startedAt === null
        ? null
        : this.gameOver && this.endedAt
        ? this.endedAt - this.startedAt
        : Date.now() - this.startedAt;

    return {
      version: SOLO_PROGRESS_VERSION,
      difficulty,
      round: this.round,
      board: {
        rows: this.rows,
        cols: this.cols,
        cells: this.board.flatMap((row) =>
          row.map((cell) => ({
            m: cell.mine,
            a: cell.adj,
            r: cell.revealed,
            f: cell.flagged,
          })),
        ),
      },
      planted: this.planted,
      elapsedMs,
      gameOver: this.gameOver,
      won: this.won,
      opens: this.opens,
      clicks: this.clicks,
      chains: this.chains,
      lives: this.lives,
      stunnedUntilMs: this.stunnedUntilMs,
      streak: this.streak,
      streakBest: this.streakBest,
      actions: this.actions.slice(),
      scoreState: { ...this.scoreState },
      updatedAt: new Date().toISOString(),
    };
  }

  private emitProgress(force = false): void {
    if (this.round.mode !== "casual") return;
    if (this.spectator || this.gameOver) return;
    const now = Date.now();
    if (!force && now - this.lastProgressEmitAt < 5000) return;
    const snapshot = this.buildProgressSnapshot();
    if (!snapshot) return;
    this.lastProgressEmitAt = now;
    bridge.emit("progress:snapshot", snapshot);
  }

  // -------------------------- spectator rendering --------------------------

  private enterSpectator = (payload: { opponentName: string }) => {
    this.spectator = true;
    this.spectatorName = payload.opponentName;
    // Disengage local engine so further input or timer ticks don't try to
    // mutate state we no longer own.
    this.gameOver = true;
    // Wipe the existing visuals back to a fully covered board so the
    // opponent's reveals can play in from a clean slate. We don't reset the
    // engine board — mines are in the same positions thanks to the shared
    // seed, but we deliberately re-cover everything so we can't peek by
    // diffing it.
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.tiles[r][c];
        if (!t) continue;
        t.isRevealed = false;
        t.isFlagged = false;
        t.reveal.setVisible(false);
        t.number.setVisible(false);
        t.bomb.setVisible(false);
        t.flag.setVisible(false);
        t.hint.setVisible(false);
        t.cover.setVisible(true);
        this.drawCover(t.cover, this.size, false);
      }
    }
    // Soft visual cue that this is a ghost view: mute the frame tint.
    this.gridContainer.setAlpha(0.92);
  };

  private applyRemoteEvents = (events: CellEvent[]) => {
    if (!this.spectator) return;
    for (const ev of events) {
      if (ev.kind === "reveal") {
        this.spectatorRenderReveal(ev.r, ev.c, ev.adj, ev.mine ?? false);
      } else if (ev.kind === "flag") {
        this.spectatorRenderFlag(ev.r, ev.c, ev.on);
      } else if (ev.kind === "boom") {
        this.spectatorRenderBoom(ev.r, ev.c);
      }
    }
  };

  private spectatorRenderReveal(
    r: number,
    c: number,
    adj: number,
    mine: boolean,
  ) {
    const t = this.tiles[r]?.[c];
    if (!t || t.isRevealed) return;
    t.isRevealed = true;
    t.isFlagged = false;
    const s = this.size;
    this.drawRevealed(t.reveal, s);
    t.reveal.setVisible(true);
    t.cover.setVisible(false);
    t.flag.setVisible(false);
    if (mine) {
      this.drawBomb(t.bomb, s, false);
      t.bomb.setVisible(true);
    } else if (adj > 0) {
      t.number.setText(String(adj));
      t.number.setColor(NUM_COLORS[adj] ?? "#fff");
      t.number.setVisible(true);
      t.number.setScale(0.001);
      this.tweens.add({
        targets: t.number,
        scale: 1,
        ease: "Back.Out",
        duration: 240,
      });
    }
    t.reveal.setScale(0.84);
    this.tweens.add({
      targets: t.reveal,
      scale: 1,
      ease: "Back.Out",
      duration: 220,
    });
  }

  private spectatorRenderFlag(r: number, c: number, on: boolean) {
    const t = this.tiles[r]?.[c];
    if (!t || t.isRevealed) return;
    if (on) {
      this.drawFlag(t.flag, this.size);
      t.flag.setVisible(true);
      t.cover.setVisible(false);
      t.isFlagged = true;
      t.flag.setScale(0.4);
      this.tweens.add({
        targets: t.flag,
        scale: 1,
        ease: "Back.Out",
        duration: 200,
      });
    } else {
      t.flag.setVisible(false);
      t.cover.setVisible(true);
      t.isFlagged = false;
    }
  }

  private spectatorRenderBoom(r: number, c: number) {
    const t = this.tiles[r]?.[c];
    if (!t) return;
    const s = this.size;
    this.drawRevealed(t.reveal, s);
    t.reveal.setVisible(true);
    t.cover.setVisible(false);
    t.flag.setVisible(false);
    this.drawBomb(t.bomb, s, true);
    t.bomb.setVisible(true);
    t.isRevealed = true;
    this.cameras.main.shake(450, 0.008);
  }
}
