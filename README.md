# MINES

> Minesweeper, but every click feels expensive.

Forty-year-old game. New table. Same rules, raised stakes.

We took the most overlooked grid in computing history and rebuilt it as a
competitive arena — shared seeds, real-time PvP, score multipliers that reward
nerve over patience, an AI coach that reads your mistakes back to you, and a
casino-floor presentation that respects the fact you're about to risk a streak
on a single click. The game wasn't broken. The packaging was.

This is the showcase: a deployable, full-stack build that proves Minesweeper
still has teeth when you stop treating it like a Windows accessory.

## Live demo

Review the deployed build here:

**https://mines.halfyy.tech**

That is the canonical production domain for this project. Use it for reviewer
links, Supabase auth redirect URLs, and GitHub OAuth callback testing.

---

## The bet

Minesweeper has been dormant for two decades not because it's a bad game — it's
because nobody gave it stakes. Solitaire has Microsoft Hearts tournaments.
Sudoku has The New York Times. Tetris has the entire competitive speedrunning
ecosystem. Minesweeper got bundled with Win95 and forgotten.

**We're making Minesweeper viable in 2026.** Not by changing the rules —
changing the *frame*. A 30-second solo sprint is a warm-up. A 16×16 shared-seed
duel against another human is a story. A daily one-life board everyone in the
world is playing right now is a ritual. A demo replay where an AI walks you
through the pattern you missed is a coaching session.

Same game your dad played at his office desk. Different reason to keep playing.

---

## What's in the box

### Three modes, one identity

- **Solo sprint** — Casual intermediate board, multi-life mode, instant
  restart. The on-ramp. New visitors hit "Start playing →" on the home page and
  are in a board within one click, no signup required.
- **Daily challenge** — One seed, one life, every player on the planet, one UTC
  day. Pure-hardcore framing. Locked after completion until tomorrow rolls
  over. Backed by a global leaderboard with regional filtering.
- **Ranked 1v1** — Best-of-five. Same seed for both players. Real-time
  spectator view of your opponent's board once you're dead. Score-driven
  rounds: speed, accuracy, and combo decide who closes the match. Invite-link
  duels, friend challenges, and a quick-match queue all share the same socket
  pipe.

### Engineering — Phaser × React

The board itself is a **Phaser 4** scene. Tiles are real game objects with
tweens, particles, and a stun-overlay system for the mistake-penalty window.
The HUD, overlays, modals, and matchmaking UI are all **React 19 / Next.js 16
App Router**. The two halves talk through a single typed event bus (`mitt`)
that lives at `web/game/bridge.ts` — every domain event flows through it, so
the game engine never reaches into React and React never reaches into Phaser.
That seam is what made everything else possible: replays, scoring, sound
design, and the AI coach all subscribe to the same stream.

The Phaser canvas is transparent. The casino dealer (MINOS) sits behind the
board at 50% opacity and reacts to gameplay events — leans in on every combo
click, holds his head for the entire 3-second stun window after you hit a
mine, pops a foiled "COMBO · 6 chain" caption as your multiplier climbs. The
hype is not decoration; it's a continuous read on how you're doing.

### Scoring that rewards intent

Every reveal is scored: a base value for the cells you uncovered, a combo
multiplier that compounds while you keep moving without hesitating, a speed
bonus for cascade-cleared regions, and an accuracy multiplier that climbs as
you stack consecutive non-guess moves. Mistakes don't just lose a life — they
break the combo, break the speed bonus, and freeze your input for three
seconds while a stun overlay plays out. The HUD readouts are seven-segment
casino displays with tabular numerics and glow tints so you can read your
state at a glance mid-cascade.

The full breakdown — base / combo / speed / control / penalty / peak
multipliers — is surfaced at round end in PvP and in the deep-cuts analytics
on every player's profile.

### Auth flow that respects first-timers

- **One-click play.** Anonymous visitors hit "Start playing →" on the home
  page and land in a solo board. Zero signup friction.
- **Auto-guest.** Visiting `/match` with no account auto-creates a guest
  identity (random adjective-noun-tag name) so multiplayer is one click from a
  cold cache.
- **Real accounts when ready.** Supabase auth with GitHub OAuth and
  magic-link email. Signing in promotes the guest's session, and from that
  point everything persists.

### Pro tier — gated showcase features

A toggle in the site header flips a `localStorage`-backed Pro mode that
gates the showpiece systems:

- **AI Coach** — Live pattern detection during demo playback. Identifies
  1-2-1, 1-2-2-1, 1-1-along-wall and a half-dozen other named tactics, marks
  anchor cells with gold halos, marks conclusion cells green (safe) or red
  (mine), and surfaces a tip strip explaining why. Works in solo demos *and*
  side-by-side in 1v1 match replays — analyze both players' decision trees on
  the same scrubber.
- **Pattern-stepping** — Step-by-pattern mode in the demo player jumps to the
  next teachable moment instead of the next click. Turns a 90-second replay
  into a 4-step tactical lesson.
