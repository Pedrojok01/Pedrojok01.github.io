import fsExtra from "fs-extra";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);

/**
 * Copies the assets from the source directory to the destination directory.
 */
export async function renderAssets() {
  const sourcePath = resolve(dirname(__filename), "../src/assets");
  const destPath = resolve(dirname(__filename), "../dist/assets/.");

  try {
    // Check if source path exists
    await fsExtra.access(sourcePath);
    // Perform the copy operation
    await fsExtra.copy(sourcePath, destPath);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
