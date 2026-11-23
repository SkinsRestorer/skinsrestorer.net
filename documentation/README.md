# Maintain the documentation

The public guides live in `content/docs`. They target the release recorded in
`verified-release.json`. The website owns the rendering, search, upload, and
generator flows. Do not describe the plugin's development branch as a released
feature.

## Page contract

Every page has a title, description, `docType`, `appliesTo`, `reviewed` date, and
`version`. Give each page a valid Lucide `icon`. `source.config.ts` validates this
metadata. Use one document type:

- `tutorial`: guide a new user to a working result.
- `how-to`: solve one task with prerequisites, steps, an expected result, and a
  failure branch.
- `reference`: provide exact syntax, keys, types, and defaults.
- `explanation`: explain a model, priority, or tradeoff.

The front matter supplies the page heading. Start the body with `##` headings.
Write direct, natural English. Keep commands, identifiers, and error text exact.
Do not use em dashes. Configuration excerpts must have a code title that includes
`SkinsRestorer excerpt`, so validation distinguishes them from platform files.
Use explicit values for MDX tabs. Cards use a title, an href, and Markdown children.

Keep existing URLs when changing navigation. If a page has one canonical
replacement, remove the duplicate and add its redirect to
`src/lib/docs-redirects.ts`. The site redirects both the rendered page and its
`.mdx` export. Preserve useful anchors when rewriting existing pages.

## Local checks

```sh
bun install
bun run check
bun run test
bun run typecheck
bun run docs:java
bun run build
```

