import { unlink, copyFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);

// Resolve paths
const rootDir = resolve(dirname(__filename), "../");
const distDir = resolve(rootDir, "dist");
const oldIndexPath = resolve(rootDir, "index.html");
const newIndexPath = resolve(distDir, "index.html");

// Define the function to update the root index.html
async function updateRootIndex() {
  try {
    // Delete the old index.html at the root
    await unlink(oldIndexPath);
    console.log(`Deleted ${oldIndexPath}`);

    // Copy the new index.html from ./dist to the root
    await copyFile(newIndexPath, oldIndexPath);
    console.log(`Copied ${newIndexPath} to ${oldIndexPath}`);
  } catch (error) {
    console.error("Error updating root index.html:", error.message);
  }
}

// Execute the function
updateRootIndex();
