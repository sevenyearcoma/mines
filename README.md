# MINES

> Сапер, в котором каждый клик ощущается дорогим.

Сорокалетняя игра. Новый стол. Те же правила, выше ставки.

Мы взяли одну из самых недооцененных сеток в истории компьютеров и собрали из
нее соревновательную арену: общие сиды, real-time PvP, множители очков за
смелость, а не за терпение, AI-тренер, который показывает ошибки в replay, и
казино-подача для игры, где один клик может стоить серии. Сама игра не была
сломана. Сломана была упаковка.

Это showcase-сборка: deployable full-stack проект, который доказывает, что
Minesweeper все еще может быть острым, если перестать относиться к нему как к
аксессуару из Windows.

## Live demo

Публичная версия проекта:

**https://mines.halfyy.tech**

Это канонический production-домен проекта. Используйте его для ревью-ссылок,
Supabase auth redirect URLs и проверки GitHub OAuth.

---

## Ставка

Minesweeper не спал двадцать лет потому, что это плохая игра. Он спал потому,
что ему никто не дал ставок. У Solitaire есть турниры Microsoft Hearts. У Sudoku
есть The New York Times. У Tetris есть целая speedrunning-сцена. Minesweeper
положили в Win95 и забыли.

**Мы делаем Minesweeper актуальным в 2026 году.** Не меняя правила, а меняя
рамку. 30-секундный solo sprint - разминка. Дуэль 16x16 с общим сидом против
живого игрока - история. Daily board с одной жизнью, который сегодня проходит
весь мир, - ритуал. Replay, где AI разбирает пропущенный паттерн, - тренировка.

Та же игра, в которую ваш отец играл за офисным столом. Другая причина
возвращаться.

---

## Что внутри

### Три режима, одна идентичность

- **Solo sprint** - casual intermediate board, multi-life режим, мгновенный
  restart. Это входная точка: новый посетитель нажимает "Start playing ->" на
  главной и попадает в доску за один клик, без регистрации.
- **Daily challenge** - один seed, одна жизнь, один UTC-день и общий board для
  всех игроков. После прохождения locked до следующего дня. Поддерживается
  global leaderboard с региональными фильтрами.
- **Ranked 1v1** - матч до трех побед. Одинаковый seed для обоих игроков.
  После смерти игрок видит spectator-view доски соперника. Раунды решаются
  score-системой: скорость, точность и combo определяют победителя. Invite-link
  дуэли, friend challenges и quick-match queue используют один Socket.io server.

### Инженерия - Phaser x React

Сама доска - это **Phaser 4** scene. Tiles являются настоящими game objects с
tweens, particles и stun-overlay на время штрафа за ошибку.

HUD, overlays, modals и matchmaking UI сделаны на **React 19 / Next.js 16 App
Router**. Две части общаются через один типизированный event bus (`mitt`) в
`web/game/bridge.ts`: все domain events идут через него, поэтому game engine не
лезет в React, а React не лезет в Phaser. Это позволило собрать replay, scoring,
sound design и AI coach поверх одного потока событий.

Phaser canvas прозрачный. Casino dealer MINOS сидит за доской на 50% opacity и
реагирует на gameplay: наклоняется на combo-click, держится за голову все 3
секунды stun window после mine, показывает caption вроде "COMBO - 6 chain",
когда растет multiplier. Это не декор, а постоянный индикатор состояния игрока.

### Score-система, которая награждает намерение

Каждый reveal оценивается: base value за открытые cells, combo multiplier за
движение без пауз, speed bonus за cascade-cleared regions и accuracy multiplier
за серию non-guess moves. Ошибка не просто отнимает жизнь: она сбивает combo,
ломает speed bonus и замораживает ввод на три секунды, пока играет stun overlay.
HUD использует seven-segment casino displays с tabular numerics и glow tint,
чтобы состояние читалось прямо во время cascade.

Полный breakdown - base / combo / speed / control / penalty / peak multipliers -
показывается в конце PvP-раунда и в deep-cuts аналитике профиля.

### Auth flow без лишнего трения

- **One-click play.** Anonymous visitor нажимает "Start playing ->" и сразу
  попадает в solo board.
- **Auto-guest.** Если открыть `/match` без аккаунта, приложение автоматически
  создает guest identity с случайным именем. Multiplayer доступен с холодного
  cache за один клик.
- **Real accounts when ready.** Supabase auth с GitHub OAuth и magic-link email.
  После входа guest-сессия продвигается в реальный аккаунт, а прогресс начинает
  сохраняться.

### Pro tier - showcase-фичи за gate

Переключатель в header включает `localStorage`-backed Pro mode и открывает
showpiece-системы:

- **AI Coach** - live pattern detection во время replay. Находит 1-2-1,
  1-2-2-1, 1-1-along-wall и другие named tactics, подсвечивает anchor cells
  золотым, conclusion cells зеленым (safe) или красным (mine), и объясняет
  почему. Работает в solo demos и в side-by-side 1v1 match replays.
- **Pattern-stepping** - step-by-pattern режим в demo player прыгает к
  следующему обучающему моменту, а не к следующему клику. 90-секундный replay
  превращается в 4-шаговый tactical lesson.
