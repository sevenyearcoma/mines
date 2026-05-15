# Deploy guide — MINES

A hand-held walkthrough for getting this repo live. Two services to host:

- **`web/`** → **Vercel** (Next.js app)
- **`server/`** → **Railway** (Socket.io matchmaking)

End-to-end first-time time: ~15 minutes. Most of it is waiting for builds.

---

## Phase 0 — Push everything to GitHub

Vercel and Railway both deploy *from a GitHub repo*, so before either platform
can do anything, your latest code has to be on `origin/main`.

```bash
# from repo root
git add .
git status            # eyeball the file list — make sure nothing secret leaks
git commit -m "deploy: showcase polish + Vercel/Railway prep"
git push origin main
```

If `git status` shows env files (`.env.local`, `server/.env`), **stop** —
those should be gitignored. Confirm with `cat .gitignore`. If they're tracked
by mistake, run `git rm --cached web/.env.local server/.env` and commit that.

Open https://github.com/sevenyearcoma/mines in a browser and verify the latest
commit is at the top of the file tree. From this point onward, every git push
triggers a fresh Vercel + Railway deploy automatically.

---

## Phase 1 — Deploy the socket server to Railway

The web app needs `NEXT_PUBLIC_SOCKET_URL` set to a real production URL before
its first deploy can fully verify, so Railway comes first.

### 1.1 Create the Railway project

1. Go to https://railway.app and sign in with GitHub.
2. **New Project → Deploy from GitHub repo → sevenyearcoma/mines**.
3. Railway scans the repo. It will see the `Dockerfile` at the repo root and
   pick it as the build target — good. **Leave Root Directory blank.** (The
   Dockerfile copies both `server/` and `web/lib/` into the image; the build
   context must be the repo root.)
4. The first build kicks off. It will fail at deploy time because env vars
   are missing — that's expected. We'll fix it in step 1.2.

### 1.2 Add the server's env vars

Click into the new service. **Variables** tab → **+ New Variable**. Add these,
copying values from your `server/.env`:

| Variable               | Where to find it                                                |
|------------------------|-----------------------------------------------------------------|
| `SUPABASE_URL`         | Supabase Dashboard → your project → Project Settings → API → URL |
| `SUPABASE_ANON_KEY`    | Same screen → `anon public` key                                 |
| `CORS_ORIGIN`          | Leave as `*` for now — we'll come back and tighten it in 3.3    |

**Do not** set `PORT` or `SOCKET_PORT` — Railway injects `PORT` automatically
and the server reads it.
**Do not** set `SUPABASE_JWT_SECRET`; this server validates user tokens through
Supabase Auth with the anon key, so it works with both legacy and asymmetric JWT
signing projects.

After saving, Railway redeploys. Watch the **Deployments** tab. When it goes
green, click the deployment → **View Logs** and confirm you see:

```
[mines-server] listening on :8080, allowing *
```

### 1.3 Generate a public URL

In the service settings, go to **Settings → Networking → Generate Domain**.
Railway gives you something like `mines-server-production-a1b2.up.railway.app`.
**Copy this URL — you'll paste it into Vercel in Phase 2.4.**

Test the socket endpoint is reachable:

```bash
curl -i https://mines-server-production-a1b2.up.railway.app/socket.io/
# expect: 400 with body "Transport unknown" — that means Socket.io is up
```

A 400 from `/socket.io/` is the expected handshake-failure response from a
correctly-running Socket.io server. If you see DNS errors, a 502, or HTML, the
deploy didn't go green.

---

## Phase 2 — Deploy the web app to Vercel

### 2.1 Create the Vercel project

1. Go to https://vercel.com and sign in with GitHub.
2. **Add New → Project → Import** → pick `sevenyearcoma/mines`.
3. **Configure Project** screen — three things to set:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: click **Edit** and set to `web` (without trailing
     slash). This is critical — without it Vercel tries to build the repo
     root and fails.
   - **Build / Output / Install commands**: leave the auto-detected defaults

Don't click Deploy yet — add env vars first.

### 2.2 Add Vercel env vars

Scroll down to **Environment Variables**. Add each one and set scope to
"Production, Preview, Development" (or just Production for now).

| Variable                              | Value                                                                          |
|---------------------------------------|--------------------------------------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`            | Same as Railway's `SUPABASE_URL`                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Same as Railway's `SUPABASE_ANON_KEY`                                          |
| `NEXT_PUBLIC_SOCKET_URL`              | The Railway URL from Phase 1.3 (e.g. `https://mines-server-…up.railway.app`)  |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`   | Optional — leave blank to disable analytics                                    |
| `NEXT_PUBLIC_POSTHOG_ENABLED`         | `true` if you set the token above, otherwise `false`                           |

### 2.3 First deploy

Click **Deploy**. Vercel will:

1. Clone the repo
2. `cd web && npm install`
3. Run `web/scripts/copy-assets.mjs` (the prebuild — copies audio + media)
4. `next build`
5. Provision a `.vercel.app` URL

Watch the **Build Logs**. Looking for:
- `[copy-assets] copied N asset file(s)` near the start
- `✓ Compiled successfully` and `✓ Generating static pages`
- Final status: **Ready** (green)

