# Contributing

[[toc]]

## Ways to help

Bug reports, documentation fixes, translations and new adapters are all welcome. For
anything larger than a small fix, please open an issue first so we can agree on the approach
before you spend time on it.

## Bug reports

Open an issue on [GitHub](https://github.com/formknit/formknit/issues) with the smallest
schema and code that shows the problem, what you expected, what happened, and your package,
React and browser (or Node.js) versions.

## Security problems

Please **do not** open a public issue. Use the "Report a vulnerability" button on the
repository's Security tab. See `SECURITY.md` for what counts and what to expect.

## Setting up

You need Node.js 22 or newer and pnpm (`corepack enable` turns it on).

```bash
git clone https://github.com/formknit/formknit.git
cd formknit
pnpm install
pnpm dev          # playground on http://localhost:5173, running the packages from source
pnpm test
pnpm typecheck
pnpm docs:dev     # this documentation on http://localhost:5174
```

| Folder | |
|---|---|
| `packages/core` | Schemas, formulas, validation. No runtime dependencies |
| `packages/react` | `<Form>`, hooks and the built-in look |
| `packages/builder` | The visual builder |
| `packages/richtext` | The rich text editor field |
| `packages/adapter-*` | UI library adapters |
| `packages/cli` | The command-line tool |
| `apps/api`, `apps/web` | The self-hosted platform |
| `apps/docs`, `apps/playground` | This documentation and the playground |

## Making a change

1. Add or update tests. A bug fix should come with a test that fails without it.
2. Run `pnpm typecheck` and `pnpm test`.
3. If people using the published packages will notice, run `pnpm changeset` and describe the
   change in a sentence: `patch` for fixes, `minor` for features.
4. Open a pull request.

## Ground rules

- A schema is plain JSON. Anything new must survive `JSON.parse(JSON.stringify(schema))`.
- Formulas are never run with `eval` or `new Function`.
- The server must be able to re-check everything the browser does, so validation logic
  belongs in `core`, never in a component.
- Field components must work with a keyboard and a screen reader. The test suites run an
  automated accessibility check over every field type.
- No new runtime dependencies in `core`, `react` or `builder` without discussion.

## Releases

Maintainers release by merging the "Version Packages" pull request that GitHub opens when
changesets reach `main`. Publishing uses npm trusted publishing, so no npm token is stored.
