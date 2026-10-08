import { getCollection, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'entries'>;

export async function allEntries(): Promise<Entry[]> {
  const entries = await getCollection('entries', ({ data }) => !data.draft);
  return entries.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
}

/** Parse "YYYY", "YYYY-MM", or "YYYY-MM-DD" into parts. */
export function parseWhen(s: string): { year: number; month?: number; day?: number } {
  const neg = s.startsWith('-');
  const parts = (neg ? s.slice(1) : s).split('-').map(Number);
  return {
    year: neg ? -parts[0] : parts[0],
    month: parts[1],
    day: parts[2],
  };
}

export function formatWhen(when?: { start: string; end?: string }): string {
  if (!when) return '';
  const fmt = (s: string) => {
    const { year, month, day } = parseWhen(s);
    const y = year <= 0 ? `${1 - year} BCE` : String(year);
    if (!month) return y;
    const name = new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' });
    return day ? `${name} ${day}, ${y}` : `${name} ${y}`;
  };
  return when.end ? `${fmt(when.start)} to ${fmt(when.end)}` : fmt(when.start);
}

/** Entries whose subject started on this month and day, any year. */
export function onThisDay(entries: Entry[], today = new Date()): Entry[] {
  const m = today.getMonth() + 1;
  const d = today.getDate();
  return entries.filter((e) => {
    if (!e.data.when) return false;
    const w = parseWhen(e.data.when.start);
    return w.month === m && w.day === d;
  });
}

/** Entries whose subject started in this month, any year, excluding today's. */
export function thisMonth(entries: Entry[], today = new Date()): Entry[] {
  const m = today.getMonth() + 1;
  const d = today.getDate();
  return entries.filter((e) => {
    if (!e.data.when) return false;
    const w = parseWhen(e.data.when.start);
    return w.month === m && w.day !== d;
  });
}

export function yearsAgo(when: { start: string }, today = new Date()): number {
  return today.getFullYear() - parseWhen(when.start).year;
}

/** Minutes to read, from the raw body. Floors at one. */
export function readMinutes(entry: Entry): number {
  const words = (entry.body ?? '').replace(/^---[\s\S]*?---/, '').replace(/<[^>]+>|import .*$/gm, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
