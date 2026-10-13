# Contributing to Formknit

Thanks for helping. Bug reports, fixes, documentation and new adapters are all welcome.

## Setting up

You need Node.js 22 or newer and pnpm (run `corepack enable` once to get it).

```bash
pnpm install
pnpm dev          # playground on http://localhost:5173, running the packages from source
pnpm test         # every package's tests
pnpm typecheck
```

The platform (optional) needs two more terminals: `pnpm seed` once, then `pnpm dev:api` and
`pnpm dev:web`.

## Where things are

| Folder | |
|---|---|
| `packages/core` | Schema, formulas, validation. No dependencies; must run in the browser and on a server |
| `packages/react` | `<Form>`, hooks and the built-in look |
| `packages/builder` | The drag-and-drop builder |
| `packages/richtext` | Rich text editor field |
| `packages/adapter-*` | UI library adapters |
| `packages/cli` | `formknit check` and `formknit types` |
| `apps/api`, `apps/web` | The self-hosted platform |
| `apps/docs`, `apps/playground` | Documentation and a place to try things |

## Making a change

1. Open an issue first for anything large, so we can agree on the approach.
2. Add or update tests. A bug fix should come with a test that fails without it.
3. Run `pnpm typecheck` and `pnpm test`.
4. If users of the published packages will notice the change, run `pnpm changeset` and describe
   it in a sentence. Pick `patch` for fixes, `minor` for new features.
5. Open a pull request.

## Ground rules for the code

- A form schema is plain JSON. Anything new must survive `JSON.parse(JSON.stringify(schema))`.
- Formulas are never run with `eval` or `new Function`.
- The server must be able to re-check everything the browser does. Validation logic belongs in
  `packages/core`, not in a component.
- Field components must work with a keyboard and a screen reader: a label tied to the control,
  errors linked with `aria-describedby`.
- No new runtime dependencies in `core`, `react` or `builder` without discussion.

## Reporting a security problem

Please do not open a public issue. See [SECURITY.md](./SECURITY.md).
