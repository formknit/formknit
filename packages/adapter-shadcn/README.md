# Formknit adapter for shadcn/ui

shadcn/ui components live in your own project, so this adapter does too: it is one file you
copy in and can edit freely.

1. Copy [`registry/formknit.tsx`](registry/formknit.tsx) to `components/formknit.tsx`.
2. Make sure you have the components it imports:

   ```bash
   npx shadcn@latest add button checkbox input label radio-group select slider switch textarea
   ```

3. Use it:

   ```tsx
   import { Form } from '@formknit/react'
   import '@formknit/react/styles.css'
   import { shadcnAdapter } from '@/components/formknit'

   <Form schema={schema} components={shadcnAdapter} />
   ```

Keep the stylesheet import: it provides the grid that lays fields out. Rating, date range,
address and signature fields use Formknit's built-in components, which follow the `--fx-*`
variables; set those to your theme's colours if you use them.

## Status

The adapter is tested against stand-ins that have the same props as the shadcn components. It
has not yet been run inside a real Tailwind and shadcn project, so check it in yours and report
anything that looks wrong.
