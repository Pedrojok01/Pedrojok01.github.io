import { resolve, dirname, extname, join } from "path";
import { fileURLToPath } from "url";
import { readdir, stat } from "fs/promises";

import { renderPug } from "./render-pug.js";

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);
const pugPath = resolve(dirname(__filename), "../src/pug");

// Recursive function to process each file and subdirectory
async function processDirectory(directoryPath) {
  const files = await readdir(directoryPath);
  for (const file of files) {
    const filePath = join(directoryPath, file);
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      await processDirectory(filePath); // Recurse into subdirectory
    } else {
      processFile(filePath); // Process individual file
    }
  }
}

// Kick off the processing with the src/pug directory
processDirectory(pugPath).catch((error) => {
  console.error("Error processing directory:", error);
});

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
