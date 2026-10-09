# Kaletopia

An art project for humanity. A curated encyclopedia of history and ideas where
an entry is read as text, imagery, video, or an interactive simulation, on any
device.

Live: https://lucaspfeiffer.github.io/kaletopia/ until the site moves to
kaletopia.com. The newsletter at www.kaletopia.com will move to
blog.kaletopia.com at the same time; see "Going live" below.

## How it is made

Plain HTML, CSS, and JavaScript. Nothing to install.

- Every entry is a hand-written page at `entries/<slug>/index.html`, with its
  metadata (title, kind, dates, tags, sources, contributors) in a small JSON
  block in the page's `<head>`, and its images beside it in the same folder.
- `scripts/build.js` is one Node script with no dependencies. It reads the
  entries and regenerates the front page, the entries index, a page per
  section, a page per tag, `api/entries.json`, and the shared masthead and
  footer on every page (between `<!-- masthead -->` and `<!-- footer -->`
  marker comments). Run it after editing an entry:

  ```
  node scripts/build.js
  ```

  Pages it writes in full begin with a comment saying so. Do not edit those;
  edit the entries and run the build again.
- The site is served straight from the `main` branch by GitHub Pages. Every
  path is relative, so it works at any URL.
- `assets/js/site.js` is the only script on ordinary pages. It sets the
  paper's date to the reader's day and fills "on this day" from
  `api/entries.json`. Simulations live under `sims/` and load only on the
  entries that use them.
- `api/entries.json` is a machine-readable index of every entry, for the
  native app that will come later.

## Run it locally

Any static file server works. For example:

```
python3 -m http.server 8000
```

Then open http://localhost:8000/ . Or open `index.html` directly in a browser;
only the "on this day" fetch needs a server.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md). Entries are edited and the bar is
craft, not coverage.

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
   and enforce HTTPS once it verifies. Add a `CNAME` file at the repo root
   containing `kaletopia.com`.
3. **Old links.** `404.html` forwards any `/p/...` path to
   `blog.kaletopia.com`, so post links shared before the move keep working.
   Update the newsletter URLs in entry sources to the new host.

## License

Code is [MIT](LICENSE). Content is [CC BY-SA 4.0](LICENSE-CONTENT.md), the
same license as Wikipedia. Kaletopia is not for profit and never will be.
