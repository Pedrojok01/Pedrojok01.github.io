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
    command: "node --inspect scripts/sb-watch.js",
    name: "SB_WATCH",
    prefixColor: "bgBlue.bold",
  },
  {
    command: `${browserSyncPath} dist -w --no-online`,
    name: "SB_BROWSER_SYNC",
    prefixColor: "bgBlue.bold",
  },
];

const config = {
  prefix: "name",
  killOthers: ["failure", "success"],
};

async function runCommands() {
  try {
    await concurrently(commands, config);
    console.log("Success");
  } catch (error) {
    console.error("Failure:", error);
  }
}

runCommands();
