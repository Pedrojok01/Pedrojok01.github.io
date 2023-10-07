import { promises as fs } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import autoprefixer from "autoprefixer";
import postcss from "postcss";
import { renderSync } from "sass";

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);

export async function renderSCSS() {
  const destPath = resolve(dirname(__filename), "../dist/css/styles.css");
  const stylesPath = resolve(dirname(__filename), "../src/scss/styles.scss");

  try {
    await ensureDirectoryExists(destPath);
    const results = await renderSass(stylesPath);
    await processAndWriteCSS(results.css, destPath);
  } catch (error) {
    console.error("### ERROR: Failed to render SCSS:", error);
  }
}

async function renderSass(stylesPath) {
  const options = {
    file: stylesPath,
    includePaths: [resolve(dirname(__filename), "../node_modules")],
  };

  return renderSync(options);
}

async function ensureDirectoryExists(destPath) {
  const destPathDirname = dirname(destPath);
  await fs.mkdir(destPathDirname, { recursive: true });
}

async function processAndWriteCSS(css, destPath) {
  const result = await postcss([autoprefixer]).process(css, {
    from: undefined,
    to: "styles.css",
  });

  result.warnings().forEach((warn) => console.warn(warn.toString()));
  await fs.writeFile(destPath, result.css);
}
