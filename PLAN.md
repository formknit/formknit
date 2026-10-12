# Formknit — project plan

Working name: **Formknit** (placeholder; formknit.com is taken, so this will
change; see section 14).
Last updated: 12 October 2026.

## 1. What we are building

An open-source React library that lets developers stop hand-coding forms.
A form is described once as data (the *schema*), and the library renders it,
validates it, runs its formulas, and offers a drag-and-drop builder that
produces the same schema.

**First audience: developers.** They install the packages into their own app
and keep their own backend, database and UI library.

**Later: a hosted platform** (accounts, saved forms, submissions, approvals,
integrations) built on top of the library. It is out of scope until the
library reaches 1.0, but the library must not block it (see section 11).

### What a developer can do with it

1. Describe a form in code (Filament-style) or as JSON.
2. Render it with one component, in their own UI library.
3. Validate the submission on the server with the same rules.
4. Embed the visual builder so their own users can design forms.
5. Add custom field types that also appear in the builder.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Language | TypeScript everywhere |
| UI framework | React first. Core logic has no React or DOM code |
| Styling | Headless logic + swappable UI adapters. Default skin uses CSS variables |
| Adapters at launch | Default skin and shadcn/ui. MUI next. Ant Design and Chakra by demand |
| Formulas | Our own Excel-style expression language, parsed safely, never `eval` |
| Server validation | Same core package runs in Node/Bun, so rules are never written twice |
| Data shape | Nested (repeating groups produce arrays of objects) |
| Multi-step | Every form has pages; a single-page form has one |
| Repo | pnpm monorepo, Vite library builds, Vitest, Playwright |
| Platform stack (later) | Hono, PostgreSQL + Drizzle, React + Vite, Redis + BullMQ |
| Licence | MIT (proposed) |
| Design source | Figma file "Formknit – Form Builder UI" (36 screens + Components page) |

## 3. Packages

```
packages/
  core/          schema types, expression engine, validation, visibility,
                 calculation, data cleaning. No dependencies. Runs anywhere.
  react/         <Form>, useForm (headless), field registry, default skin
  builder/       <FormBuilder>: palette, canvas, settings panel, JSON view
  adapter-shadcn/  copy-in components for shadcn/ui projects
  adapter-mui/     MUI adapter (after 1.0 beta)
  cli/           schema -> TypeScript types, schema lint (after 1.0)
apps/
  docs/          documentation site with live playground
  playground/    local dev app used for manual and Playwright testing
```

Dependency rule: `core` depends on nothing. `react` depends on `core`.
`builder` depends on `react`. Adapters depend on `react` and their UI library.

## 4. The schema

One JSON document describes a form. Version field included from day one so
old schemas can be migrated.

```json
{
  "version": 1,
  "title": "Fee invoice",
  "pages": [
    {
      "key": "main",
      "title": "Details",
      "components": [
        { "type": "text", "key": "rollNumber", "label": "Roll number",
          "validate": { "required": true } },
        { "type": "select", "key": "country", "label": "Country",
          "options": [{ "label": "Nepal", "value": "NP" }] },
        { "type": "text", "key": "district", "label": "District",
          "visibleWhen": "country == \"NP\"" },
        { "type": "repeater", "key": "items", "label": "Items",
          "components": [
            { "type": "text", "key": "name" },
            { "type": "number", "key": "qty", "validate": { "min": 1 } },
            { "type": "number", "key": "rate" },
            { "type": "calculated", "key": "amount", "expression": "qty * rate" }
          ] },
        { "type": "calculated", "key": "total",
          "expression": "SUM(items.amount)" }
      ]
    }
  ]
}
```

Rules:

- `key` is unique within its scope and is the property name in the data.
- Layout components (panel, columns) do not nest the data; repeaters do.
- Anything conditional is an expression string: `visibleWhen`,
  `requiredWhen`, `disabledWhen`, `expression`, custom validation rules.
- Hidden fields are excluded from validation and from the cleaned data.
- Unknown component types render a visible "unknown field" placeholder
  instead of crashing.