- **Demo replays** - каждый solo run и каждый PvP match round записывается с
  action logs. Есть scrub, step и slow-mo. Match demos показывают доски обоих
  игроков параллельно.
- **Deep cuts** - аналитика по action logs: win-rate по difficulty, decision
  speed bars, time-of-day patterns, boom-cell heatmap, ranked tells. Построено
  на той же telemetry, которую использует AI coach.

Если выключить Pro slider, gated features деградируют в "Pro required" prompt:
без мертвых экранов и broken states.

### Multiplayer, который не притворяется бессмертным

Socket.io server - кастомный matchmaker рядом с web app. Он отвечает за auth
(Supabase tokens и guest path), queue / invite-link / friend-challenge flows,
score-tick broadcasting, spectator mode после смерти, паузы между раундами и
15-секундный grace window, чтобы краткий disconnect не выбрасывал игрока из
поиска или матча.

Если server недоступен, lobby не упирается в красную ошибку. Status card
объясняет проблему, дает Retry button и ссылки на solo/daily - режимы, которым
server не нужен. Кнопки, которым нужен server, disabled с tooltip до
восстановления соединения.

### Sound + presentation

- **Hybrid sound design.** Synth reveal blips для мгновенной per-click отдачи,
  поверх них sample files для важных моментов: chip clatter на cascades,
  "ching" на combo milestones, sub-bass thump на mine explosions, fanfare bell
  на wins.
- **MINOS the dealer.** 992x992 mascot внизу слева, полупрозрачный, за content
  layer. Управляется одним React context: страницы вызывают
  `useMascotPose("approve", "clean break - rack 'em again")`, а rail меняет
  pose. Combo слегка подсвечивает и увеличивает его; mistake переводит в wince
  pose на те же 3 секунды, пока игрок stunned.
- **Subtle texture pass.** Два слоя shadows, приглушенный grain, glints только
  на hover/intent. Casino feel остается, eye strain уходит.

---

## Stack

| Layer | Choice | Почему |
| --- | --- | --- |
| App framework | Next.js 16 (App Router) | RSC для быстрых initial loads, client islands там, где нужен action. |
| UI | React 19, TypeScript | Server components для data, client components для gameplay. |
| Game engine | Phaser 4 | Canvas-backed engine, хорошо живет рядом с React через bridge. |
| Auth + DB | Supabase | RLS, GitHub OAuth, magic links, anon key для клиента и server auth. |
| Real-time | Socket.io 4 | Проверенная reconnect-модель и простой protocol для PvP. |
| Analytics | PostHog | Optional product analytics без обязательного vendor lock-in. |
| Hosting (web) | Vercel | Лучший путь для Next.js. |
| Hosting (socket) | Railway | Long-lived process; Vercel functions не держат WebSocket server. |

Все написано на TypeScript. Общие engine + protocol types лежат в `web/lib/` и
импортируются server build напрямую. Repo-root `Dockerfile` копирует и
`server/`, и нужные slices из `web/lib/`.

---

## Локальный запуск

Prerequisites:

- Node.js 22+
- Supabase project с примененными SQL-файлами из `supabase/migrations/`
- Supabase project URL и anon key из Project Settings -> API

Для нового Supabase project откройте SQL Editor и выполните migration files из
`supabase/migrations/` по порядку имен (`0001_...` through `0008_...`). Они
создают tables, triggers, foreign keys и RLS policies для auth, leaderboards,
daily completions, demos и friends.

```bash
# one-time
npm run install:all   # устанавливает зависимости root, web и server

# каждый день
npm run dev           # запускает web (3000) + server (3001)
```

Combined dev script находится в repo-root `package.json` и использует
`concurrently`. Output разделен prefix-ами: `WEB` (yellow), `SRV` (magenta).
Остановка через Ctrl-C завершает оба процесса.

### Environment files

- `web/.env.local` - скопируйте из `web/.env.example`
- `server/.env` - скопируйте из `server/.env.example`

Минимальные local values:

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

Supabase service-role key и JWT secret не нужны. Socket server валидирует
реальных пользователей через Supabase Auth и также поддерживает guest
multiplayer.

### Type-checking

```bash
npm run typecheck   # запускает tsc --noEmit в web/ и server/
```

---

## Deploy на Railway + Vercel

### 1. Socket server -> Railway

Socket.io server нельзя хостить на Vercel как serverless function: ему нужен
long-lived process. Railway deploy идет первым, чтобы web app мог билдиться с
реальным `NEXT_PUBLIC_SOCKET_URL`.