`check` includes documentation validation. It checks page metadata, sidebar
entries, internal links, heading anchors, local images, redirect destinations,
configuration excerpts, reference defaults, and command/permission coverage.
It also detects changes in the website's upload, generator, and skin editor
implementations. See [Website source review](#website-source-review).
It uses the pinned inventory and does not require network access.

## Website source review

The upload, generator, and skin editor guides describe code in this
repository. `websiteSources` in `verified-release.json` lists that code with a
hash for each file. `docs:check` fails when a listed file changes after the
last guide review.

The hash covers the runtime code only. The check transpiles each file with
Bun, so comments, types, formatting, and line endings do not change the hash.
Lint fixes and formatter runs do not need a review. A change to logic, strings,
or JSX does.

When `docs:check` reports a changed source:

1. Run `bun run docs:sources` to list the changed files.
2. Read the diff of each file. Check the guides that describe that behavior,
   such as skin upload, the generator, and the skin editor.
3. Update the guides if the behavior changed.
4. Run `bun run docs:sources --accept` to record the reviewed hashes.
5. Commit the guide changes and the inventory in the same change, so reviewers
   see both.

Do not run `--accept` without step 2. To track a new file or stop tracking a
removed one, edit the `websiteSources` keys by hand. Then run the accept command
to fill in the hash.

`docs:java` extracts the complete Maven, Java, and plugin metadata files from
`development/first-plugin.mdx`. It compiles and packages them against the real
published APIs. It needs Maven, JDK 21 or newer, and repository access. Do not
replace those dependencies with test stubs to make the example pass.

Inspect the rendered docs home, a standalone install, proxy install, upload,
configuration table, troubleshooting guide, and API tutorial. Check desktop and
narrow layouts, sidebar navigation, code copying, search, and `.mdx` exports.
A site build does not prove that a Minecraft runtime integration works.

## Release review

The maintainers reviewing a release own its documentation update. Include docs
in the release review instead of waiting for a separate rewrite.

1. Run `bun run docs:upstream` to verify the pinned release source hashes.
2. Run `bun run docs:upstream 15.12.7` with the target version to list changed
   sources. This command is read-only. A changed hash is a review prompt, not
   proof that the public API changed.
3. Inspect new configuration classes, command declarations, permissions, public
   API signatures, platform metadata, updater behavior, and storage changes.
4. Update `verified-release.json` from those reviewed declarations. Include
   changed keys, Java types, defaults, bounds, command forms, permissions, source
   hashes, version, and review date. Never update only the hashes.
   For website workflow changes, follow
   [Website source review](#website-source-review).
5. Update affected guides and reference tables. Revise Java dependency versions
   and compile the tutorial against that release. Change the release tag in the
   [Sources and framework](#sources-and-framework) links.
6. Update page version and review metadata after the review. Do not label an
   unchanged page reviewed without inspecting its applicable source.
7. Check external forwarding and integration instructions against their current
   primary documentation. Record version-specific limits in the page.
8. Run the local checks and inspect the representative pages.
9. On a test server, verify a name skin, PNG skin, clear, reconnect, and backend
   switch. Verify a backend API consumer if the release affects proxy storage.

The inventory's source hashes include configuration and command declarations,
public API contracts, permissions, diagnostics, platform metadata, and lifecycle
code. The drift check also detects new configuration source files. It does not
replace release notes, runtime checks, or review of new features outside those
files.

## Feedback and corrections

The feedback event includes the page URL, documented release, opinion, and
message. Analytics consent affects whether the event is collected. Feedback is
not a support ticket. GitHub edits and issues remain available independently.

Review documentation feedback during release work. Turn a reproducible problem
into an issue with the page, version, failing step, expected result, and actual
result. Close the issue with the correcting change. Give urgent setup errors
priority over wording improvements.

## Sources and framework

Use release-tagged [SkinsRestorer source](https://github.com/SkinsRestorer/SkinsRestorer)
for plugin behavior. Use the local website code for upload, generator, and skin editor behavior.
Use official platform and integration documentation for external configuration.
Do not replace release facts with facts from an unreviewed development branch.
External platform configuration and service limits need their own version check.

| Subject | Primary source |
| --- | --- |
| Configuration keys and defaults | [Release configuration classes](https://github.com/SkinsRestorer/SkinsRestorer/tree/15.12.6/shared/src/main/java/net/skinsrestorer/shared/config) |
| Commands and permissions | [Release command definitions](https://github.com/SkinsRestorer/SkinsRestorer/tree/15.12.6/shared/src/main/java/net/skinsrestorer/shared/commands) |
| API signatures and exceptions | [Release public API](https://github.com/SkinsRestorer/SkinsRestorer/tree/15.12.6/api/src/main/java/net/skinsrestorer/api) |
| Server and proxy plugin requirements | [Release build files](https://github.com/SkinsRestorer/SkinsRestorer/blob/15.12.6/gradle.properties) and [universal JAR build](https://github.com/SkinsRestorer/SkinsRestorer/blob/15.12.6/universal/build.gradle.kts) |
| Fabric requirements | [Release metadata](https://github.com/SkinsRestorer/SkinsRestorer/blob/15.12.6/mod/fabric/src/main/resources/fabric.mod.json) |
| Velocity forwarding | [PaperMC instructions](https://docs.papermc.io/velocity/player-information-forwarding/) |
| DiscordSRV avatar configuration | [DiscordSRV reference](https://docs.discordsrv.com/config/) |
| MineSkin limits and grants | [MineSkin documentation](https://docs.mineskin.org/) |

A procedure needs prerequisites, working steps, an expected result, and a
failure branch. A reference table needs exact names and a source version.

## Contribute a correction

Use the GitHub link on a page to edit its MDX source. For a technical
correction, name the affected release and give a reason that others can
reproduce. For a broken step, state what you tried and the actual result. For a
new feature, add the procedure and the reference entry together.

Treat page feedback as a correction queue. Record the URL, release, reported
result, and resolution in an issue or a documentation change.

The information architecture follows [Diátaxis](https://diataxis.fr/). The site
uses [Fumadocs](https://www.fumadocs.dev/docs/ui). Search and Markdown exports use
`docs-stringify.ts` to turn navigation cards into readable links and omit MDX
wrapper markup.

Each sidebar folder uses `pagesIndex: "index"` for its clickable overview and
an `icon` in `meta.json`. Keep `index` out of the folder's `pages` list, or it
becomes a separate child link. Add an icon to cross-section links with
`[IconName][Link title](/docs/path)`. Folders start collapsed and open for the
current page.
