# skinsrestorer.net
The SkinsRestorer website and documentation use TanStack Start, Vite, and Fumadocs.

## Development

Use the Bun version in `package.json` and Node.js 22.12 or later.
Run `bun install --frozen-lockfile`, then `bun run dev`.
Run `bun run build` to build the site for Netlify.
Run `bun run preview` to serve the production build locally.
With the preview running, run `bun run test:site` to test production routes and endpoints.

File routes live in `src/routes`. TanStack generates `src/routeTree.gen.ts`.
Fumadocs generates the browser and server collections in `.source`.
Run `bun run typecheck` to regenerate both before TypeScript checks.

Public configuration uses the `VITE_` variables in `.env`.
Netlify overrides must use the same names. These values are included in browser code.
Keep private keys in variables without the `VITE_` prefix.

## Deployment

Netlify runs `bun run build` and publishes `dist/client`, as defined in `netlify.toml`.
The Netlify Vite plugin also creates the server function for dynamic routes.
The migration keeps the existing page URLs, documentation redirects, and public endpoints.

## Source map uploads

Production builds upload source maps to SkinsRestorer's EU PostHog project (`101544`).
Set `POSTHOG_PERSONAL_API_KEY` in the Netlify site's production environment with the Builds scope.
Use a separate personal API key with error tracking write and organization read access.
Also set this GitHub Actions secret to upload maps from builds on `main`.
The PostHog Rollup plugin uploads browser source maps and removes uploaded maps.
It uses Netlify's `COMMIT_REF` or GitHub's `GITHUB_SHA` as the release version.
The private key stays in the build environment. Do not use a `VITE_` prefix for it.
Local and pull-request builds skip uploads when the key is absent.

## Documentation

Read [the documentation maintenance guide](documentation/README.md) for the source
inventory, writing conventions, release workflow, and validation commands.

## Contributing and support

Read [the contribution guide](CONTRIBUTING.md) for development and review.
Use [the support guide](SUPPORT.md) for questions and issue routing.
