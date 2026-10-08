## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Kaletopia conventions

- Entries live in `src/content/entries/<slug>/index.mdx`; the schema is
  `src/content.config.ts`. Read `CONTRIBUTING.md` before adding one.
- Simulations live in `src/sims/<name>/` as a TypeScript engine plus an Astro
  component. No UI framework; vanilla DOM and canvas.
- Build internal links with `withBase()` from `src/lib/url.ts`, never a bare
  leading slash, because the site may be served under a base path.
- Code is MIT, content is CC BY-SA 4.0. Keep that split.
- Use Node 22+ (`/opt/homebrew/bin/node` on Lucas's machine).