- **Demo replays** — Every solo run and every PvP match round is recorded
  with full action logs. Scrub, step, slow-mo. Match demos show both
  players' boards in parallel.
- **Deep cuts** — Insights pulled from your action logs: win-rate by
  difficulty, decision-speed bars, time-of-day patterns, boom-cell heatmap,
  ranked tells. Built from the same telemetry the AI coach uses.

Flip the slider off and every gated feature gracefully degrades with a "Pro
required" prompt — no orphan UI, no broken states.

### Multiplayer that doesn't pretend it's invincible

The Socket.io server is a custom matchmaker on the side of the web app. It
handles authentication (re-using Supabase JWTs *and* a guest path),
queue/invite-link/friend-challenge flows, score-tick broadcasting, spectator
mode after death, between-rounds pacing, and a 15-second grace window so a
brief disconnect mid-search or mid-match doesn't drop you out.

When the server is unreachable, the lobby doesn't dead-end on a red error.
A status card explains what happened and offers a Retry button plus
in-lobby links to solo and daily — the modes that don't need the server.
Buttons that *require* the server disable themselves with a tooltip until
the connection is back.

### Sound + presentation

- **Hybrid sound design.** Synth-generated reveal blips for latency-free
  per-click feedback layered with sample files for the weight moments —
  chip clatter on multi-cell cascades, "ching" on combo milestones, sub-bass
  thump on mine explosions, fanfare bell on wins.
- **MINOS the dealer.** A 992×992 mascot anchored to the bottom-left, half-
  transparent, behind the content layer. Driven by a single React context —
  pages call `useMascotPose("approve", "clean break — rack 'em again")` and
  the rail morphs. Combos brighten and scale him in tiny increments per
  click; mistakes flip him to the wince pose for the same 3 seconds the
  player is stunned. He is the game's emotional state, externalized.
- **Subtle texture pass.** Two-layer shadows, dialed-back grain, glints that
  only fire on hover/intent. Casino feel preserved, eye strain eliminated.

---

## Stack

| Layer            | Choice                      | Why                                                                  |
|------------------|----------------------------|----------------------------------------------------------------------|
| App framework    | Next.js 16 (App Router)     | RSC for fast initial loads, client islands where they're needed.    |
| UI               | React 19, TypeScript        | Server components for data, client components for the action.       |
| Game engine      | Phaser 4                    | Canvas-backed, transparent, plays nice with React via the bridge.   |
| Auth + DB        | Supabase                    | RLS for free, JWTs reusable in the socket server, magic-link UX.    |
| Real-time        | Socket.io 4                 | Battle-tested, namespace-free, reconnection semantics we trust.     |
| Analytics        | PostHog                     | Self-hostable, product analytics that doesn't surveil players.       |
| Hosting (web)    | Vercel                      | Best-in-class for Next.js. Zero config.                              |
| Hosting (socket) | Railway                     | Long-lived processes. Vercel functions can't hold WebSockets.       |

Everything is TypeScript end-to-end. Shared engine + protocol types live in
`web/lib/` and are imported directly by the server build (the repo-root
Dockerfile pulls both into the image).

---

## Local development

Prerequisites:

- Node.js 22+
- A Supabase project with the SQL in `supabase/migrations/` applied
- Supabase project URL + anon key from Project Settings -> API

For a new Supabase project, open the Supabase SQL Editor and run the migration
files in `supabase/migrations/` in filename order (`0001_...` through
`0008_...`). They create the tables, triggers, foreign keys, and RLS policies
used by auth, leaderboards, daily completions, demos, and friends.

```bash
# one-time
npm run install:all   # installs root, web, and server deps

# every day
npm run dev           # starts web (3000) + server (3001) together
```

The combined dev script lives in the repo-root `package.json` and uses
`concurrently` to launch both. Color-prefixed output: `WEB` (yellow), `SRV`
(magenta). Stop with Ctrl-C and both processes exit cleanly.

### Environment files

- `web/.env.local` — copy from `web/.env.example`
- `server/.env`    — copy from `server/.env.example`

Minimum local values:

```bash
# web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_POSTHOG_ENABLED=false

# server/.env
SOCKET_PORT=3001
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
CORS_ORIGIN=http://localhost:3000
```

No Supabase service-role key or JWT secret is required. The socket server
validates real users through Supabase Auth and also supports guest multiplayer.

### Type-checking everything

```bash
npm run typecheck   # runs tsc --noEmit in both web/ and server/
```

---

## Deploying to Railway + Vercel

### 1. Socket server -> Railway

The Socket.io server cannot run on Vercel because serverless functions do not
hold WebSocket connections. Deploy Railway first so the web app can build with a
real `NEXT_PUBLIC_SOCKET_URL`.

