// Renders the social preview image (src/assets/img/og.jpg, 1200x630) from the built hero,
// 3D scene included. Needs a local Chrome: set CHROME_PATH if it is not /usr/bin/google-chrome.
// Usage: node --run og-image (builds first).
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

import { chromium } from "playwright-core";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, "dist");
const outPath = resolve(rootDir, "src/assets/img/og.jpg");
const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";

const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

// Minimal static server for dist/ (ES modules do not load from file://).
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  const file = join(distDir, path.endsWith("/") ? `${path}index.html` : path);
  if (!file.startsWith(distDir)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res
      .writeHead(200, {
        "Content-Type": types[extname(file)] ?? "application/octet-stream",
      })
      .end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const { port } = server.address();

const browser = await chromium.launch({
  executablePath: chromePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    colorScheme: "dark",
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  // Keep only what reads well as a thumbnail: name, tagline and the graph.
  await page.addStyleTag({
    content: `.nav, .scroll-cue, .intro, .hero-actions { display: none !important; }
      .hero { min-height: 630px !important; height: 630px; padding-block: 0 !important; }`,
  });
  await page.waitForSelector(".hero.is-live");
  await page.waitForTimeout(3800); // scan disc mid-graph, a few findings lit
  await page
    .locator(".hero")
    .screenshot({ path: outPath, type: "jpeg", quality: 88 });
  console.log(`Wrote ${outPath}`);
} finally {
  await browser.close();
  server.close();
}
