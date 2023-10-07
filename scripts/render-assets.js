import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import pkg from "shelljs";

const { cp, test } = pkg;

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);

/**
 * Copies the assets from the source directory to the destination directory.
 */
export function renderAssets() {
  const sourcePath = resolve(dirname(__filename), "../src/assets");
  const destPath = resolve(dirname(__filename), "../dist/.");

  // Check if source path exists
  if (!test("-e", sourcePath)) {
    console.error(`Source path ${sourcePath} does not exist.`);
    process.exit(1);
  }

  // Perform the copy operation
  const result = cp("-R", sourcePath, destPath);

  // Check for errors
  if (result.code !== 0) {
    console.error(`Error: ${result.stderr}`);
    process.exit(result.code);
  } else {
    console.log(`Assets have been successfully copied to ${destPath}`);
  }
}
