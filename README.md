# Kaletopia

An art project for humanity. A curated encyclopedia of history and ideas where
an entry is read as text, imagery, video, or an interactive simulation, on any
device.

Live: https://lucaspfeiffer.github.io/kaletopia/ until the site moves to
kaletopia.com. The newsletter at www.kaletopia.com will move to
blog.kaletopia.com at the same time; see "Going live" below.

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

## Going live at kaletopia.com

The plan, for when the site is ready. Nothing here has happened yet.

1. **Move the newsletter.** In Substack settings, change the custom domain
   from `www.kaletopia.com` to `blog.kaletopia.com`. At the DNS host, add a
   CNAME for `blog` pointing at `target.substack-custom-domains.com`. Wait
   for Substack to issue the certificate. The newsletter keeps working at
   the old address until step 2.
2. **Point the domain here.** At the DNS host, replace the `www` CNAME with
   `lucaspfeiffer.github.io`, and replace the bare-domain forwarding with
   GitHub Pages' A records (185.199.108.153, .109.153, .110.153, .111.153).
   In the repo's Pages settings, set the custom domain to `kaletopia.com`
   and enforce HTTPS once it verifies. Add `public/CNAME` containing
   `kaletopia.com`. Remove the `BASE_PATH` line from
   `.github/workflows/deploy.yml`.
3. **Old links.** `public/404.html` forwards any `/p/...` path to
   `blog.kaletopia.com`, so post links shared before the move keep working.
   Update the newsletter URLs in entry sources to the new host.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md). Entries are edited and the bar is
craft, not coverage.

## License

Code is [MIT](LICENSE). Content is [CC BY-SA 4.0](LICENSE-CONTENT.md), the
same license as Wikipedia. Kaletopia is not for profit and never will be.
