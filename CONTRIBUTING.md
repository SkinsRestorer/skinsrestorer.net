# Contribute to skinsrestorer.net

Contributions can fix behavior, improve documentation, or add focused tests.

## Before you start

Read [the support guide](SUPPORT.md) for questions and issue routing.
Search existing issues and pull requests. Discuss larger API, architecture, or dependency changes before implementation.
Read [AGENTS.md](AGENTS.md) before changes.

Work from `main` and target that branch in your pull request.
Keep each change focused. Avoid unrelated formatting and dependency updates.

## Prepare a checkout

Use the Bun version in `package.json`. Use Node.js 22.18 or later. The Java example check needs JDK 21 or newer and Maven.

```bash
bun install --frozen-lockfile
bun run dev
```

Run the commands below from the repository root.

## Repository layout

- `content/docs/`: public MDX documentation.
- `documentation/`: source inventory and documentation maintenance guide.
- `src/`: website implementation.
- `scripts/`: documentation and example checks.

## Verify your change

```bash
bun run check
bun run test
bun run typecheck
```

Read [the documentation maintenance guide](documentation/README.md) before editing public guides. It defines page metadata, source verification, release review, and generated references. Keep documented behavior tied to the verified release. Preserve existing URLs and useful anchors. For Java tutorial changes, run `bun run docs:java`. For application or rendering changes, also run `bun run build` and inspect desktop and narrow layouts.

Run the relevant checks before review. State the command and result in the pull request.
If a check cannot run, explain the missing dependency or service. Do not claim it passed.
Keep generated artifacts consistent with their source and review their diff.

## Style and documentation

Follow the existing code conventions and repository formatter. Keep commit hooks enabled.
Add focused tests for changed logic when practical. Avoid tests that only assert source strings.

## Test focus and interaction

Most tests run in plain Bun without a DOM. To test focus, clicks, or other
browser behavior, give the test file a `.dom.test.tsx` suffix and call
`registerDom()` from `src/test/dom.ts` at its top level. It adds
[happy-dom](https://github.com/capricorn86/happy-dom) globals for that file
only and removes them after the file's tests, so other files keep Bun's own
`fetch`, `Request`, and `URL`. Use `render` and `click` from the same module.
They wrap React updates in `act`. See
`src/components/editor/skin-issue-alerts.dom.test.tsx` for an example.

```tsx
import { registerDom, render } from "@/test/dom";

registerDom();
```
Update documentation when commands, APIs, configuration, or expected behavior change.
Keep examples small and reproducible. Preserve exact identifiers, commands, and error messages.

## Open a pull request

Explain the problem and resulting behavior. Link related issues without a placeholder issue number.
Identify affected pages and their source evidence. Include preview screenshots for layout or navigation changes.
Include commands and results. State any runtime checks that remain necessary.
Respond to review with a correction or concrete evidence.

Use Conventional Commits: `type(scope): description`, for example `docs(contributing): explain local validation`.
Use a meaningful scope, or omit it. Keep the subject concise and imperative.
Add a body when the reason or compatibility impact is not obvious.

For vulnerabilities, follow [the security reporting instructions](SECURITY.md).
Remove credentials and private data from examples, logs, and screenshots.

## Git hooks

`bun install` installs the Lefthook hooks for this checkout.
Pre-commit lints and formats the staged files and stages the fixes.
Pre-push runs `bun run check` and `bun run test` as parallel jobs.
CI also runs `bun run docs:java`, the build, and the production route tests.
Lint reports TypeScript errors through oxlint's `typeCheck` option, so CI does not run `tsc` again.
Run `bunx --no-install lefthook run pre-commit` or `bunx --no-install lefthook run pre-push` to run a hook manually.
