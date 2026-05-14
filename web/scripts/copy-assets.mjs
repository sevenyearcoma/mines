import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "..", "assets");
const dest = resolve(__dirname, "..", "public", "assets", "audio");

async function main() {
  if (!existsSync(src)) {
    console.warn(`[copy-assets] source missing: ${src}`);
    return;
  }
  await mkdir(dest, { recursive: true });
  const files = await readdir(src);
  let copied = 0;
  for (const f of files) {
    if (!/\.(ogg|mp3|wav)$/i.test(f)) continue;
    await cp(join(src, f), join(dest, f));
    copied++;
  }
  console.log(`[copy-assets] copied ${copied} audio file(s) to public/assets/audio/`);
}

main().catch((err) => {
  console.error("[copy-assets] failed:", err);
  process.exit(1);
});
