# shadcn/ui

[[toc]]

## Introduction

[shadcn/ui](https://ui.shadcn.com) components are not installed from npm; they live in your
project as source files you own. The Formknit adapter follows the same idea: it is one file
you copy into your project, which imports your own shadcn components.

## Installation

1. Add the shadcn components the adapter uses:

   ```bash
   npx shadcn@latest add button checkbox input label radio-group select slider switch textarea
   ```

2. Copy the adapter into your project as `components/formknit.tsx`. It is published in the
   `@formknit/adapter-shadcn` package (`registry/formknit.tsx`) and on
   [GitHub](https://github.com/formknit/formknit/blob/main/packages/adapter-shadcn/registry/formknit.tsx):

   ```bash
   npm install -D @formknit/adapter-shadcn
   cp node_modules/@formknit/adapter-shadcn/registry/formknit.tsx components/formknit.tsx
   ```

3. Use it:

   ```tsx
   import { shadcnAdapter } from '@/components/formknit'
   import { Form } from '@formknit/react'
   import '@formknit/react/styles.css'

   <Form schema={schema} components={shadcnAdapter} />
   ```

The file uses the `@/components/ui/...` import paths that `shadcn init` sets up. Adjust them if
your project uses different ones.

## Making it yours

Because the file is now part of your project, edit it freely: change class names, swap a
component, add a field type. Updates to Formknit will not overwrite it. When a new version
of the adapter is released, compare it with your copy and take the changes you want.

## What it covers

Common fields use your shadcn components: inputs, textareas, selects, radio groups,
checkboxes, switches, sliders, labels and buttons. Ratings, dates ranges, addresses,
signatures, files, panels and repeaters use the built-in look, styled through the same CSS
variables. Map Formknit's variables to your Tailwind theme so they match:

```css
.fx-form {
  --fx-primary: hsl(var(--primary));
  --fx-on-primary: hsl(var(--primary-foreground));
  --fx-border: hsl(var(--border));
  --fx-text: hsl(var(--foreground));
  --fx-muted: hsl(var(--muted-foreground));
  --fx-danger: hsl(var(--destructive));
  --fx-radius: var(--radius);
}
```

::: warning Tested against stand-ins
The adapter's tests use stand-in components with the same props as shadcn's. It has not yet
been run inside a real Tailwind and shadcn project. Reports from people using it are welcome.
:::