1. [railway.app](https://railway.app) -> New Project -> Deploy from GitHub repo.
2. Leave **Root Directory** blank. The repo root has a `Dockerfile` and
   `railway.json` that build the server image, and the Docker build needs both
   `server/` and `web/lib/`.
3. **Variables** tab -> add:
   - `SUPABASE_URL` -> from Supabase Project Settings -> API
   - `SUPABASE_ANON_KEY` -> from Supabase Project Settings -> API
   - `CORS_ORIGIN` -> `https://mines.halfyy.tech`
4. Railway injects `PORT` automatically; do not set `PORT` or `SOCKET_PORT` in
   production.
5. Once deployed, copy Railway's public URL, for example
   `https://server-production-f06f.up.railway.app`.

### 2. Web app -> Vercel

1. Create a new Vercel project pointing at this GitHub repo.
2. **Project Settings -> General -> Root Directory**: set to `web/`.
3. Framework preset: **Next.js** (auto-detected).
4. **Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SOCKET_URL` -> the Railway public URL from step 1
   - `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (optional)
   - `NEXT_PUBLIC_POSTHOG_ENABLED=false` unless analytics are configured
5. Click **Deploy**.

### 3. Supabase auth callback

In the Supabase dashboard:

- **Authentication -> URL Configuration -> Site URL**:
  `https://mines.halfyy.tech`
- **Redirect URLs**:
  - `https://mines.halfyy.tech/auth/callback`
  - `http://localhost:3000/auth/callback` for local development

OAuth and magic-link flows now round-trip through production.

### 4. Verify

- Visit `https://mines.halfyy.tech` -> home loads, "Start playing ->" jumps into
  a solo board.
- Visit `/match` from two browser windows -> both connect to Railway's socket,
  matchmaking pairs them up.
- If `/match` shows the "PvP server unreachable" card, the Railway service is
  cold-starting or down. Click **Retry connection** once it comes back up.

Cost note: Vercel Hobby and Supabase Free are enough for showcase traffic.
Railway's free allowance may cover light demos, but budget about `$5/mo` for
Railway Hobby if you want predictable always-on socket uptime.

---

## Branding

The tab icon is `web/app/icon.png`, sourced from `web/assets/logo.png`. Next.js
App Router wires `app/icon.png` automatically as the favicon. Hard-refresh to
see icon changes after deploy.

---

## Project layout

```
mines/
├── package.json            # Root: dev orchestration (concurrently)
├── Dockerfile              # Builds the server image for Railway
├── railway.json            # Railway build config
├── server/                 # Socket.io matchmaking + match session relay
│   ├── src/
│   │   ├── index.ts        # Connection handler, queue, challenges, invites
│   │   ├── matchmaking.ts  # FIFO queue with stale-socket eviction + logs
│   │   ├── matchSession.ts # Round/match lifecycle, scoring rebroadcasting
│   │   └── auth.ts         # Supabase JWT validation + guest path
│   └── package.json
└── web/                    # Next.js app — UI + Phaser game
    ├── app/                # App Router routes
    │   ├── page.tsx        # Home + leaderboard + primary CTA
    │   ├── play/           # Solo
    │   ├── daily/          # Daily challenge
    │   ├── match/          # PvP lobby + active match
    │   ├── profile/        # Player profile + deep cuts
    │   ├── leaderboard/    # Regional + global rankings
    │   └── demo/[kind]/[id]/  # Replay scrubber for solo/daily/match
    ├── components/
    │   ├── mascot/         # MINOS rail + pose context
    │   ├── multiplayer/    # Server status card
    │   ├── pro/            # Pro toggle, gates, route gate
    │   ├── demo/           # Player + match demo viewers, coach panels
    │   ├── stats/          # Deep cuts: insights, heatmaps, decision speed
    │   └── hud/            # Top HUD, side panel, result overlays
    ├── lib/                # Shared utilities (some imported by server/)
    │   ├── engine/         # Pure scoring, round config, types
    │   ├── coach/          # Pattern detection — used in demo viewers
    │   ├── multiplayer/    # Socket client, protocol, useMultiplayerMatch
    │   ├── leaderboard/    # Hooks + country resolution
    │   ├── stats/          # Deep-cuts computation from action logs
    │   ├── store/          # Zustand match store
    │   ├── demo/           # Demo serialization + playback frames
    │   └── supabase/       # Browser + server clients
    ├── game/               # Phaser scenes + audio + bridge
    │   ├── bridge.ts       # Typed mitt event bus — the React↔Phaser seam
    │   ├── PhaserGame.tsx  # Mount/teardown wrapper
    │   ├── scenes/         # Boot, Preload, Board
    │   └── audio/          # SoundDirector + sample list
    ├── assets/             # Copied to public/ at prebuild
    └── package.json
```

---

## What's next

- **Tournament mode** — bracketed multi-round elimination with seeded
  brackets and a shared spectator stream.
- **Ladder + ranks** — proper Elo with rank icons. The infrastructure is
  in place; the visual layer is the next pass.
- **Mobile** — current breakpoints work, but the mascot rail hides at
  ≤900px viewports. A mobile-first reskin of the HUD and a touch-tuned
  flag/reveal gesture is the obvious next milestone.
- **Coach generality** — pattern detection covers the named tactics today.
  Generalizing to constraint-propagation deduction is a research item.

Minesweeper was never the problem. The wrapper was. We rewrote the wrapper.
