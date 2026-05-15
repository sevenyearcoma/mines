# MINES Socket.io server — production image.
# Used by Railway / Render / Fly. Vercel cannot host this (Socket.io needs a
# long-lived process); deploy `web/` separately to Vercel.
#
# Build context is the repo root because `server/src/*.ts` imports shared
# types from `web/lib/multiplayer` and `web/lib/engine`.
#
# Railway: leave "Root Directory" empty, set "Dockerfile Path" to ./Dockerfile.

FROM node:20-alpine

WORKDIR /app

# Install server deps first so the layer caches across web/ edits.
COPY server/package*.json ./server/
RUN cd server && npm ci

# Copy server source + the shared web/lib slices it imports.
COPY server/tsconfig.json ./server/
COPY server/src ./server/src
COPY web/lib/multiplayer ./web/lib/multiplayer
COPY web/lib/engine ./web/lib/engine

WORKDIR /app/server
EXPOSE 3001
ENV NODE_ENV=production

CMD ["npm", "start"]
