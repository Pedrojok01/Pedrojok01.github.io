import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import autoprefixer from "autoprefixer";
import postcss from "postcss";
import { compile } from "sass";

const rootDir = resolve(import.meta.dirname, "..");
const stylesPath = resolve(rootDir, "src/scss/styles.scss");
const destPath = resolve(rootDir, "dist/css/styles.css");

export async function renderSCSS() {
  try {
    const { css } = compile(stylesPath, {
      loadPaths: [resolve(rootDir, "node_modules")],
      style: "compressed",
      // Bootstrap 5.3 still uses @import and legacy color functions.
      quietDeps: true,
    });

    const result = await postcss([autoprefixer]).process(css, {
      from: undefined,
      to: "styles.css",
    });
    result.warnings().forEach((warn) => console.warn(warn.toString()));

    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, result.css);
  } catch (error) {
    console.error("### ERROR: Failed to render SCSS:", error);
    process.exitCode = 1;
  }
}
