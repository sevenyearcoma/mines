import Phaser from "phaser";
import {
  applyReveal,
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
  type ScoreBreakdown,
  type ScoreState,
} from "@/lib/engine";
import type { CellEvent } from "@/lib/multiplayer/protocol";
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
  private statsTimer?: Phaser.Time.TimerEvent;
  private originX = 0;
  private originY = 0;
  private readonly gap = 2;
  // Spectator state: when on, all input is disabled and the local engine is
  // frozen. Remote events drive the visuals only.
  private spectator = false;
  private spectatorName = "";

  constructor() {
    super({ key: "BoardScene" });
  }

  init(data: { round?: RoundConfig; difficulty?: Difficulty }) {
    if (data?.round) {
      this.round = data.round;
    } else if (data?.difficulty) {
      this.round = roundConfigFromDifficulty(data.difficulty);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor("#0e1318");

    this.gridContainer = this.add.container(0, 0);
    this.frame = this.add.graphics();
    this.gridContainer.add(this.frame);

    // SoundDirector lives here so it survives for the entire game session.
    // BootScene shuts down after handing off to PreloadScene, so it cannot host it.
    this.soundDirector = new SoundDirector(this);

    this.input.mouse?.disableContextMenu();
    this.input.setDefaultCursor("pointer");

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
      bridge.off("cmd:reset", this.resetBoard);
      bridge.off("cmd:setDifficulty", this.changeDifficulty);
      bridge.off("cmd:loadRound", this.loadRound);
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
    this.rows = this.round.rows;
    this.cols = this.round.cols;
    this.mines = this.round.mines;
    this.seed = this.round.seed;
    this.size = cellSizeFor(this.cols);
    this.board = emptyBoard(this.rows, this.cols);
    this.planted = false;
    this.startedAt = null;
    this.endedAt = null;
    this.gameOver = false;
    this.won = false;
    this.opens = 0;
    this.clicks = 0;
    this.chains = 0;
    this.actions = [];
    this.scoreState = newScoreState();
    this.leftDown = false;
    this.rightDown = false;
    this.chordConsumed = false;
    this.hoverCell = null;
    this.spectator = false;
    this.spectatorName = "";

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
      });
    }
    this.emitStats();
  }

  private resetBoard = () => {
    // Match-mode rounds aren't player-resettable — only the match controller
    // decides when the next round loads.
    if (this.round.mode === "match") return;
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
    if (this.round.mode === "match") return;
    if (d === this.round.difficulty) return;
    this.round = roundConfigFromDifficulty(d, undefined, "casual");
    this.streak = 0;
    this.streakBest = Math.max(this.streakBest, this.streak);
    this.setupBoard();
    this.layout();
    this.emitStats();
  };

  private loadRound = (config: RoundConfig) => {
    this.round = config;
    // Streak is a casual concept; match rounds are sovereign.
    this.streak = 0;
    this.streakBest = 0;
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

  private layout() {
    const s = this.size;
    const pad = 18;
    const w = this.cols * s + (this.cols - 1) * 2;
    const h = this.rows * s + (this.rows - 1) * 2;

    const frameW = w + pad * 2;
    const frameH = h + pad * 2;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const ox = cx - frameW / 2;
    const oy = cy - frameH / 2;

    this.frame.clear();
    // outer frame: panel + gold border
    this.frame.fillStyle(0x0f1418);
    this.frame.fillRoundedRect(ox, oy, frameW, frameH, 14);
    this.frame.lineStyle(2, 0xb48127);
    this.frame.strokeRoundedRect(ox, oy, frameW, frameH, 14);
    this.frame.lineStyle(1, 0xe3b248, 0.3);
    this.frame.strokeRoundedRect(ox + 6, oy + 6, frameW - 12, frameH - 12, 9);

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

  private handlePointerMove = (p: Phaser.Input.Pointer) => {
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
    if (cell && !this.gameOver) {
      const t = this.tiles[cell.r][cell.c];
      if (t && !t.isRevealed && !t.isFlagged) {
        this.drawCover(t.cover, this.size, true);
      }
    }
  };

  private handlePointerDown = (p: Phaser.Input.Pointer) => {
    if (this.gameOver || this.spectator) return;
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
    const wasLeft = p.leftButtonReleased();
    const wasRight = p.rightButtonReleased();
    if (!this.gameOver && !this.spectator && !this.chordConsumed) {
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

  // ms since round start. Returns 0 before the first reveal.
  private nowMs(): number {
    return this.startedAt === null ? 0 : Date.now() - this.startedAt;
  }

  private logAction(kind: ActionLogEntry["kind"], r: number, c: number) {
    this.actions.push({ kind, r, c, atMs: this.nowMs() });
  }

  private tryReveal(r: number, c: number) {
    if (this.gameOver || this.spectator) return;
    const cell = this.board[r][c];
    if (cell.flagged || cell.revealed) return;

    if (!this.planted) {
      plant(this.board, this.mines, this.seed, r, c);
      this.planted = true;
      this.startedAt = Date.now();
    }

    const atMs = this.nowMs();
    this.logAction("reveal", r, c);

    const res = engineReveal(this.board, r, c);
    this.clicks += 1;
    this.opens += res.revealed.length;
    if (res.revealed.length > 4) this.chains += 1;

    if (res.hitMine) {
      revealAllMines(this.board);
      const hints = deducibleSafe(this.board);
      this.renderAll(hints, { r, c });
      this.cameras.main.shake(650, 0.012);
      bridge.emit("sound:boom");
      this.emitCellEvents([{ kind: "boom", r, c }]);
      this.endRound("exploded", { r, c }, hints.length);
      return;
    }

    // Score the reveal. Flag actions deliberately do not feed the scorer.
    this.scoreState = applyReveal(this.scoreState, res.revealed.length, atMs);

    this.emitCellEvents(this.toRevealEvents(res.revealed));

    // animate reveals with stagger by BFS distance
    for (const rev of res.revealed) {
      const stagger = rev.dist * 18;
      this.time.delayedCall(stagger, () => this.applyRevealVisual(rev.r, rev.c));
    }
    bridge.emit("sound:reveal", { count: res.revealed.length });

    // particles for first 8 cells
    for (const rev of res.revealed.slice(0, 8)) {
      const stagger = rev.dist * 18;
      this.time.delayedCall(stagger, () => this.spawnParticles(rev.r, rev.c));
    }

    if (isWin(this.board)) {
      bridge.emit("sound:win");
      this.endRound("won");
      return;
    }

    this.emitStats();
  }

  private tryFlag(r: number, c: number) {
    if (this.gameOver || this.spectator) return;
    const cell = this.board[r][c];
    if (cell.revealed) return;
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
  }

  private tryChord(r: number, c: number) {
    if (this.gameOver || this.spectator) return;
    const cell = this.board[r][c];
    if (!cell.revealed || cell.adj === 0) return;
    const res = engineChord(this.board, r, c);
    if (res.revealed.length === 0) return;
    const atMs = this.nowMs();
    this.logAction("chord", r, c);
    this.opens += res.revealed.length;
    if (res.revealed.length > 4) this.chains += 1;

    if (res.hitMine) {
      revealAllMines(this.board);
      const hints = deducibleSafe(this.board);
      const boom = res.revealed.find((x) => this.board[x.r][x.c].mine);
      this.renderAll(hints, boom ?? null);
      this.cameras.main.shake(650, 0.012);
      bridge.emit("sound:boom");
      if (boom) this.emitCellEvents([{ kind: "boom", r: boom.r, c: boom.c }]);
      this.endRound("exploded", boom ?? undefined, hints.length);
      return;
    }

    // Score the reveal cascade. Chords explicitly opt into the multiplier
    // chain — they're a single committed click just like a normal reveal.
    this.scoreState = applyReveal(this.scoreState, res.revealed.length, atMs);

    this.emitCellEvents(this.toRevealEvents(res.revealed));

    for (const rev of res.revealed) {
      const stagger = rev.dist * 18;
      this.time.delayedCall(stagger, () => this.applyRevealVisual(rev.r, rev.c));
    }
    bridge.emit("sound:chord");

    if (isWin(this.board)) {
      bridge.emit("sound:win");
      this.endRound("won");
      return;
    }
    this.emitStats();
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
      t.number.setScale(0.001);
      this.tweens.add({
        targets: t.number,
        scale: 1,
        ease: "Back.Out",
        duration: 320,
      });
    }
    // pop the reveal layer
    t.reveal.setScale(0.84);
    this.tweens.add({
      targets: t.reveal,
      scale: 1,
      ease: "Back.Out",
      duration: 280,
    });
  }

  private spawnParticles(r: number, c: number) {
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
    return finalizeScore(this.scoreState, elapsedMs, reason);
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
    const score = finalizeScore(this.scoreState, elapsedMs, reason);
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

    // Legacy event so the existing casual HUD / GameRecorder keep working.
    if (this.round.mode === "casual") {
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
    // reveal right now would reset their multiplier, show that loss in the
    // HUD immediately instead of waiting for the next click.
    const sinceLastReveal =
      this.scoreState.lastRevealAt < 0
        ? 0
        : this.nowMs() - this.scoreState.lastRevealAt;
    const hesitating =
      !this.gameOver &&
      this.scoreState.lastRevealAt >= 0 &&
      sinceLastReveal >= SCORE_CONSTANTS.HESITATION_MS;
    const liveStreak = hesitating ? 0 : this.scoreState.streak;
    const liveMultiplier = hesitating ? 1.0 : this.scoreState.multiplier;

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
