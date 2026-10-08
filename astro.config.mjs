// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// BASE_PATH is set by the GitHub Pages workflow while the site lives at
// lucaspfeiffer.github.io/kaletopia. Once kaletopia.com points here, drop it.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: 'https://www.kaletopia.com',
  base,
  trailingSlash: 'ignore',
  integrations: [mdx()],
  build: { format: 'directory' },
});
