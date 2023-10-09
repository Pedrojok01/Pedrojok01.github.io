import { promises as fs } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import pkg from "shelljs";

import packageJSON from "../package.json" assert { type: "json" };
const { title, version, homepage, author, license, name } = packageJSON;

const { test, mkdir } = pkg;

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);

export async function renderScripts() {
  try {
    const sourcePath = resolve(dirname(__filename), "../src/js/scripts.js");
    const destPath = resolve(dirname(__filename), "../dist/js/scripts.js");
    const destPathDirname = dirname(destPath);

    const copyright = getCopyrightHeader();
    const scriptsJS = await readSourceFile(sourcePath);

    await ensureDirectoryExists(destPathDirname);
    await writeToFile(destPath, copyright + scriptsJS);
  } catch (error) {
    console.error("### ERROR: Failed to render scripts:", error);
  }
}

function getCopyrightHeader() {
  return `/*!
    * Start Bootstrap - ${title} v${version} (${homepage})
    * Copyright 2013-${new Date().getFullYear()} ${author}
    * Licensed under ${license} (https://github.com/Pedrojok01/${name}/blob/master/LICENSE)
    */
    `;
}

async function readSourceFile(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function ensureDirectoryExists(dirPath) {
  if (!test("-e", dirPath)) {
    mkdir("-p", dirPath);
  }
}

async function writeToFile(filePath, content) {
  return fs.writeFile(filePath, content, "utf8");
}
