# skinsrestorer.net
The code for our website and documentation!

## Source map uploads

Production builds upload source maps to SkinsRestorer's EU PostHog project (`101544`).
Set `POSTHOG_PERSONAL_API_KEY` in the Netlify site's production environment with the Builds scope.
Use a separate personal API key with error tracking write and organization read access.
Also set this GitHub Actions secret to upload maps from builds on `main`.
The Next.js integration supports Turbopack and removes uploaded maps.
It uses Netlify's `COMMIT_REF` or GitHub's `GITHUB_SHA` as the release version.
The private key stays in the build environment. Do not use a `NEXT_PUBLIC_` prefix for it.
Local and pull-request builds skip uploads when the key is absent.

## Documentation

Read [the documentation maintenance guide](documentation/README.md) for the source
inventory, writing conventions, release workflow, and validation commands.

## Contributing and support

Read [the contribution guide](CONTRIBUTING.md) for development and review.
Use [the support guide](SUPPORT.md) for questions and issue routing.
