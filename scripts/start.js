import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import concurrently from "concurrently";

// Get the file URL for the current file
const __filename = fileURLToPath(import.meta.url);

const browserSyncPath = resolve(
  dirname(__filename),
  "../node_modules/.bin/browser-sync",
);

const commands = [
  {
    command: "node scripts/sb-watch.js",
    name: "SB_WATCH",
    prefixColor: "bgBlue.bold",
  },
  {
    command: `"${browserSyncPath}" --reload-delay 2000 --reload-debounce 2000 dist -w --no-online`,
    name: "SB_BROWSER_SYNC",
    prefixColor: "bgGreen.bold",
  },
];

const config = {
  prefix: "name",
  killOthers: ["failure", "success"],
};

function runCommands() {
  try {
    concurrently(commands, config);
    console.log("Success");
  } catch (error) {
    console.error("Failure:", error);
  }
}

runCommands();
