import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const destDir = resolve(rootDir, "dist/js");

// Bootstrap JS is shipped from node_modules so it always matches the SCSS version.
const files = [
  [resolve(rootDir, "src/js/scripts.js"), "scripts.js"],
  [
    resolve(rootDir, "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"),
    "bootstrap.bundle.min.js",
  ],
];

export async function renderScripts() {
  try {
    await mkdir(destDir, { recursive: true });
    await Promise.all(
      files.map(([src, name]) => copyFile(src, resolve(destDir, name))),
    );
  } catch (error) {
    console.error("### ERROR: Failed to render scripts:", error);
    process.exitCode = 1;
  }
}