## 5. The expression language

One small language for calculations, conditions and validation.

- **Syntax:** numbers, strings, booleans, field references (`price`,
  `items.amount`), arithmetic (`+ - * / %`), comparison (`== != > >= < <=`),
  logic (`AND OR NOT`), parentheses, function calls.
- **Functions in v1:** `SUM AVG MIN MAX COUNT ROUND ABS IF AND OR NOT
  CONCAT LEN UPPER LOWER TODAY DATEDIF ISEMPTY`.
- **Functions reserved for data sources:** `LOOKUP SUMIF COUNTIF`
  (async; resolved through a developer-supplied data source, section 11).
- **Scope:** inside a repeater row, bare names refer to that row first,
  then the parent form.
- **Safety:** hand-written parser producing a syntax tree; an evaluator that
  only knows the functions above. No access to globals. Limits on
  expression length, nesting depth and evaluation steps.
- **Dependencies:** each expression's referenced fields are extracted at
  load time to build a dependency graph. A change recalculates only the
  affected fields, in order. Circular references are reported as schema
  errors.
- **Errors:** division by zero, wrong types and missing fields produce a
  defined error value shown on the field, never an exception.
- **Extensible:** developers can register their own functions.

## 6. Public API (target)

### Code-first definition

```ts
import { form, text, email, select, repeater, number, calculated } from "formknit"

export const invoice = form("Fee invoice", [
  text("rollNumber").label("Roll number").required(),
  select("country").options({ NP: "Nepal", IN: "India" }),
  text("district").visibleWhen('country == "NP"'),
  repeater("items", [
    text("name"),
    number("qty").min(1),
    number("rate"),
    calculated("amount", "qty * rate"),
  ]),
  calculated("total", "SUM(items.amount)"),
])

type InvoiceData = InferData<typeof invoice>   // fully typed
```

The builders return plain schema JSON, so code-defined and builder-defined
forms are interchangeable.

### Rendering

```tsx
<Form schema={invoice} components={shadcnAdapter}
      defaultValues={draft} onSubmit={(data) => save(data)} />
```

### Headless

```tsx
const f = useForm(invoice)
// f.values, f.errors, f.field("email"), f.pages, f.next(), f.submit()
```

### Server

```ts
import { validate } from "formknit/core"
const result = validate(invoice, await c.req.json())
if (!result.valid) return c.json(result.errors, 422)
save(result.data)        // cleaned, with formulas recalculated
```

### Builder

```tsx
<FormBuilder value={schema} onChange={setSchema}
             components={shadcnAdapter} fields={[...defaults, ratingField]} />
```

### Custom field

```ts
defineField({
  type: "rating",
  label: "Rating",
  icon: StarIcon,
  defaults: { max: 5 },
  settings: [{ path: "max", label: "Maximum", input: "number" }],
  validate: (value, c) => value > c.max ? "Too high" : null,
  component: RatingInput,
})
```

## 7. Field types for 1.0

| Group | Fields |
|---|---|
| Basic | text, textarea, email, number, date, time, phone, hidden |
| Choice | select, radio, checkbox, checkbox group, toggle |
| Data | calculated, lookup (needs a data source), file upload (needs an upload handler) |
| Layout | panel, columns, heading/text, divider |
| Structure | repeater, page (wizard step) |

After 1.0: signature, rating, slider, rich text, address, date range,
multi-select with search, Bikram Sambat date.

## 8. Milestones

Durations are rough estimates for one developer working full time. They are
guesses, not commitments, and the builder milestone is the least certain.

### M0 — Project setup (about 1 week)
- Monorepo, TypeScript config, lint, format, Vitest, Playwright, CI.
- Package build producing ESM, CJS and type declarations.
- Changesets for versioning; MIT licence; contributing guide.
- **Done when:** an empty `core` package publishes to npm under a `next` tag
  from CI.

### M1 — Core: schema and validation (about 2 weeks)
- Schema types and a schema validator (catches bad schemas early).
- Field definitions registry.
- Value validation: required, length, range, pattern, option membership.
- Data cleaning: drop unknown keys, coerce numbers, apply defaults.
- **Done when:** `validate(schema, data)` passes a test suite covering every
  1.0 field type, with no React or DOM in the package.

