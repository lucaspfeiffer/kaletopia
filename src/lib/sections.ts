import type { kinds } from '../content.config';

type Kind = (typeof kinds)[number];

/** Newspaper sections, one per entry kind, in nav order. */
export const sections: { slug: string; label: string; kind: Kind; blurb: string }[] = [
  { slug: 'events', label: 'Events', kind: 'event', blurb: 'Things that happened, and how.' },
  { slug: 'people', label: 'People', kind: 'person', blurb: 'Lives, and what they changed.' },
  { slug: 'places', label: 'Places', kind: 'place', blurb: 'Where things happened.' },
  { slug: 'ideas', label: 'Ideas', kind: 'concept', blurb: 'Concepts worth understanding.' },
  { slug: 'works', label: 'Works', kind: 'work', blurb: 'Books, buildings, machines, and art.' },
  { slug: 'organizations', label: 'Organizations', kind: 'organization', blurb: 'Groups and institutions.' },
];

export const sectionForKind = (kind: Kind) => sections.find((s) => s.kind === kind)!;
