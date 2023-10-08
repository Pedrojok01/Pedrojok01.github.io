import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { format } from "prettier";
import { renderFile } from "pug";
import pkg from "shelljs";

const { test, mkdir } = pkg;

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);

function getDestPath(filePath) {
  return filePath.replace(/src\/pug\//, "dist/").replace(/\.pug$/, ".html");
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
  const destPathDirname = dirname(destPath);
  if (!test("-e", destPathDirname)) {
    mkdir("-p", destPathDirname);
  }
  writeFileSync(destPath, content);
}

export const renderPug = async (filePath) => {
  const destPath = getDestPath(filePath);
  const srcPath = resolve(dirname(__filename), "../src");

  try {
    const html = renderHtml(filePath, srcPath);
    const prettifiedHtml = await prettifyHtml(html);
    writeToFile(destPath, prettifiedHtml);
  } catch (error) {
    console.error(`### ERROR: Failed to render ${filePath}:`, error);
  }
};
