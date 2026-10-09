import type { APIRoute } from 'astro';
import { allEntries } from '../../lib/entries';

/**
 * Machine-readable index of every published entry. The native app reads this.
 * Dates are ISO strings; `when` keeps the entry's own precision.
 */
export const GET: APIRoute = async ({ site }) => {
  const entries = await allEntries();
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const origin = site?.origin ?? '';
  const body = {
    name: 'Kaletopia',
    generated: new Date().toISOString(),
    license: { content: 'CC-BY-SA-4.0', code: 'MIT' },
    entries: entries.map((e) => ({
      slug: e.id,
      url: `${origin}${base}/entries/${e.id}/`,
      title: e.data.title,
      kind: e.data.kind,
      summary: e.data.summary,
      when: e.data.when ?? null,
      media: e.data.media,
      tags: e.data.tags,
      related: e.data.related.map((r) => ({ slug: r.entry.id, relation: r.relation })),
      sources: e.data.sources,
      hero: e.data.hero ?? null,
      contributors: e.data.contributors,
      published: e.data.published.toISOString(),
      updated: e.data.updated?.toISOString() ?? null,
      featured: e.data.featured,
      license: e.data.license,
    })),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
