# Kaletopia

An art project for humanity. A curated encyclopedia of history and ideas where
an entry is read as text, imagery, video, or an interactive simulation, on any
device.

Live: coming soon at kaletopia.com. Until then, the GitHub Pages build.

## How it is built

- [Astro](https://astro.build) renders everything to static files. No server.
- Entries are Markdown with frontmatter under `src/content/entries/<slug>/`.
  The schema in `src/content.config.ts` is the contract; the build fails
  loudly when an entry breaks it.
- Simulations are plain TypeScript under `src/sims/<name>/`: a pure engine
  with no DOM, plus a view that draws to canvas, plus an Astro component that
  provides the markup. No UI framework.
- `/api/entries.json` is a machine-readable index of every entry, built on
  each deploy, for the native app that will come later.
- The front page is a view over the entries: featured, on this day, latest.

## Run it

Requires Node 22 or newer.

```
npm install
npm run dev
```

`npm run build` writes the site to `dist/`.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md). Entries are edited and the bar is
craft, not coverage.

## License

Code is [MIT](LICENSE). Content is [CC BY-SA 4.0](LICENSE-CONTENT.md), the
same license as Wikipedia. Kaletopia is not for profit and never will be.
