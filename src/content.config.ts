import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * A historical date with explicit precision. Stored as a string so entries
 * can reach before 1970 and, with a leading minus, before year 1.
 *   "1945"          precision: year
 *   "1945-09"       precision: month
 *   "1945-09-02"    precision: day
 */
const historicalDate = z.preprocess(
  (v) => {
    // YAML turns 1945 into a number and 1945-09-02 into a Date; accept both.
    if (typeof v === 'number') return String(v);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return v;
  },
  z.string().regex(/^-?\d{1,6}(-\d{2}){0,2}$/, 'Use YYYY, YYYY-MM, or YYYY-MM-DD'),
);

const looseString = z.union([z.string(), z.number()]).transform(String);

export const kinds = ['person', 'place', 'event', 'concept', 'work', 'organization'] as const;
export const mediaKinds = ['image', 'video', 'simulation'] as const;

const entries = defineCollection({
  loader: glob({ pattern: '*/index.mdx', base: './src/content/entries' }),
  schema: z.object({
    title: z.string(),
    kind: z.enum(kinds),
    /** One or two sentences. Shown on cards and as the deck under the headline. */
    summary: z.string().max(320),
    /** When the subject of the entry happened or lived. Drives "on this day". */
    when: z
      .object({
        start: historicalDate,
        end: historicalDate.optional(),
      })
      .optional(),
    /** What the entry carries beyond text. Lets readers and the app filter. */
    media: z.array(z.enum(mediaKinds)).default([]),
    tags: z.array(z.string()).default([]),
    related: z
      .array(
        z.object({
          entry: reference('entries'),
          /** Short verb phrase read as "<this entry> <relation> <that entry>". */
          relation: z.string(),
        }),
      )
      .default([]),
    sources: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().url().optional(),
          author: z.string().optional(),
          date: looseString.optional(),
          license: z.string().optional(),
        }),
      )
      .default([]),
    hero: z
      .object({
        src: z.string(),
        alt: z.string(),
        credit: z.string().optional(),
        license: z.string().optional(),
      })
      .optional(),
    authors: z.array(z.string()).default(['Lucas Pfeiffer']),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    license: z.string().default('CC-BY-SA-4.0'),
  }),
});

export const collections = { entries };
