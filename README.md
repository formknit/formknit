# Formknit

[![npm](https://img.shields.io/npm/v/@formknit/core?label=npm&color=4f46e5)](https://www.npmjs.com/org/formknit)
[![CI](https://github.com/formknit/formknit/actions/workflows/ci.yml/badge.svg)](https://github.com/formknit/formknit/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-formknit.github.io-4f46e5)](https://formknit.github.io/formknit/)
[![MIT licence](https://img.shields.io/badge/licence-MIT-green)](LICENSE)

Open-source form engine for React developers. Describe a form once as data, then render it,
validate it on the server with the same rules, and let people edit it in a visual builder.

**[Documentation](https://formknit.github.io/formknit/)** ·
[Your first form](https://formknit.github.io/formknit/guide/quickstart) ·
[Field types](https://formknit.github.io/formknit/guide/fields) ·
[Formulas](https://formknit.github.io/formknit/guide/expressions) ·
[API reference](https://formknit.github.io/formknit/reference/core) ·
[Self-hosted platform](https://formknit.github.io/formknit/platform/overview)

> **Status: early (0.x).** Used and tested, but expect breaking changes between minor
> versions until 1.0. Each release lists them in the
> [release notes](https://formknit.github.io/formknit/guide/release-notes).

## Install

```bash
npm install @formknit/core @formknit/react
```

See [installation](https://formknit.github.io/formknit/guide/installation) for pnpm, yarn,
bun and Next.js.

## Quick look

```tsx
import { calculated, form, number, repeater, select, text } from '@formknit/core'
import { Form } from '@formknit/react'
import '@formknit/react/styles.css'

const invoice = form('Fee invoice', [
  select('country', { NP: 'Nepal', IN: 'India' }).label('Country').required(),
  text('district').label('District').visibleWhen('country == "NP"').required(),
  repeater('items', [
    text('name').label('Item').required(),
    number('qty').label('Qty').min(1),
    number('rate').label('Rate'),
    calculated('amount', 'qty * rate').label('Amount'),
  ]).label('Items').minItems(1),
  calculated('total', 'SUM(items.amount)').label('Total'),
])

// `data` is typed from the schema: data.items[0].amount is number | null
export const InvoiceForm = () => <Form schema={invoice} onSubmit={(data) => save(data)} />
```

Check the same submission on your server with the same schema:

```ts
import { validate } from '@formknit/core'

const result = validate(invoice, requestBody)
if (!result.valid) return respond(422, result.errors) // { 'items.0.qty': ['Qty must be at least 1'] }
await db.insert(result.data) // hidden and unknown fields removed, every formula recalculated
```

The full walk-through is in [your first form](https://formknit.github.io/formknit/guide/quickstart).

## Why Formknit

- **One definition.** A form is plain JSON. The renderer, the server validator and the visual
  builder all read the same schema, so the browser and the server can never disagree.
  ([How it works](https://formknit.github.io/formknit/guide/concepts))
- **Spreadsheet-style formulas.** Totals, show and hide rules and custom checks use one small
  expression language with 28 functions. It is parsed by Formknit and never run as JavaScript,
  so schemas from a database are safe. ([Formulas](https://formknit.github.io/formknit/guide/expressions))
- **Typed data.** Forms written in code give you the type of the submitted data for free.
  ([Defining forms](https://formknit.github.io/formknit/guide/defining-forms))
- **Your UI library.** A themeable built-in look with sizes, variants and dark mode, adapters
  for Material UI and shadcn/ui, or your own component for any field.
  ([Adapters](https://formknit.github.io/formknit/guide/adapters))
- **A builder for your users.** Embed a drag-and-drop designer with a rule builder, formula
  editor, pages, undo and live preview. ([Visual builder](https://formknit.github.io/formknit/guide/builder))
- **Everything forms need.** Multi-page forms, repeating groups, conditional logic, lookups
  from other data, file uploads, signatures, rich text, saved drafts and translations.
- **Accessible.** Labels, errors and focus handling are built in, and every field type passes
  an automated accessibility check.

## Packages

| Package | | Docs |
|---|---|---|
| [`@formknit/core`](https://www.npmjs.com/package/@formknit/core) | Schemas, formulas, validation. No dependencies; runs in browsers, Node, Bun, Deno and edge runtimes | [Reference](https://formknit.github.io/formknit/reference/core) |
| [`@formknit/react`](https://www.npmjs.com/package/@formknit/react) | `<Form>`, hooks and the themeable built-in look | [Guide](https://formknit.github.io/formknit/guide/form-component) |
| [`@formknit/builder`](https://www.npmjs.com/package/@formknit/builder) | The drag-and-drop form builder | [Guide](https://formknit.github.io/formknit/guide/builder) |
| [`@formknit/richtext`](https://www.npmjs.com/package/@formknit/richtext) | Rich text editor field built on Tiptap | [Guide](https://formknit.github.io/formknit/guide/rich-text) |
| [`@formknit/adapter-mui`](https://www.npmjs.com/package/@formknit/adapter-mui) | Renders forms with Material UI | [Guide](https://formknit.github.io/formknit/guide/adapter-mui) |
| [`@formknit/adapter-shadcn`](https://www.npmjs.com/package/@formknit/adapter-shadcn) | A file you copy into a shadcn/ui project | [Guide](https://formknit.github.io/formknit/guide/adapter-shadcn) |
| [`@formknit/cli`](https://www.npmjs.com/package/@formknit/cli) | `formknit check` and `formknit types` for JSON schemas | [Guide](https://formknit.github.io/formknit/guide/cli) |

All packages share one version number and are released together.

## The self-hosted platform

`apps/api` and `apps/web` are an optional web application built on the packages: publish
forms at public addresses, collect and review submissions, work in teams with five roles,
and send data on through signed webhooks and a REST API. It runs on SQLite or PostgreSQL,
with Docker or without.

```bash
cp .env.example .env    # set WEB_ORIGIN and POSTGRES_PASSWORD
docker compose up -d
```

Read the [platform documentation](https://formknit.github.io/formknit/platform/overview) for
[installation](https://formknit.github.io/formknit/platform/installation),
[configuration](https://formknit.github.io/formknit/platform/configuration) and
[security](https://formknit.github.io/formknit/platform/security) before putting it online.

## Documentation

The documentation lives at **[formknit.github.io/formknit](https://formknit.github.io/formknit/)**:

| Section | |
|---|---|
| [Getting started](https://formknit.github.io/formknit/guide/introduction) | Introduction, installation, your first form, how it works |
| [Defining forms](https://formknit.github.io/formknit/guide/defining-forms) | Field types, layout and pages, repeating groups, conditional logic, the schema reference |
| [Formulas and validation](https://formknit.github.io/formknit/guide/expressions) | The formula language, every function, validation rules, server examples |
| [Rendering in React](https://formknit.github.io/formknit/guide/form-component) | The Form component, hooks, lookups, uploads, drafts, styling, translations |
| [Extending](https://formknit.github.io/formknit/guide/custom-fields) | Custom fields and functions, adapters, the builder, rich text |
| [Platform](https://formknit.github.io/formknit/platform/overview) | Installing and running the self-hosted app, webhooks, the API |
| [API reference](https://formknit.github.io/formknit/reference/core) | Every export of every package |

Its source is in `apps/docs`. To read it locally, run `pnpm docs:dev` and open
http://localhost:5174.

## Development

Requires Node.js 22 or newer and pnpm (`corepack enable` turns it on).

```bash
pnpm install
pnpm dev          # playground with example forms on http://localhost:5173
pnpm test
pnpm typecheck
pnpm build
```

See [contributing](https://formknit.github.io/formknit/guide/contributing) for how the
repository is organised, the ground rules, and how releases work. Report security problems
privately, as described in [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE) © Shishir Rai and Formknit contributors
