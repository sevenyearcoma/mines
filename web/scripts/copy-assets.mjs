import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsRoot = resolve(__dirname, "..", "assets");

const copyJobs = [
  {
    src: assetsRoot,
    dest: resolve(__dirname, "..", "public", "assets", "audio"),
    pattern: /\.(ogg|mp3|wav)$/i,
    label: "audio",
  },
  {
    src: resolve(assetsRoot, "media"),
    dest: resolve(__dirname, "..", "public", "assets", "media"),
    pattern: /\.(png|jpg|jpeg|webp|avif|gif)$/i,
    label: "media",
  },
];

async function main() {
  let copied = 0;
  let skipped = 0;
  for (const job of copyJobs) {
    if (!existsSync(job.src)) {
      console.warn(`[copy-assets] ${job.label} source missing: ${job.src}`);
      continue;
    }
    await mkdir(job.dest, { recursive: true });
    const files = await readdir(job.src);
    for (const f of files) {
      if (!job.pattern.test(f)) continue;
      const from = join(job.src, f);
      const to = join(job.dest, f);
      if (await sameFile(from, to)) {
        skipped++;
        continue;
      }
      await copyFile(from, to);
      copied++;
    }
  }
  console.log(
    `[copy-assets] copied ${copied} asset file(s), skipped ${skipped} unchanged`,
  );
}

async function sameFile(a, b) {
  try {
    const [left, right] = await Promise.all([readFile(a), readFile(b)]);
    return left.equals(right);
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error("[copy-assets] failed:", err);
  process.exit(1);
});