### M2 — Expression engine (about 2–3 weeks)
- Tokenizer, parser, evaluator, function library.
- Dependency graph, ordered recalculation, cycle detection.
- `visibleWhen`, `requiredWhen`, `disabledWhen`, calculated fields.
- Error values and limits.
- **Done when:** a spec file of several hundred expression cases passes, and
  a 200-field form recalculates one change in under 5 ms in a benchmark.

### M3 — React renderer (about 3 weeks)
- Form store with per-field subscriptions, so typing in one field does not
  re-render the others.
- `<Form>`, `useForm`, component registry, default skin with CSS variables.
- Error display, touched state, focus on first error, async submit state.
- Accessibility: labels, descriptions, error announcements, keyboard use.
- **Done when:** every 1.0 basic, choice and layout field renders in the
  playground, passes automated accessibility checks, and matches Figma
  screens 02 and 07.

### M4 — Structure (about 2–3 weeks)
- Repeater with add, remove, reorder and row-scoped expressions.
- Pages: wizard navigation, per-page validation, progress, skip rules.
- File upload field with a developer-supplied upload handler.
- Draft save/restore hooks (`onChange` snapshot, `defaultValues`).
- Code-first builders with type inference (`InferData`).
- **Done when:** the fee invoice and three-step admission examples from the
  Figma file (screens 25 and 30) work end to end, typed.

### M5 — Visual builder (about 4–5 weeks)
- Palette, canvas, settings panel, matching Figma screens 01 and 09–12.
- Drag to add, reorder and nest; keyboard alternative for every action.
- Settings generated from each field definition; options editor.
- Formula editor with field and function autocomplete and live errors.
- Logic rule builder (AND/OR groups) that writes expressions.
- Page management for wizards.
- Undo/redo, preview tab, JSON tab with import and export.
- Custom fields appear in the palette automatically.
- **Done when:** every schema feature from M1–M4 can be created in the
  builder without editing JSON, and Playwright covers the drag-and-drop
  paths.

### M6 — Adapters (about 2 weeks)
- shadcn/ui adapter, distributed copy-in style.
- Adapter authoring guide and a test kit adapters can run.
- MUI adapter.
- **Done when:** the same schema renders correctly under default, shadcn
  and MUI in the playground.

### M7 — Documentation and 1.0 beta (about 2 weeks)
- Docs site: getting started, schema reference, expression reference,
  adapter guide, custom field guide, server validation guide.
- Live playground embedded in the docs.
- Example apps: Vite + React, Next.js, Hono API.
- Bundle size report and performance benchmarks in CI.
- **Done when:** a developer who has never seen the project can render a
  validated form in under ten minutes following the docs.

**Rough total:** 18–21 weeks to a 1.0 beta.

### Suggested release points
- **0.1** after M3: code-defined forms that render and validate.
- **0.2** after M4: repeaters, wizards, formulas in real use.
- **0.5** after M5: visual builder.
- **1.0 beta** after M7.

## 9. Quality

- **Unit tests** (Vitest) for all of `core`; the expression engine is
  specified by a shared table of input/output cases.
- **Component tests** for `react` with Testing Library.
- **Browser tests** (Playwright) for the builder and wizard flows.
- **Accessibility:** automated axe checks in CI plus manual keyboard and
  screen reader passes before each minor release. Target WCAG 2.1 AA.
- **Performance budgets** checked in CI: `core` under roughly 15 kB
  gzipped, `react` under roughly 20 kB; these numbers are targets to
  confirm once real code exists.
- **Compatibility:** React 18 and 19; current browsers; Node 20+ and Bun
  for `core`.

## 10. Open-source practice

- MIT licence, semantic versioning, changelog generated by Changesets.
- Public roadmap and issue templates; "good first issue" labels on adapter
  and field work, which are the easiest places for contributors to start.
- Schema `version` field with migration functions, so upgrades never break
  stored forms.
