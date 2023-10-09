import { writeFileSync, promises as fs } from "fs";
import { resolve, dirname, sep } from "path";
import { fileURLToPath } from "url";

import { format } from "prettier";
import { renderFile } from "pug";

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);

function getDestPath(filePath) {
  // Use sep to ensure the correct path separator for the current platform
  const srcPugPath = `src${sep}pug${sep}`;
  const distPath = `dist${sep}`;
  return filePath.replace(srcPugPath, distPath).replace(/\.pug$/, ".html");
}

function renderHtml(filePath, srcPath) {
  return renderFile(filePath, {
    doctype: "html",
    filename: filePath,
    basedir: srcPath,
  });
}

function prettifyHtml(html) {
  return format(html, {
    semi: true,
    trailingComma: "es5",
    printWidth: 120,
    tabWidth: 2,
    singleQuote: false,
    proseWrap: "preserve",
    endOfLine: "lf",
    parser: "html",
    htmlWhitespaceSensitivity: "ignore",
  });
}

function writeToFile(destPath, content) {
  writeFileSync(destPath, content);
}

export const renderPug = async (filePath) => {
  const srcPath = resolve(dirname(filePath));
  const destPath = getDestPath(filePath);

  try {
    const html = renderHtml(filePath, srcPath);
    const prettifiedHtml = await prettifyHtml(html);

    await fs.mkdir(dirname(destPath), { recursive: true });
    writeToFile(destPath, prettifiedHtml);
  } catch (error) {
    console.error(`### ERROR: Failed to render ${filePath}:`, error);
  }
};
