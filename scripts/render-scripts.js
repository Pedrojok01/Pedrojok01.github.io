import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import { build } from "esbuild";

const rootDir = resolve(import.meta.dirname, "..");
const outDir = resolve(rootDir, "dist/js");

/**
 * Bundles src/js/main.js. The 3D scene (and three.js) is a separate chunk,
 * loaded with a dynamic import after the page is readable; chunk names carry
 * a content hash, main.js gets its hash from the asset() helper in the Pug.
 */
export async function renderScripts() {
  try {
    await rm(outDir, { recursive: true, force: true });
    await build({
      entryPoints: [resolve(rootDir, "src/js/main.js")],
      outdir: outDir,
      bundle: true,
      splitting: true,
      format: "esm",
      target: "es2022",
      minify: true,
      legalComments: "none",
      chunkNames: "chunks/[name]-[hash]",
      logLevel: "warning",
    });
  } catch (error) {
    console.error("### ERROR: Failed to render scripts:", error);
    process.exitCode = 1;
  }
}
