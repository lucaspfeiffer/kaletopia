# Kaletopia conventions

- Plain HTML, CSS, and JavaScript. No framework, no package manager, no
  dependencies. Do not add any.
- Entries live at `entries/<slug>/index.html` with metadata in the
  `<script type="application/json" id="entry-meta">` block. Read
  `CONTRIBUTING.md` before adding one.
- After editing entries, run `node scripts/build.js` (Node 18 or newer) and
  commit the regenerated pages with the change. Never hand-edit a file whose
  first line says it was generated.
- All links and asset paths are relative. The site must work at any base URL.
- Simulations live in `sims/<name>/` as ES modules plus a stylesheet; their
  markup is written into the entry that uses them.
- Code is MIT, content is CC BY-SA 4.0. Keep that split.
- Serve locally with `python3 -m http.server 8000`.
