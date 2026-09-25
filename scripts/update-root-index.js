import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Resolve paths
const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, "dist");
const oldIndexPath = resolve(rootDir, "index.html");
const newIndexPath = resolve(distDir, "index.html");

// Define the function to update the root index.html
async function updateRootIndex() {
  try {
    const content = await readFile(newIndexPath, "utf-8");

    // Update URLs in the content
    const updatedContent = content
      .replace(/href="css\//g, 'href="dist/css/')
      .replace(/href="assets\//g, 'href="dist/assets/')
      .replace(/src="assets\//g, 'src="dist/assets/')
      .replace(/src="js\//g, 'src="dist/js/');

    // Write the updated content to the root index.html
    await writeFile(oldIndexPath, updatedContent);
  } catch (error) {
    console.error("Error updating root index.html:", error.message);
    process.exitCode = 1;
  }
}

// Execute the function
updateRootIndex();
