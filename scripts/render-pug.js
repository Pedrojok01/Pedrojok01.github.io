import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import { format } from "prettier";
import { renderFile } from "pug";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, "dist");
const iconsDir = resolve(
  rootDir,
  "node_modules/@fortawesome/fontawesome-free/svgs",
);
const iconCache = new Map();

function getDestPath(filePath) {
  const srcPugPath = `src${sep}pug${sep}`;
  const distPath = `dist${sep}`;
  return filePath.replace(srcPugPath, distPath).replace(/\.pug$/, ".html");
}

/**
 * Returns a Font Awesome icon as inline SVG markup, e.g. icon("brands/github").
 * Used by the `+icon` mixin in src/pug/mixins/icon.pug.
 */
function icon(name, className) {
  if (!iconCache.has(name)) {
    const svg = readFileSync(resolve(iconsDir, `${name}.svg`), "utf8").replace(
      /<!--.*?-->/s,
      "",
    );
    iconCache.set(name, svg);
  }
  const classes = ["icon", className].filter(Boolean).join(" ");
  return iconCache
    .get(name)
    .replace(
      "<svg ",
      `<svg class="${classes}" aria-hidden="true" focusable="false" `,
    );
}

/**
 * Appends a content hash to a dist file URL, e.g. asset("css/styles.css") → "css/styles.css?v=1a2b3c4d",
 * so browsers fetch the new file after a deploy instead of reusing a cached one.
 * The file must be built before the Pug is rendered.
 */
function asset(path) {
  const filePath = resolve(distDir, path);
  if (!existsSync(filePath)) return path;
  const hash = createHash("sha256")
    .update(readFileSync(filePath))
    .digest("hex")
    .slice(0, 8);
  return `${path}?v=${hash}`;
}

function prettifyHtml(html) {
  return format(html, {
    printWidth: 120,
    tabWidth: 2,
    endOfLine: "lf",
    parser: "html",
    htmlWhitespaceSensitivity: "css",
  });
}

export async function renderPug(filePath) {
  const destPath = getDestPath(filePath);

  try {
    const html = renderFile(filePath, {
      doctype: "html",
      filename: filePath,
      basedir: resolve(dirname(filePath)),
      icon,
      asset,
    });

    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, await prettifyHtml(html));
  } catch (error) {
    console.error(`### ERROR: Failed to render ${filePath}:`, error);
    process.exitCode = 1;
  }
}
