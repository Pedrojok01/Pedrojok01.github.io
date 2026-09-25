import { readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { renderPug } from "./render-pug.js";

const pugPath = resolve(import.meta.dirname, "../src/pug");
const EXCLUDE_REGEX = /include|mixin|\/pug\/layouts\//;

// Render every page under src/pug, skipping includes, mixins and layouts.
const entries = await readdir(pugPath, {
  recursive: true,
  withFileTypes: true,
});
const pages = entries
  .filter((entry) => entry.isFile() && extname(entry.name) === ".pug")
  .map((entry) => join(entry.parentPath, entry.name))
  .filter((filePath) => !EXCLUDE_REGEX.test(filePath));

await Promise.all(pages.map(renderPug));
