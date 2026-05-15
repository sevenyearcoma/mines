import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const socketUrl = readSocketUrl();

if (!isLocalUrl(socketUrl)) {
  console.log(`[socket-server] external socket configured: ${socketUrl}`);
  process.exit(0);
}

if (await isSocketAlive(socketUrl)) {
  console.log(`[socket-server] already listening at ${socketUrl}`);
  process.exit(0);
}

console.warn(
  `[socket-server] not running at ${socketUrl}; start it in another terminal with: cd server && npm run dev`,
);
process.exit(0);

function readSocketUrl() {
  const envPath = resolve(webRoot, ".env.local");
  if (existsSync(envPath)) {
    const env = readFileSync(envPath, "utf8");
    for (const line of env.split(/\r?\n/)) {
      const match = line.match(/^NEXT_PUBLIC_SOCKET_URL=(.*)$/);
      if (match?.[1]) return match[1].trim();
    }
  }
  return "http://localhost:3001";
}

function isLocalUrl(value) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function isSocketAlive(value) {
  const url = new URL("/socket.io/", value);
  url.searchParams.set("EIO", "4");
  url.searchParams.set("transport", "polling");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 800);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
