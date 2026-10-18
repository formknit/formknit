# Release notes

[[toc]]

## Versioning

All Formknit packages share one version number and are always released together, so any
`@formknit/*` packages with the same version work with each other.

Formknit follows [semantic versioning](https://semver.org). While the version is below 1.0, a
**minor** release (0.1 → 0.2) may contain breaking changes, and a **patch** release (0.1.0 →
0.1.1) never does. Breaking changes are listed below with what to do about them.

The full changelog of each package is in its `CHANGELOG.md` on
[GitHub](https://github.com/formknit/formknit) and on npm.

## 0.1.1

Released from GitHub Actions with npm trusted publishing, so every package now carries a
provenance statement that links it to the exact source commit. No code changes.

## 0.1.0

The first public release.

- **Core**: schemas, code-first builders with inferred data types, 28 component types, the formula
  language with 28 functions, validation with custom rules, `validate` and `validateAsync` for
  servers, lookups, and English and Nepali messages.
- **React**: `<Form>`, `useForm`, `useFormState`, `useField`, multi-page forms, repeating
  groups, drafts, uploads, a themeable responsive skin with sizes, variants and dark mode.
- **Builder**: palette, canvas with drag and drop, settings generated per field type, rule
  builder, formula editor, pages, undo and redo, preview and JSON views.
- **Rich text**: the `richText` field and `@formknit/richtext` editor built on Tiptap.
- **Adapters**: Material UI and shadcn/ui.
- **CLI**: `formknit check` and `formknit types`.
