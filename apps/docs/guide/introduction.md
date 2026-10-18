# Introduction

[[toc]]

## What is Formknit?

Formknit is an open-source form engine for React developers. You describe a form once, as
plain data called a **schema**, and Formknit does the rest:

- **renders** it in React, with your choice of UI library;
- **validates** it in the browser as people type, and again on your server with exactly the
  same rules;
- **calculates** totals and other derived values with spreadsheet-style formulas;
- lets people **design** forms themselves in an embeddable drag-and-drop builder.

Because a schema is just JSON, a form can live in your code, in a database row, or be edited
by someone who never touches the code at all.

```tsx
import { calculated, form, number, repeater, select, text } from '@formknit/core'
import { Form } from '@formknit/react'

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

export const InvoiceForm = () => <Form schema={invoice} onSubmit={save} />
```

## Why Formknit?

Most forms in real applications share the same chores: conditional fields, repeating rows,
totals, validation that must match between client and server, and a steady stream of requests
to "just add one more field". Formknit is built around a few ideas that make those chores
disappear:

**Forms are data.** A schema can be stored, versioned, diffed, generated and edited. Your
users can change a form without a deploy.

**One set of rules.** The function that decides whether a field is visible, required or valid
is the same pure function in the browser and on the server. They cannot drift apart.

**Formulas, not callbacks.** Logic is written as small expressions like
`IF(total > 10000, total * 0.13, 0)`. They are parsed and evaluated by Formknit, never run as
JavaScript, so a schema from an untrusted source cannot execute code.

**Your design system.** Logic and looks are separate. Use the built-in skin, an adapter for
Material UI or shadcn/ui, or map any field type to your own component.

## The packages

| Package | What it does |
|---|---|
| [`@formknit/core`](/reference/core) | Schemas, formulas, validation. No dependencies; runs in browsers, Node, Bun and Deno |
| [`@formknit/react`](/reference/react) | The `<Form>` component, hooks and the themeable built-in look |
| [`@formknit/builder`](/reference/builder) | The drag-and-drop form builder |
| [`@formknit/richtext`](/reference/richtext) | A rich text editor field built on Tiptap |
| `@formknit/adapter-mui` | Renders forms with Material UI |
| `@formknit/adapter-shadcn` | A file you copy into a shadcn/ui project |
| `@formknit/cli` | Checks schemas and generates TypeScript types |

You only need `core` and `react` to get started. Everything is MIT licensed.

## The self-hosted platform

The repository also contains an optional [platform](/platform/overview): a complete web
application, built on the packages, for publishing forms at public addresses, collecting and
reviewing submissions, working in teams, and sending data to other systems through webhooks
and an API. You run it on your own server with SQLite or PostgreSQL.

## Status

Formknit is at version 0.x. It is used and tested, but expect occasional breaking changes
between minor versions until 1.0. Each release lists them in the
[release notes](./release-notes).

## Where next?

- [Installation](./installation): add Formknit to a project.
- [Your first form](./quickstart): a complete example from schema to server, in ten minutes.
- [How it works](./concepts): the ideas behind the API, worth five minutes before going further.
