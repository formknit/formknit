# Installation

[[toc]]

## Requirements

- **React 18 or 19** for `@formknit/react` and `@formknit/builder`.
- **Any JavaScript runtime** for `@formknit/core`: browsers, Node.js 18+, Bun, Deno and edge
  runtimes. It has no dependencies.
- **TypeScript is optional** but recommended: forms written in code give you the type of the
  submitted data.

Formknit works with any React setup: Vite, Next.js (app or pages router), Remix, React Router,
Astro islands and others.

## Installing the packages

Start with the two you always need:

::: code-group

```bash [npm]
npm install @formknit/core @formknit/react
```

```bash [pnpm]
pnpm add @formknit/core @formknit/react
```

```bash [yarn]
yarn add @formknit/core @formknit/react
```

```bash [bun]
bun add @formknit/core @formknit/react
```

:::

Add the others when you need them:

```bash
npm install @formknit/builder      # the drag-and-drop builder
npm install @formknit/richtext     # rich text editor fields
npm install @formknit/adapter-mui  # Material UI components
npm install -D @formknit/cli       # schema checks and type generation
```

All `@formknit/*` packages share one version number. Keep them on the same version.

## Importing the styles

The built-in look, and the responsive grid every adapter relies on, come from one stylesheet.
Import it once, near the root of your app:

```ts
import '@formknit/react/styles.css'
```

If you use the builder or the rich text editor, import their stylesheets as well:

```ts
import '@formknit/builder/styles.css'
import '@formknit/richtext/styles.css'
```

## Server-only use

On a server that only validates submissions, install just the core:

```bash
npm install @formknit/core
```

```ts
import { validate } from '@formknit/core'
```

It ships as both an ES module and CommonJS, so `import` and `require` both work.

## Next.js

Formknit components hold state, so render them from a client component:

```tsx
'use client'
import { Form } from '@formknit/react'
import { contact } from './forms'

export function ContactForm() {
  return <Form schema={contact} onSubmit={(data) => fetch('/api/contact', { method: 'POST', body: JSON.stringify(data) })} />
}
```

The form renders on the server too, so the page arrives with the form already in place. The
rich text editor waits for the browser before it starts, which avoids hydration mismatches.

Import the stylesheets in your root `layout.tsx`.

## Trying it without installing

Clone the repository and run the playground, which has example forms, the builder and a
Material UI switch:

```bash
git clone https://github.com/formknit/formknit.git
cd formknit && corepack enable && pnpm install
pnpm dev   # http://localhost:5173
```
