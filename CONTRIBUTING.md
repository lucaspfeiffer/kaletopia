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
- **Sourced.** Every claim a reader might doubt gets a source in frontmatter.
- **Tagged.** Every entry carries tags, lowercase with hyphens. Reuse existing
  tags before inventing one; the tag pages are how readers find related
  entries.
- **Credited.** `contributors` lists everyone who worked on the entry, in
  order. Add yourself. When Claude helped write, it is listed too.
- **Open.** Text you write is CC BY-SA 4.0. Media you add must carry a license
  that allows redistribution, recorded in frontmatter or a sidecar file.

## Adding an entry

1. Copy `src/content/_template/` to `src/content/entries/<slug>/` and fill in
   `index.mdx`. The slug is lowercase with hyphens and becomes the URL.
2. Fill in the frontmatter. `src/content.config.ts` is the schema and the
   build fails with a readable message if something is missing.
3. Put images in the entry's folder and reference them relatively.
4. Run `npm run dev` and read your entry on a phone-width window as well as a
   desktop one.
5. Open a pull request. The description should say why this subject belongs.

## Adding a simulation

Simulations are small TypeScript modules under `src/sims/<name>/` with an
Astro component that mounts them. They must:

- work with touch and mouse, at phone width and at desktop width;
- be deterministic given a seed, so a reader can share a state;
- run without network requests;
- degrade to a still image or a sentence when JavaScript is off.

Look at `src/sims/social-event-market/` for the shape.

## Style

- Headlines are sentence case. Decks are one or two sentences.
- Dates in prose are written out: September 2, 1945.
- Prefer short paragraphs and plain words.

## Development

Requires Node 22 or newer.

```
npm install
npm run dev
npm run build
```