- No telemetry in the library.

## 11. What the library must leave room for

The platform comes later, but these extension points go in now so nothing
has to be redesigned:

| Need | Extension point in the library |
|---|---|
| Cross-form lookups and SUMIF | `dataSources` option: the developer supplies an async resolver; the platform will supply its own |
| File storage | `onUpload` handler returning a file reference |
| Draft save and resume | `onChange` snapshots and `defaultValues` |
| Translations | All built-in messages go through one message table that can be replaced |
| Submission versions | Schema `version` plus a stable hash of the schema |
| Themes | CSS variables matching the Figma tokens |
| Payments, approvals, PDFs | Not in the library; platform features |

## 12. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Builder takes longer than estimated | Delays 0.5 | Ship 0.1 and 0.2 first so the library is useful without it |
| Expression language grows without limit | Maintenance burden | Fixed function list for 1.0; custom functions cover the rest |
| Adapter maintenance | Breaks when UI libraries release majors | Maintain two ourselves; test kit for community adapters |
| Type inference becomes too complex | Slow editors, confusing errors | Keep inference to the code-first builders; JSON schemas use the CLI |
| Scope creep toward the platform | Library never reaches 1.0 | Platform work starts only after 1.0 beta |
| Name conflict on npm | Rename late | Check and reserve the name during M0 |

## 13. Open decisions

1. **Name.** Choose from the shortlist in section 14, then reserve the
   domain, npm scope and GitHub organisation on the same day.
2. **Drag-and-drop.** Use an existing library (dnd-kit) in the builder
   package or write our own. Recommendation: dnd-kit, builder package only.
3. **Date handling.** Native date inputs for 1.0, with a slot for adapters'
   own date pickers. Recommendation: yes.
4. **Translations at 1.0.** English only with a replaceable message table,
   or ship Nepali as well. Recommendation: English plus the mechanism.
5. **First real user.** Which of your projects adopts 0.1 first? Using it in
   a real project early is the best test of the API.

## 14. Naming and renaming

"Formknit" is a placeholder: formknit.com has been registered since 2008.
The project is set up so that a rename takes a few minutes.

### Rules that keep a rename cheap

1. **The brand appears only in** package names (the npm scope), the README
   and docs, the licence, the root `package.json` and the Figma file title.
2. **The brand never appears in** the schema format, exported function or
   type names, CSS class or variable names, error codes, storage keys or
   folder names. A stored form or a developer's code must not need to
   change when the name does.
3. **CSS uses a neutral prefix**, `fx-` for classes and `--fx-` for
   variables, not one derived from the brand.
4. **Nothing is published to npm until the name is final.** Before the first
   publish a rename is free; after it, the old packages have to be
   deprecated and republished under the new scope.
5. **Imports go through the scope only** (`@name/core`, `@name/react`), so
   a developer's migration is a find-and-replace of one string.

### How to rename

```bash
node scripts/rename.mjs newname --dry   # list what would change
node scripts/rename.mjs newname         # apply
pnpm install && pnpm test && pnpm build
```

Then rename the project folder, the git remote and the Figma file by hand.

### If a rename is needed after publishing

1. Publish the same version under the new scope.
2. Mark every old package as deprecated on npm with a message naming the
   replacement.
3. Keep the old GitHub repository name redirecting (GitHub does this
   automatically on rename).
4. Announce it in the changelog with the one-line import change.

### Shortlist (checked 12 October 2026)

All of these had no .com registration, no npm package or scope, and no
GitHub account of that name when checked. Availability can change at any
time, and none of them has been checked for trademarks.

| Name | Why |
|---|---|
| **formknit** | Short, easy to say and spell; "knit fields into a form" keeps the weaving idea |
| tanaform | "Tana" is the warp thread on a loom in Nepali and Hindi |
| faramkit | "Faram" is how "form" is said in Nepali; "kit" says it is a toolkit |
| formlyn | Short and brandable, no particular meaning |
| weftform | Weft is the cross thread on a loom; harder to say |
| formlathe | A lathe shapes things; longer |

