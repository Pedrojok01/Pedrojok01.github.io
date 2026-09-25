import { copyFile, cp, mkdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const fontsDir = resolve(rootDir, "dist/assets/fonts");

// Self-hosted fonts (latin subset), declared in src/scss/_fonts.scss.
const fonts = [
  "@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-400-normal.woff2",
  "@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-500-normal.woff2",
  "@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-700-normal.woff2",
  "@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-800-normal.woff2",
  "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
];

/**
 * Copies src/assets into dist/assets, plus the fonts from node_modules.
 */
export async function renderAssets() {
  try {
    await cp(resolve(rootDir, "src/assets"), resolve(rootDir, "dist/assets"), {
      recursive: true,
    });
    await mkdir(fontsDir, { recursive: true });
    await Promise.all(
      fonts.map((font) =>
        copyFile(
          resolve(rootDir, "node_modules", font),
          resolve(fontsDir, basename(font)),
        ),
      ),
    );
  } catch (error) {
    console.error("### ERROR: Failed to copy assets:", error);
    process.exitCode = 1;
  }
}