1. [railway.app](https://railway.app) -> New Project -> Deploy from GitHub repo.
2. Leave **Root Directory** blank. В repo root лежат `Dockerfile` и
   `railway.json`; Docker build должен видеть и `server/`, и `web/lib/`.
3. **Variables** tab -> добавьте:
   - `SUPABASE_URL` -> Supabase Project Settings -> API
   - `SUPABASE_ANON_KEY` -> Supabase Project Settings -> API
   - `CORS_ORIGIN` -> `https://mines.halfyy.tech`
4. Railway сам inject-ит `PORT`; не задавайте `PORT` или `SOCKET_PORT` в
   production.
5. После deploy скопируйте public Railway URL, например
   `https://server-production-f06f.up.railway.app`.

### 2. Web app -> Vercel

1. Создайте Vercel project из этого GitHub repo.
2. **Project Settings -> General -> Root Directory**: `web/`.
3. Framework preset: **Next.js**.
4. **Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SOCKET_URL` -> public Railway URL из шага 1
   - `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (optional)
   - `NEXT_PUBLIC_POSTHOG_ENABLED=false`, если analytics не настроен
5. Нажмите **Deploy**.

### 3. Supabase auth callback

В Supabase dashboard:

- **Authentication -> URL Configuration -> Site URL**:
  `https://mines.halfyy.tech`
- **Redirect URLs**:
  - `https://mines.halfyy.tech/auth/callback`
  - `http://localhost:3000/auth/callback` для local development

После этого OAuth и magic links возвращают пользователя в production или local
app корректно.

### 4. Verify

- Откройте `https://mines.halfyy.tech`: home page грузится, "Start playing ->"
  открывает solo board.
- Откройте `/match` в двух browser windows: оба клиента подключаются к Railway
  socket, matchmaking должен создать пару.
- Если `/match` показывает "PvP server unreachable", Railway service может
  cold-start-иться или быть down. Подождите и нажмите **Retry connection**.

Cost note: Vercel Hobby и Supabase Free достаточно для showcase traffic.
Railway free allowance может хватить для легких demo, но для predictable
always-on socket uptime лучше закладывать около `$5/mo` за Railway Hobby.

---

## Branding

Tab icon - это `web/app/icon.png`, sourced from `web/assets/logo.png`. Next.js
App Router автоматически wire-ит `app/icon.png` как favicon. После deploy
сделайте hard refresh, чтобы увидеть изменения icon.

---

## Структура проекта

```text
mines/
|-- package.json            # Root: dev orchestration через concurrently
|-- Dockerfile              # Server image для Railway
|-- railway.json            # Railway build config
|-- supabase/
|   `-- migrations/         # SQL schema, triggers и RLS policies
|-- server/                 # Socket.io matchmaking + match session relay
|   |-- src/
|   |   |-- index.ts        # Connections, queue, challenges, invites
|   |   |-- matchmaking.ts  # FIFO queue, stale-socket eviction, logs
|   |   |-- matchSession.ts # Round/match lifecycle, scoring rebroadcasting
|   |   `-- auth.ts         # Supabase token validation + guest path
|   `-- package.json
`-- web/                    # Next.js app, UI + Phaser game
    |-- app/                # App Router routes
    |   |-- page.tsx        # Home + leaderboard + primary CTA
    |   |-- play/           # Solo
    |   |-- daily/          # Daily challenge
    |   |-- match/          # PvP lobby + active match
    |   |-- profile/        # Player profile + deep cuts
    |   |-- leaderboard/    # Regional + global rankings
    |   `-- demo/[kind]/[id]/ # Replay scrubber for solo/daily/match
    |-- components/
    |   |-- mascot/         # MINOS rail + pose context
    |   |-- multiplayer/    # Server status card
    |   |-- pro/            # Pro toggle, gates, route gate
    |   |-- demo/           # Player + match demo viewers, coach panels
    |   |-- stats/          # Deep cuts: insights, heatmaps, decision speed
    |   `-- hud/            # Top HUD, side panel, result overlays
    |-- lib/                # Shared utilities, часть импортируется server/
    |   |-- engine/         # Pure scoring, round config, types
    |   |-- coach/          # Pattern detection для demo viewers
    |   |-- multiplayer/    # Socket client, protocol, useMultiplayerMatch
    |   |-- leaderboard/    # Hooks + country resolution
    |   |-- stats/          # Deep-cuts computation from action logs
    |   |-- store/          # Zustand match store
    |   |-- demo/           # Demo serialization + playback frames
    |   `-- supabase/       # Browser + server clients
    |-- game/               # Phaser scenes + audio + bridge
    |   |-- bridge.ts       # Typed mitt event bus между React и Phaser
    |   |-- PhaserGame.tsx  # Mount/teardown wrapper
    |   |-- scenes/         # Boot, Preload, Board
    |   `-- audio/          # SoundDirector + sample list
    |-- assets/             # Source media/audio assets
    `-- package.json
```

---

## Что дальше

- **Tournament mode** - bracketed multi-round elimination с seeded brackets и
  shared spectator stream.
- **Ladder + ranks** - нормальный Elo и rank icons. Infrastructure уже есть,
  следующий шаг - visual layer.
- **Mobile** - текущие breakpoints работают, но mascot rail скрывается на
  viewports <= 900px. Нужен mobile-first HUD reskin и touch-tuned gesture для
  flag/reveal.
- **Coach generality** - pattern detection уже покрывает named tactics.
  Следующий research item - constraint-propagation deduction.

Проблемой никогда не был Minesweeper. Проблемой была оболочка. Мы переписали
оболочку.
