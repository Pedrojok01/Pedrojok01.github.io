import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";

/**
 * Removes all files within a specified directory.
 * @param {string} dirPath - The path of the directory to clear.
 */
async function clearDirectory(dirPath) {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    await Promise.all(
      files.map((file) => {
        const filePath = resolve(dirPath, file.name);
        if (file.isDirectory()) {
          return fs.rm(filePath, { recursive: true });
        } else {
          return fs.unlink(filePath);
        }
      }),
    );
  } catch (error) {
    console.error(`Error clearing directory ${dirPath}:`, error.message);
    process.exit(1);
  }
}

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);

const destPath = resolve(dirname(__filename), "../dist");
clearDirectory(destPath);
