# Contributing to Kaletopia

Kaletopia is an art project for humanity: a curated encyclopedia of history
and ideas where entries are read as text, imagery, video, and interactive
simulations. It is not for profit and never will be. Contributions are
welcome, and they are edited.

## What makes a good entry

- **A subject, not a take.** Entries are about a person, place, event,
  concept, work, or organization. Opinion lives in the sources, not the entry.
- **Depth matches what we have.** A two-paragraph entry with one good image is
  a complete entry. Add a simulation only when it shows something words cannot.
- **Curated, not comprehensive.** Say the few things that matter and link
  onward. Wikipedia already exists.
- **Sourced.** Every claim a reader might doubt gets a source in the metadata.
- **Tagged.** Every entry carries tags, lowercase with hyphens. Reuse existing
  tags before inventing one; the tag pages are how readers find related
  entries.
- **Credited.** `contributors` lists everyone who worked on the entry, in
  order. Add yourself. When Claude helped write, it is listed too.
- **Open.** Text you write is CC BY-SA 4.0. Media you add must carry a license
  that allows redistribution, recorded in the metadata.

## Adding an entry

1. Copy `entries/_template/index.html` to `entries/<slug>/index.html`. The
   slug is lowercase with hyphens and becomes the URL.
2. Fill in the JSON block in the `<head>`. The fields:
   - `title`, `kind` (person, place, event, concept, work, organization),
     `summary` (one or two sentences, at most 320 characters).
   - `when`: `{ "start": "YYYY-MM-DD" }` with as much precision as you have
     (`"1945"`, `"1945-09"`, `"1945-09-02"`). Negative years for BCE.
     Optional `end`. This drives "on this day".
   - `media`: any of `image`, `video`, `simulation`.
   - `tags`, `contributors`, `related` (`{ "entry": "slug", "relation":
     "short verb phrase" }`), `sources` (`title`, optional `url`, `author`,
     `date`, `license`).
   - `hero`: `{ "src": "hero.jpg", "alt": "...", "credit": "..." }`, with the
     image in the entry's folder.
   - `published` as `YYYY-MM-DD`, optional `updated`, `featured`, `draft`.
3. Write the body inside `<div class="prose">` as plain HTML: `<p>`, `<h2>`,
   `<ul>`, `<figure>`. Leave the marker comments where they are; the build
   fills them.
4. Run `node scripts/build.js`. It validates the metadata and regenerates the
   generated pages. Fix anything it complains about.
5. Open the entry in a browser at phone width and desktop width.
6. Open a pull request. The description should say why this subject belongs.

## Adding a simulation

Simulations are small JavaScript modules under `sims/<name>/`, with a
stylesheet beside them and their markup written into the entry that uses them.
They must:

- work with touch and mouse, at phone width and at desktop width;
- be deterministic given a seed, so a reader can share a state;
- run without network requests;
- degrade to a sentence in `<noscript>` when JavaScript is off.

Look at `sims/social-event-market/` and the entry that uses it for the shape.

## Style

- Headlines are sentence case. Decks are one or two sentences.
- Dates in prose are written out: September 2, 1945.
- Prefer short paragraphs and plain words.
