After making changes, run `bun run check` and fix all errors.

## React conventions

- Use PascalCase for React component names. Match the existing component filename convention.
- Use kebab-case for new hook and utility filenames, unless this repository documents another convention.
- Use stable domain identities as React keys. Do not use array indexes as keys.
- Use an existing `generateN` helper or stable placeholder IDs for fixed skeleton slots.
- Keep page structure, headings, navigation, labels, and independent content mounted while data loads.
- Show skeletons only for unresolved values, rows, and permission-dependent actions. Do not block a page on its slowest query.

## Tailwind spacing

- Use `gap-*` utilities for spacing between elements. Do not use `space-*` utilities.

## shadcn/ui

- For shadcn/ui work, use the `shadcn` skill and component documentation.
- Compose existing shadcn/ui components before writing custom primitives. Use `Field`, `InputGroup`, and `Item` where appropriate.
- Fix application consumers before changing `components/ui`. Change a shared primitive only for a demonstrated component defect.

## Design skills

- For visual design work, use `frontend-design` and `uncodixfy`.

## Fumadocs content

- Keep collection paths and front matter consistent with `source.config.ts`.
- Use `.md` for plain content and `.mdx` when imports or React components are needed.
- Use the front-matter title as the page heading. Start body sections at `##`.
- Register shared MDX components through the existing component registry. Extract reusable components instead of long inline JSX.
- Use registered Fumadocs components for callouts, related links, tabs, steps, FAQs, and API tables.
- Give each `Tab` an explicit `value`. Use stable heading anchors when other pages link to them.
- Use descriptive links, language-tagged code fences, and useful image alt text.
- Preview changed pages and check links, code blocks, tables, and images before publishing.
- For YouTube embeds, reuse the existing component when available. Use `/embed/VIDEO_ID` with a clear title.
- Keep video embeds responsive at 16:9. Include a text summary and do not autoplay.

## Effect workflows

Use the installed Effect v4 APIs for fallible application and tooling workflows. Keep pure helpers and framework rendering direct.

- Compose MineSkin operations with the native exports in `src/lib/mineskin.ts`. Keep Promise execution at browser and framework boundaries.
- Use `src/lib/effect-http.ts` for bounded HTTP reads, deadlines, schema decoding, and response cleanup. Never retry an upload automatically.
- Keep credentials out of proxy requests. Cancel superseded reads and suppress their late results through the current request owner.
- Use `SkinImages` for image loading and detection. Release image handlers before the owning component revokes its object URL.
- Use `scripts/lib/runtime.ts` for filesystem operations, temporary directories, and compiler processes. Reap a child process before removing its working directory.
- Preserve the 120-second release cache when changing release reads. Keep documentation output order stable under bounded concurrency.
- Run `bun run test`, `bun run typecheck`, `bun run check`, `bun run docs:java`, and `bun run build` for changes across these workflows.
