#!/usr/bin/env node
/**
 * Kaletopia build. Zero dependencies. Run: node scripts/build.js
 *
 * Reads every entries/<slug>/index.html, takes the JSON in its
 * <script type="application/json" id="entry-meta"> block, and:
 *   - stamps the shared masthead, entry head, entry tail, and footer into each
 *     page between marker comments (<!-- masthead --> ... <!-- /masthead -->);
 *   - writes the front page, the entries index, one page per section, one page
 *     per tag, and api/entries.json.
 * Every path written is relative, so the site works at any URL.
 * Pages that are entirely generated say so in their first line. Do not edit those.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'Kaletopia';
const REPO = 'https://github.com/lucaspfeiffer/kaletopia';

export const sections = [
  { slug: 'events', label: 'Events', kind: 'event', blurb: 'Things that happened, and how.' },
  { slug: 'people', label: 'People', kind: 'person', blurb: 'Lives, and what they changed.' },
  { slug: 'places', label: 'Places', kind: 'place', blurb: 'Where things happened.' },
  { slug: 'ideas', label: 'Ideas', kind: 'concept', blurb: 'Concepts worth understanding.' },
  { slug: 'works', label: 'Works', kind: 'work', blurb: 'Books, buildings, machines, and art.' },
  { slug: 'organizations', label: 'Organizations', kind: 'organization', blurb: 'Groups and institutions.' },
];
const kinds = sections.map((s) => s.kind);
const sectionForKind = (kind) => sections.find((s) => s.kind === kind);

// ---------- helpers
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = (s) => s;
const tagLabel = (t) => t.replace(/-/g, ' ');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseWhen(s) {
  const neg = s.startsWith('-');
  const parts = (neg ? s.slice(1) : s).split('-').map(Number);
  return { year: neg ? -parts[0] : parts[0], month: parts[1], day: parts[2] };
}
function formatWhenPart(s) {
  const { year, month, day } = parseWhen(s);
  const y = year <= 0 ? `${1 - year} BCE` : String(year);
  if (!month) return y;
  return day ? `${MONTHS[month - 1]} ${day}, ${y}` : `${MONTHS[month - 1]} ${y}`;
}
const formatWhen = (when) => (when ? (when.end ? `${formatWhenPart(when.start)} to ${formatWhenPart(when.end)}` : formatWhenPart(when.start)) : '');
function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
function formatLongDate(date) {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
function readMinutes(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}
function between(html, name) {
  const m = html.match(new RegExp(`<!-- ${name} -->([\\s\\S]*?)<!-- /${name} -->`));
  return m ? m[1] : null;
}
function stamp(html, name, content) {
  const re = new RegExp(`<!-- ${name} -->[\\s\\S]*?<!-- /${name} -->`);
  if (!re.test(html)) return html;
  return html.replace(re, () => `<!-- ${name} -->\n${content}\n<!-- /${name} -->`);
}

// ---------- validation
const DATE_RE = /^-?\d{1,6}(-\d{2}){0,2}$/;
const TAG_RE = /^[a-z0-9][a-z0-9-]*$/;
function validate(slug, m) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  need(typeof m.title === 'string' && m.title.trim(), 'title is required');
  need(kinds.includes(m.kind), `kind must be one of ${kinds.join(', ')}`);
  need(typeof m.summary === 'string' && m.summary.length <= 320, 'summary is required and at most 320 characters');
  if (m.when) {
    need(DATE_RE.test(m.when.start ?? ''), 'when.start must be YYYY, YYYY-MM, or YYYY-MM-DD');
    if (m.when.end) need(DATE_RE.test(m.when.end), 'when.end must be YYYY, YYYY-MM, or YYYY-MM-DD');
  }
  need(Array.isArray(m.tags) && m.tags.every((t) => TAG_RE.test(t)), 'tags must be an array of lowercase-with-hyphens strings');
  need(Array.isArray(m.contributors) && m.contributors.length > 0, 'contributors must list at least one name');
  need(/^\d{4}-\d{2}-\d{2}$/.test(m.published ?? ''), 'published must be YYYY-MM-DD');
  if (m.updated) need(/^\d{4}-\d{2}-\d{2}$/.test(m.updated), 'updated must be YYYY-MM-DD');
  for (const r of m.related ?? []) need(r.entry && r.relation, 'each related item needs entry and relation');
  for (const s of m.sources ?? []) need(s.title, 'each source needs a title');
  if (m.hero) need(m.hero.src && m.hero.alt, 'hero needs src and alt');
  for (const x of m.media ?? []) need(['image', 'video', 'simulation'].includes(x), 'media items must be image, video, or simulation');
  return errors.map((e) => `entries/${slug}/index.html: ${e}`);
}

// ---------- read entries
const entriesDir = join(ROOT, 'entries');
const entries = [];
const problems = [];
for (const slug of readdirSync(entriesDir)) {
  const file = join(entriesDir, slug, 'index.html');
  if (!existsSync(file) || !statSync(join(entriesDir, slug)).isDirectory()) continue;
  const html = readFileSync(file, 'utf8');
  const m = html.match(/<script type="application\/json" id="entry-meta">([\s\S]*?)<\/script>/);
  if (!m) { problems.push(`entries/${slug}/index.html: missing <script type="application/json" id="entry-meta">`); continue; }
  let meta;
  try { meta = JSON.parse(m[1]); } catch (e) { problems.push(`entries/${slug}/index.html: entry-meta is not valid JSON (${e.message})`); continue; }
  problems.push(...validate(slug, meta));
  if (meta.draft) continue;
  const bodyMatch = html.match(/<div class="prose">([\s\S]*?)<!-- entry-tail -->/);
  const body = bodyMatch ? bodyMatch[1] : '';
  entries.push({
    slug, html, file,
    data: { media: [], tags: [], related: [], sources: [], contributors: ['Lucas Pfeiffer'], featured: false, license: 'CC-BY-SA-4.0', ...meta },
    minutes: readMinutes(body),
  });
}
for (const e of entries) for (const r of e.data.related) {
  if (!entries.some((x) => x.slug === r.entry)) problems.push(`entries/${e.slug}/index.html: related entry "${r.entry}" does not exist`);
}
if (problems.length) {
  console.error('Build failed:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
entries.sort((a, b) => (a.data.published < b.data.published ? 1 : a.data.published > b.data.published ? -1 : a.data.title.localeCompare(b.data.title)));

// ---------- shared chrome
const today = new Date();
function masthead(root, { compact = false, active = '' } = {}) {
  const nav = sections.map((s) => `<a href="${root}${s.slug}/"${active === s.slug ? ' aria-current="page"' : ''}>${s.label}</a>`).join('\n      ');
  return `<header class="masthead${compact ? ' compact' : ''}">
  <div class="wrap">
    <div class="strip">
      <a href="${root}entries/">All entries</a>
      <a href="${root}on-this-day/">On this day</a>
      <a href="${root}tags/">Tags</a>
      <a href="${root}about/">About</a>
      <a href="${REPO}">Source</a>
    </div>
    <div class="plate">
      <div class="dateline"><span class="date" data-today>${formatLongDate(today)}</span><a href="${root}">Today's entries</a></div>
      <a class="name" href="${root}">${SITE}</a>
      <div class="dateline right"><span class="tag">An art project for humanity</span></div>
    </div>
    <nav class="sections" aria-label="Sections">
      ${nav}
    </nav>
    <hr class="rule-double">
  </div>
</header>`;
}
function footer(root) {
  const nav = sections.map((s) => `<a href="${root}${s.slug}/">${s.label}</a>`).join('');
  return `<footer class="site-footer">
  <div class="wrap">
    <hr class="rule-strong">
    <div class="cols">
      <a class="name" href="${root}">${SITE}</a>
      <nav aria-label="Footer">${nav}<a href="${root}on-this-day/">On this day</a><a href="${root}about/">About</a></nav>
    </div>
    <p>Kaletopia is open: the writing is <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, the code is MIT, and both live on <a href="${REPO}">GitHub</a>. Not for profit, ever.</p>
  </div>
</footer>`;
}
function head(root, title, description) {
  const full = title === SITE ? SITE : `${esc(title)} · ${SITE}`;
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${full}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="${root}assets/css/site.css">
<link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/json" href="${root}api/entries.json" title="Kaletopia entries">
<script src="${root}assets/js/site.js" defer></script>`;
}
function page(root, { title, description, body, compact = true, active = '' }) {
  return `<!doctype html>
<!-- Generated by scripts/build.js. Do not edit; edit the entries and run the build. -->
<html lang="en">
<head>
${head(root, title, description)}
</head>
<body>
${masthead(root, { compact, active })}
<main>
${body}
</main>
${footer(root)}
</body>
</html>
`;
}

// ---------- cards
function heroSrc(root, e) {
  const src = e.data.hero.src;
  return src.startsWith('http') ? src : `${root}entries/${e.slug}/${src}`;
}
function card(root, e, { size = 'standard', image = true, note = '' } = {}) {
  const d = e.data;
  const href = `${root}entries/${e.slug}/`;
  const showImage = image && d.hero && size !== 'small';
  const interactive = d.media.includes('simulation');
  return `<article class="card ${size}">
  ${showImage ? `<a href="${href}" class="hero"><img src="${heroSrc(root, e)}" alt="${esc(d.hero.alt)}" loading="lazy"></a>` : ''}
  ${note ? `<p class="kicker note">${esc(note)}</p>` : ''}
  <h3><a href="${href}">${esc(d.title)}</a></h3>
  ${size !== 'small' ? `<p class="summary">${esc(d.summary)}</p>` : ''}
  <p class="label meta">${interactive ? '<span class="interactive">Interactive</span>' : ''}<span>${e.minutes} min read</span>${d.when && size !== 'small' ? `<span>${esc(formatWhen(d.when))}</span>` : ''}</p>
</article>`;
}
const hairlineList = (root, list, opts) => list.map((e, i) => `${i ? '<hr class="rule">' : ''}${card(root, e, opts)}`).join('\n');
const grid = (root, list) => `<div class="grid">${list.map((e) => card(root, e)).join('\n')}</div>`;

// ---------- on this day
const yearsAgo = (when, date) => date.getFullYear() - parseWhen(when.start).year;
function onThisDay(date) {
  const m = date.getMonth() + 1, d = date.getDate();
  return entries.filter((e) => e.data.when && parseWhen(e.data.when.start).month === m && parseWhen(e.data.when.start).day === d);
}
function thisMonth(date) {
  const m = date.getMonth() + 1, d = date.getDate();
  return entries.filter((e) => e.data.when && parseWhen(e.data.when.start).month === m && parseWhen(e.data.when.start).day !== d);
}

// ---------- front page
function front() {
  const root = '';
  const lead = entries.find((e) => e.data.featured) ?? entries[0];
  const rest = entries.filter((e) => e !== lead);
  const underLead = rest[0];
  const second = rest.slice(1, 3);
  const row = rest.slice(3, 6);
  const latest = rest.slice(6, 12);
  const todays = onThisDay(today);
  const monthly = thisMonth(today);
  const monthName = MONTHS[today.getMonth()];

  const aboutNote = `<div class="note">
  <p class="kicker">About this paper</p>
  <p>Kaletopia is a curated encyclopedia of history and ideas, read as text, imagery, video, and interactive simulations. It is new, and it grows one entry at a time.</p>
  <p><a href="${root}about/">Read more</a> or <a href="${REPO}/blob/main/CONTRIBUTING.md">help write the next entry</a>.</p>
</div>`;

  const top = lead ? `<div class="top${lead.data.hero ? ' has-image' : ''}">
  <div class="lead-col">
    ${card(root, lead, { size: 'lead', image: false })}
    ${underLead ? `<hr class="rule">${card(root, underLead, { image: false })}` : ''}
  </div>
  ${lead.data.hero ? `<figure class="lead-image"><a href="${root}entries/${lead.slug}/"><img src="${heroSrc(root, lead)}" alt="${esc(lead.data.hero.alt)}"></a>${lead.data.hero.credit ? `<figcaption class="caption">${esc(lead.data.hero.credit)}</figcaption>` : ''}</figure>` : ''}
  <div class="second-col">
    ${second.length ? hairlineList(root, second, { image: false }) : aboutNote}
  </div>
</div>` : '<p class="note">Nothing here yet.</p>';

  const rowHtml = row.length ? `<hr class="rule-strong"><div class="row">${row.map((e) => `<div class="cell">${card(root, e)}</div>`).join('')}</div>` : '';

  const otdHtml = todays.length
    ? hairlineList(root, todays, { size: 'small' }).replace(/<p class="kicker note"><\/p>/g, '')
    : `<p class="empty">Nothing in the archive for ${monthName} ${today.getDate()} yet.</p>`;
  const otd = `<section data-on-this-day>
  <h2 class="section-head">On this day</h2>
  ${todays.length ? todays.map((e, i) => `${i ? '<hr class="rule">' : ''}${card(root, e, { size: 'small', note: `${yearsAgo(e.data.when, today)} years ago` })}`).join('\n') : otdHtml}
</section>
${monthly.length ? `<section data-this-month>
  <h2 class="section-head">${monthName}, other years</h2>
  ${monthly.map((e, i) => `${i ? '<hr class="rule">' : ''}${card(root, e, { size: 'small', note: `${yearsAgo(e.data.when, today)} years ago` })}`).join('\n')}
</section>` : ''}`;

  const latestHtml = latest.length
    ? `<section><h2 class="section-head">Latest</h2>${hairlineList(root, latest, { size: 'small' })}</section>`
    : `<section><h2 class="section-head">Sections</h2><ul class="sections-list">${sections.map((s) => `<li><a href="${root}${s.slug}/"><strong>${s.label}</strong> <span>${s.blurb}</span></a></li>`).join('')}</ul></section>`;

  const body = `<div class="wrap">
  <div class="front">
    <section class="main">
      ${top}
      ${rowHtml}
    </section>
    <aside class="rail">
      ${otd}
      ${latestHtml}
    </aside>
  </div>
</div>`;
  return page(root, { title: SITE, description: 'Kaletopia is an art project for humanity: a curated encyclopedia of history and ideas, read as text, imagery, video, and interactive simulations.', body, compact: false });
}

// ---------- list pages
function listPage(root, { title, blurb, label = '', list, empty, active = '' }) {
  const body = `<div class="wrap">
  <header class="list-head">${label ? `<p class="label">${esc(label)}</p>` : ''}<h1>${esc(title)}</h1><p class="blurb">${esc(blurb)}</p></header>
  <hr class="rule-strong">
  ${list.length ? grid(root, list) : `<p class="empty">${empty}</p>`}
</div>`;
  return page(root, { title, description: blurb, body, active });
}

function onThisDayPage() {
  const root = '../';
  const todays = onThisDay(today), monthly = thisMonth(today);
  const monthName = MONTHS[today.getMonth()];
  const block = (title, list, emptyText, attr) => `<section class="block" ${attr}>
  <h2 class="section-head">${title}</h2>
  ${list.length ? `<div class="grid">${list.map((e) => card(root, e, { note: `${yearsAgo(e.data.when, today)} years ago` })).join('')}</div>` : `<p class="empty">${emptyText}</p>`}
</section>`;
  const body = `<div class="wrap">
  <header class="list-head"><h1>On this day</h1><p class="blurb"><span data-today-long>${formatLongDate(today)}</span>, in other years.</p></header>
  <hr class="rule-strong">
  ${block('Today', todays, 'Nothing in the archive for today yet.', 'data-on-this-day')}
  ${block(`${monthName}, other years`, monthly, `Nothing yet for ${monthName}.`, 'data-this-month')}
</div>`;
  return page(root, { title: 'On this day', description: 'What happened on this day, in other years.', body });
}

// ---------- entry stamping
function entryHead(root, e) {
  const d = e.data;
  const section = sectionForKind(d.kind);
  const by = d.contributors.length === 1 ? d.contributors[0] : `${d.contributors.slice(0, -1).join(', ')} and ${d.contributors.at(-1)}`;
  const dateline = [
    `<span>${formatDate(d.published)}</span>`,
    d.updated ? `<span>Updated ${formatDate(d.updated)}</span>` : '',
    `<span>${e.minutes} min read</span>`,
    d.media.includes('simulation') ? '<span class="interactive">Interactive</span>' : '',
  ].filter(Boolean).join('');
  const hero = d.hero ? `<figure class="hero"><img src="${d.hero.src.startsWith('http') ? d.hero.src : d.hero.src}" alt="${esc(d.hero.alt)}">${d.hero.credit || d.hero.license ? `<figcaption class="caption">${esc(d.hero.credit ?? '')}${d.hero.license ? ` · ${esc(d.hero.license)}` : ''}</figcaption>` : ''}</figure>` : '';
  return `<header class="head">
  <p class="topline label"><a href="${root}${section.slug}/">${section.label}</a>${d.when ? `<span>${esc(formatWhen(d.when))}</span>` : ''}</p>
  <h1>${esc(d.title)}</h1>
  <p class="deck">${esc(d.summary)}</p>
  <p class="byline">By ${esc(by)}</p>
  <p class="dateline label">${dateline}</p>
</header>
${hero}`;
}
function entryTail(root, e) {
  const d = e.data;
  const tags = d.tags.length ? `<section><h2 class="label">Tags</h2><ul class="tags">${d.tags.map((t) => `<li><a href="${root}tags/${t}/">${esc(tagLabel(t))}</a></li>`).join('')}</ul></section>` : '';
  const related = d.related.length ? `<section><h2 class="label">Related</h2><ul class="plain">${d.related.map((r) => {
    const t = entries.find((x) => x.slug === r.entry);
    return `<li><span class="rel">${esc(r.relation)}</span> <a href="${root}entries/${t.slug}/">${esc(t.data.title)}</a></li>`;
  }).join('')}</ul></section>` : '';
  const sources = d.sources.length ? `<section><h2 class="label">Sources</h2><ol class="sources">${d.sources.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}">${esc(s.title)}</a>` : esc(s.title)}${s.author ? `, ${esc(s.author)}` : ''}${s.date ? `, ${esc(s.date)}` : ''}${s.license ? ` (${esc(s.license)})` : ''}</li>`).join('')}</ol></section>` : '';
  return `<footer class="tail prose">
${tags}
${related}
${sources}
<p class="caption contributors">Contributors: ${esc(d.contributors.join(', '))}.</p>
<p class="caption license">This entry is licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/">${esc(d.license)}</a>. <a href="${REPO}/tree/main/entries/${e.slug}">Edit on GitHub</a>.</p>
</footer>`;
}
function stampEntry(e) {
  const root = '../../';
  let html = e.html;
  html = stamp(html, 'masthead', masthead(root, { compact: true, active: sectionForKind(e.data.kind).slug }));
  html = stamp(html, 'entry-head', entryHead(root, e));
  html = stamp(html, 'entry-tail', entryTail(root, e));
  html = stamp(html, 'footer', footer(root));
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(e.data.title)} · ${SITE}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(e.data.summary)}">`);
  if (html !== e.html) writeFileSync(e.file, html);
}

// ---------- hand-written pages that only need chrome
function stampPlain(rel, root, opts) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) return;
  const html = readFileSync(file, 'utf8');
  let out = stamp(html, 'masthead', masthead(root, opts));
  out = stamp(out, 'footer', footer(root));
  if (out !== html) writeFileSync(file, out);
}

// ---------- write everything
const write = (rel, content) => { const f = join(ROOT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };

for (const e of entries) stampEntry(e);
stampPlain('about/index.html', '../', { compact: true });

write('index.html', front());
write('entries/index.html', listPage('../', { title: 'All entries', blurb: `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}, newest first.`, list: entries, empty: 'Nothing yet.' }));
for (const s of sections) {
  const list = entries.filter((e) => e.data.kind === s.kind);
  write(`${s.slug}/index.html`, listPage('../', { title: s.label, blurb: s.blurb, list, active: s.slug, empty: `No entries in ${s.label.toLowerCase()} yet. <a href="${REPO}/blob/main/CONTRIBUTING.md">Help write the first.</a>` }));
}
write('on-this-day/index.html', onThisDayPage());

const tagCounts = new Map();
for (const e of entries) for (const t of e.data.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
const tags = [...tagCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
if (existsSync(join(ROOT, 'tags'))) for (const d of readdirSync(join(ROOT, 'tags'))) if (d !== 'index.html' && !tagCounts.has(d)) rmSync(join(ROOT, 'tags', d), { recursive: true });
write('tags/index.html', page('../', { title: 'Tags', description: 'Every tag on Kaletopia.', body: `<div class="wrap"><header class="list-head"><h1>Tags</h1></header><hr class="rule-strong"><ul class="tag-cloud">${tags.map(([t, n]) => `<li><a href="${t}/">${esc(tagLabel(t))}</a> <span>${n}</span></li>`).join('')}</ul></div>` }));
for (const [t] of tags) {
  const list = entries.filter((e) => e.data.tags.includes(t));
  write(`tags/${t}/index.html`, listPage('../../', { label: 'Tag', title: tagLabel(t), blurb: `${list.length} ${list.length === 1 ? 'entry' : 'entries'}`, list, empty: '' }));
}

write('api/entries.json', JSON.stringify({
  name: SITE,
  generated: today.toISOString(),
  license: { content: 'CC-BY-SA-4.0', code: 'MIT' },
  entries: entries.map((e) => ({
    slug: e.slug,
    path: `entries/${e.slug}/`,
    title: e.data.title, kind: e.data.kind, summary: e.data.summary,
    when: e.data.when ?? null, media: e.data.media, tags: e.data.tags,
    related: e.data.related, sources: e.data.sources,
    hero: e.data.hero ? { ...e.data.hero, src: e.data.hero.src.startsWith('http') ? e.data.hero.src : `entries/${e.slug}/${e.data.hero.src}` } : null,
    contributors: e.data.contributors,
    published: e.data.published, updated: e.data.updated ?? null,
    featured: e.data.featured, license: e.data.license, minutes: e.minutes,
  })),
}, null, 2) + '\n');

console.log(`Built ${entries.length} entries, ${sections.length} sections, ${tags.length} tags.`);
