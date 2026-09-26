# pedrojok.com

Source of [pedrojok.com](https://pedrojok.com), the portfolio and resume of Pierre Estrabaud.

A single static page: Pug for the markup, Sass for the styles, and a small three.js scene for the hero
(a brain-like graph swept by a scanner). No framework, no runtime dependencies beyond the bundled scripts.

## Requirements

- Node.js 24 or later (npm comes with it)
- Google Chrome, only to regenerate the social preview image

## Commands

```bash
npm install          # install dependencies
npm start            # build, then watch src/ and serve dist/ with live reload
npm run build        # full build into dist/
npm run og-image     # re-render src/assets/img/og.jpg (1200x630) from the hero
npm run prettier     # format the sources
npm run format:check # check formatting without writing (used in CI)
```

`npm run start:debug` does the same as `npm start` with the Node inspector attached to the watcher.
Set `CHROME_PATH` if Chrome is not at `/usr/bin/google-chrome` when running `og-image`.

## Structure

```
src/
  pug/index.pug        page content and data (projects, skills, nav)
  pug/404.pug          not-found page, served by GitHub Pages at any missing path
  pug/mixins/          shared head tags, icon, project card, contact links
  scss/                tokens (light/dark colors), base styles, one partial per component
  js/main.js           nav, theme toggle, mobile menu, copy email, lazy-loads the scene
  js/scene.js          the three.js hero scene
  assets/              images, copied to dist/assets
  public/              favicons, robots.txt and sitemap.xml, copied to the dist root
scripts/               build steps (Pug, Sass, esbuild, assets), watcher and dev server
```

The build writes everything to `dist/`, which is not committed. Fonts are self-hosted from
`@fontsource` and icons are Font Awesome SVGs inlined at build time.

## Deploy

Every push to `master` runs `.github/workflows/deploy.yml`, which builds the site and publishes `dist/` to
GitHub Pages. The custom domain is set in the repository's Pages settings.

Pull requests and pushes to `master` also run `.github/workflows/check.yml`: formatting, build, external
link check (lychee) and Lighthouse, with the score thresholds in `lighthouserc.json`.

## License

MIT. The first version of this site started from the Start Bootstrap
[Resume](https://github.com/StartBootstrap/startbootstrap-resume) theme.
