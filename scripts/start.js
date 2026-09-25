import { resolve } from "node:path";

import concurrently from "concurrently";

// `node scripts/start.js --debug` attaches the Node inspector to the watcher.
const debug = process.argv.includes("--debug");
const browserSyncPath = resolve(
  import.meta.dirname,
  "../node_modules/.bin/browser-sync",
);

const { result } = concurrently(
  [
    {
      command: `node ${debug ? "--inspect " : ""}scripts/sb-watch.js`,
      name: "SB_WATCH",
      prefixColor: "bgBlue.bold",
    },
    {
      command: `"${browserSyncPath}" --reload-delay 2000 --reload-debounce 2000 dist -w --no-online`,
      name: "SB_BROWSER_SYNC",
      prefixColor: "bgGreen.bold",
    },
  ],
  {
    prefix: "name",
    killOthersOn: ["failure", "success"],
  },
);

result.catch(() => {
  process.exitCode = 1;
});
