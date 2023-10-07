import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import pkg from "shelljs";

const { test, rm } = pkg;

/**
 * Removes all files within a specified directory.
 * @param {string} dirPath - The path of the directory to clear.
 */
function clearDirectory(dirPath) {
  // Ensure the directory exists before attempting to clear it
  if (!test("-d", dirPath)) {
    console.error(`Directory ${dirPath} does not exist.`);
    process.exit(1);
  }

  // Perform the removal operation
  rm("-rf", `${dirPath}/*`, (code, stdout, stderr) => {
    if (code !== 0) {
      console.error(`Error: ${stderr}`);
      process.exit(code);
    } else {
      console.log(`Successfully cleared directory: ${dirPath}`);
    }
  });
}

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);

const destPath = resolve(dirname(__filename), "../dist");
clearDirectory(destPath);
