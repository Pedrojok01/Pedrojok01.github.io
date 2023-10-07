import { watch } from "chokidar";
import pkg from "lodash";

import { renderAssets } from "./render-assets.js";
import { renderPug } from "./render-pug.js";
import { renderScripts } from "./render-scripts.js";
import { renderSCSS } from "./render-scss.js";

const { each } = pkg;

const PUG_REGEX = /\.pug$/;
const SCSS_REGEX = /\.scss$/;
const JS_REGEX = /src\/js\//;
const ASSETS_REGEX = /src\/assets\//;
const EXCLUDE_REGEX = /(includes|mixins|\/pug\/layouts\/)/;

const watcher = watch("src", {
  persistent: true,
});

let READY = false;
const allPugFiles = {};

process.title = "pug-watch";
process.stdout.write("Loading");

watcher
  .on("add", (filePath) => processFile(filePath, "add"))
  .on("change", (filePath) => processFile(filePath, "change"))
  .on("ready", () => {
    READY = true;
    console.log(" READY TO ROLL!");
    handleSCSS();
  });

function processFile(filePath, watchEvent) {
  if (!READY) {
    if (PUG_REGEX.test(filePath) && !EXCLUDE_REGEX.test(filePath)) {
      allPugFiles[filePath] = true;
      process.stdout.write(".");
    }
    return;
  }

  console.log(`### INFO: File event: ${watchEvent}: ${filePath}`);

  if (PUG_REGEX.test(filePath)) return handlePug(filePath, watchEvent);
  if (SCSS_REGEX.test(filePath) && watchEvent === "change") return handleSCSS();
  if (JS_REGEX.test(filePath)) return renderScripts();
  if (ASSETS_REGEX.test(filePath)) return renderAssets();
}

function handlePug(filePath, watchEvent) {
  if (watchEvent === "change" && EXCLUDE_REGEX.test(filePath)) return renderAllPug();
  if (!EXCLUDE_REGEX.test(filePath)) return renderPug(filePath);
}

function renderAllPug() {
  console.log("### INFO: Rendering All");
  each(allPugFiles, (value, filePath) => renderPug(filePath));
}

function handleSCSS() {
  renderSCSS();
}
