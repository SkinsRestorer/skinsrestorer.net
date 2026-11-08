# skinsrestorer.net
The SkinsRestorer website and documentation use TanStack Start, Vite, and Fumadocs.

## Development

Use the Bun version in `package.json` and Node.js 22.18 or later.
Run `bun install --frozen-lockfile`, then `bun run dev`.
Run `bun run build` to build the site for Cloudflare Workers.
Run `bun run preview` to serve the production build locally.
With the preview running, run `bun run test:site` to test production routes and endpoints.

File routes live in `src/routes`. TanStack generates `src/routeTree.gen.ts`.
Fumadocs generates the browser and server collections in `.source`.
Run `bun run typecheck` to regenerate both before TypeScript checks.

Public configuration uses the `VITE_` variables in `.env`.
Cloudflare build overrides must use the same names. These values are included in browser code.
Keep private keys in variables without the `VITE_` prefix.

## Deployment

The project uses the Cloudflare Vite plugin and `cf` CLI, matching SoulFire's deployment setup.
`cloudflare.config.ts` defines the `skinsrestorer-website` Worker, Node.js compatibility, logs, and traces.
Builds write the deployable Worker and static assets to `.cloudflare/output/v0`.

Cloudflare serves matching static assets before invoking the Worker.
Prerendered pages keep their complete HTML, while server functions and public endpoints remain available through the Worker.
`public/_headers` supplies security headers for static files. Worker middleware supplies them for dynamic responses and redirects.

Run `bun run build`, then `bun run deploy:check` to validate deployment without uploading anything.
Run `bunx cf auth login` to sign in and `bun run deploy` to build and deploy the Worker.
The configuration selects the existing SkinsRestorer Cloudflare account.
Set `CLOUDFLARE_ACCOUNT_ID` to override it for another account.
The Worker serves `skinsrestorer.net` and `www.skinsrestorer.net` as custom domains.

GitHub Actions deploys pushes to `main` after the build, checks, and production-route tests pass.
It uses `bunx cf deploy --prebuilt --mode production`, then tests the public site.
The `CLOUDFLARE_API_TOKEN` repository secret grants Worker deployment access in the SkinsRestorer account and route access for this zone.
Cloudflare's GitHub app is not connected to this organization, so deployments run in GitHub Actions instead of Workers Builds.

`bun run cf-typegen` generates Worker types in `.cloudflare/types/index.d.ts`.
The typecheck command runs this step automatically.

## Source map uploads

Production builds upload source maps to SkinsRestorer's EU PostHog project (`101544`).
Use a separate personal API key with error tracking write and organization read access.
Set the `POSTHOG_PERSONAL_API_KEY` GitHub Actions secret to upload maps from builds on `main`.
The PostHog Rollup plugin uploads browser source maps and removes uploaded maps.
It uses GitHub's `GITHUB_SHA` or the current Git commit as the release version.
The private key stays in the build environment. Do not use a `VITE_` prefix for it.
Local and pull-request builds skip uploads when the key is absent.

## Documentation

Read [the documentation maintenance guide](documentation/README.md) for the source
inventory, writing conventions, release workflow, and validation commands.

## Contributing and support

Read [the contribution guide](CONTRIBUTING.md) for development and review.
Use [the support guide](SUPPORT.md) for questions and issue routing.