When ready, click the preview URL. You should see the home page load with
**MINES duel house** in the wordmark and "Start playing →" as the gold CTA.
If you open browser dev tools → Network, the first request should serve
`/icon.png` (your 128×128 logo) — confirm the browser tab now shows it.

### 2.4 Wire Railway → Vercel

Already done if you set `NEXT_PUBLIC_SOCKET_URL` in 2.2. If you skipped it,
add it now via **Project Settings → Environment Variables**, then
**Deployments → ⋯ → Redeploy** the latest production deployment.

---

## Phase 3 — Wire Supabase to production

### 3.1 Add the Vercel URL as a redirect destination

1. Supabase Dashboard → your project → **Authentication → URL Configuration**.
2. **Site URL**: paste your Vercel production URL (e.g. `https://mines.vercel.app`).
3. **Redirect URLs**: add `https://mines.vercel.app/auth/callback`. Keep your
   local `http://localhost:3000/auth/callback` entry too so dev still works.

This is required for GitHub OAuth and magic-link emails to bounce back to
production correctly. Without it, sign-in works locally but breaks in prod.

### 3.2 Configure the GitHub OAuth provider (optional)

If you want GitHub sign-in to work in production:

1. https://github.com/settings/developers → **OAuth Apps → New OAuth App**.
2. **Authorization callback URL**: paste the Supabase OAuth callback URL —
   you can find it in Supabase Dashboard → Authentication → Providers →
   GitHub → "Redirect URL" (it's a Supabase-hosted URL ending in
   `/auth/v1/callback`).
3. Copy the **Client ID** and generate a **Client secret**.
4. In Supabase: Authentication → Providers → GitHub → toggle on, paste both
   values, save.

### 3.3 Tighten the server's CORS

Back to Railway → your service → Variables. Change `CORS_ORIGIN` from `*` to
your exact Vercel URL:

```
CORS_ORIGIN=https://mines.vercel.app
```

Railway redeploys. After it goes green, the socket server only accepts
WebSocket upgrades from the production frontend — a small security tightening
that costs nothing.

---

## Phase 4 — Verify end-to-end

Spend 60 seconds checking each of these in production:

- [ ] Home page loads. Browser tab shows the logo. No console errors.
- [ ] Click **Start playing →**. Solo board renders. Click a few cells —
      the engine works, the HUD updates, the mascot is visible bottom-left.
- [ ] Click **Daily challenge**. Today's seeded board loads.
- [ ] Click **Ranked 1v1**. Lobby loads. The **PvP server unreachable**
      card should *not* be visible — if it is, Railway is cold-starting or
      down. Wait 30s and click Retry.
- [ ] Open `/match` in a second browser window (different account or guest
      mode). Both click "Find match". They should pair within a few seconds.
- [ ] Open `/leaderboard`. Empty hint + "play the daily →" CTA renders for
      regions with no entries; populated for ones that do.
- [ ] Sign in (GitHub or magic link). Header switches to your user menu.
      Visit `/profile` — the hero, triptych, deep cuts, and recent runs all
      render.

If any of these fail, the verbose logging added in this session will tell you
where to look:

- **`[queue]` logs** in Railway → which player joined / left / paired
- **`mines:connection` events** in the Vercel browser console — `online` /
  `connecting` / `offline` transitions
- **Supabase API logs** in the Supabase dashboard for auth round-trips

---

## Continuous deploys

From this point onward, every `git push origin main` triggers:

1. Vercel rebuilds `web/` (~45s)
2. Railway rebuilds `server/` (~90s — Docker layer cache helps)

Both report status in their dashboards. Vercel posts a check on the GitHub
commit; Railway can too if you enable the integration in **Settings →
Integrations → GitHub**.

Feature branches → Vercel auto-creates Preview Deployments at unique URLs
(`mines-git-feature-foo.vercel.app`). Railway only deploys `main` by default;
configure it under Settings → Source → Branch if you want branch deploys
there too.

---

## Rollback

Vercel: **Deployments tab → previous green deploy → ⋯ → Promote to
Production.** Takes effect in seconds.

Railway: **Deployments tab → previous green deploy → ⋯ → Redeploy this
version.** Takes ~30 seconds while the old image is re-pulled.

Both keep at least 7 days of history on free tier, more on paid plans.

---

## Cost expectations

Pricing changes often; this was checked against the public pricing pages on
2026-05-15.

- **Vercel Hobby**: free for personal, non-commercial projects. The web app
  should fit comfortably inside Hobby limits for a showcase.
- **Railway Free**: $0/mo for experimentation, currently with a small free
  resource allowance. That may cover light demos, but an always-on Socket.io
  container can burn through it. Budget **$5/mo for Railway Hobby** if you want
  predictable uptime without watching credits.
- **Supabase Free**: 500 MB database, 1 GB storage, 50k MAU. Fine for the
  showcase.
- **PostHog Cloud Free**: optional; leave disabled unless you want analytics.

Realistic showcase cost: **$0 while usage stays inside Railway's free resource
allowance, otherwise about $5/mo** for the server.
