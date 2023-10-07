import { resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";

import pkg from "shelljs";

import { renderPug } from "./render-pug.js";

const { find } = pkg;

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);
const srcPath = resolve(dirname(__filename), "../src");

// Process each file found in the srcPath directory
find(srcPath).forEach(processFile);

/**
 * Processes a file if it has a .pug extension and does not match excluded paths.
 * @param {string} filePath - The path of the file to process.
 */
function processFile(filePath) {
  const isPugFile = extname(filePath) === ".pug";
  const isExcluded = /include|mixin|\/pug\/layouts\//.test(filePath);

  if (isPugFile && !isExcluded) {
    renderPug(filePath);
  }
}
