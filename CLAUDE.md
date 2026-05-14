# project: mines

## vision
A high-fidelity, addictive Minesweeper experience that bridges the gap between classic logic puzzles and modern kinetic gameplay. The goal is to move away from the "grey-box" utility of traditional Minesweeper and toward a sensory-heavy, high-stakes atmosphere.

## core pillars
* **Kinetic Feedback (The Balatro Effect):** Every click should have weight. Use screen shakes, particle bursts, and CRT-style shaders to make the board feel alive.
* **High-Stakes Atmosphere (Casino Logic):** Sound design and UI should mimic the tension of a casino floor—satisfying mechanical clicks, celebratory chimes, and a sense of risk/reward.
* **Competitive Infrastructure (Chess.com Model):** Robust multiplayer integration, Elo-based matchmaking, and a clean, social-first lobby system.

## tech stack
* **Frontend:** React + Next.js (App Router) for the meta-game, menus, and SEO.
* **Game Engine:** Phaser.io for the core gameplay grid, rendering thousands of tiles efficiently, and handling complex animations.
* **Real-time & Backend:** * **Supabase:** Auth, persistent storage (stats, history), and database-level multiplayer state.
    * **Socket.io:** Low-latency bidirectional communication for active multiplayer matches.
* **Motion & Juice:** * **Framer Motion:** For seamless UI transitions, modal overlays, and menu "pop."
    * **Phaser Tweens:** For in-game object physics and tile animations.
* **Sound:** Web Audio API (via Phaser) with custom-engineered presets for "tactile" audio feedback.

## design direction
* **Aesthetic:** Architectural and confident. Layered with "juice", Balatro-inspired (particles, lighting, and movement). 
* **Palette:** Balatro-inspired color palette with high-contrast accent colors for mines and flags.
* **Typography:** Balatro-inspired typography with a focus on readability and hierarchy.

## implementation roadmap
1.  **Engine Core:** Build the basic Minesweeper logic (grid generation, flood fill) in Phaser.
2.  **Visual Layer:** Implement the "Balatro" style juice—shaders, tile-flip animations, and hover effects.
3.  **Meta-Game:** Set up Next.js pages for the dashboard and Supabase for user authentication.
4.  **Multiplayer:** Integrate Socket.io for head-to-head "Race" mode or "Shared Board" survival.
5.  **Sound Design:** Layer mechanical "clack" sounds for tile uncovering and rising tension synths for uncleared areas.

## current phase

# Competitive Minesweeper — PvP Beta Ruleset

## Core Philosophy

This game is designed around:
- speed
- consistency
- mechanical skill
- pressure handling
- flow state gameplay

The goal is NOT to remove RNG entirely.

The goal is:
> stronger players should win significantly more often over a BO5 set.

The game should feel:
- fast
- tense
- rewarding
- mechanically expressive

while still remaining recognizable as Minesweeper.

---

# Match Structure

## Format

- Match Type: BO5
- First player to 3 round wins

This helps reduce RNG impact while preserving excitement and comeback potential.

---

# Server Architecture Rules

## Server Authoritative Gameplay

The server owns ALL gameplay state.

The client must NEVER:
- generate mines
- know hidden mine positions
- validate reveals
- calculate score
- calculate combo
- determine legality

The client is only responsible for:
- rendering
- input collection
- animations
- interpolation

---

## Shared Seed System

Both players receive:
- identical board seed
- identical mine layout
- identical opening state

This ensures:
- fairness
- competitive integrity
- skill-based outcomes

---

# Round Structure

## Recommended Beta Settings

| Setting | Value |
|---|---|
| Board Size | 16x16 |
| Mines | 40 |
| Round Timer | 2 minutes |
| Opening | Guaranteed safe |
| Match Format | BO5 |

---

# Victory Condition

Winning the round is based on SCORE, not purely completion speed.

This allows:
- multiple playstyles
- strategic decision making
- comeback opportunities

---

# Round End Conditions

A round ends when:
- timer expires
- board is fully cleared

The player with the higher score wins the round.

---

# Scoring System

## Final Formula

```text
FINAL_SCORE =
(BASE_POINTS
 + COMBO_POINTS
 + SPEED_POINTS
 + ACCURACY_BONUS)
