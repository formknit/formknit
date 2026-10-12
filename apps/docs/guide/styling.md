# Styling

Import the stylesheet once:

```ts
import '@formknit/react/styles.css'
```

## Options

| Prop on `<Form>` | Values | Class it adds |
|---|---|---|
| `size` | `sm`, `md` (default), `lg` | `fx-size-sm`, `fx-size-lg` |
| `variant` | `outlined` (default), `filled`, `underline` | `fx-variant-filled`, `fx-variant-underline` |
| `labelPosition` | `top` (default), `left` | `fx-labels-left` |
| `theme` | `light` (default), `dark`, `auto` | `fx-theme-dark`, `fx-theme-auto` |

```tsx
<Form schema={schema} size="lg" variant="filled" theme="auto" />
```

The same options can live in the schema, which is what the visual builder edits. Props win
over the schema:

```json
{ "version": 1, "appearance": { "size": "sm", "variant": "underline" }, "pages": [] }
```

## Widths and responsiveness

Every component sits on a 12-column grid. `width` is how many columns it takes:

```ts
text('firstName').width(6)   // half
text('lastName').width(6)    // half
text('city').width(4)        // a third
text('region').width(4)
text('postcode').width(4)
```

Fields flow left to right and wrap when a row is full. A component without a width takes the
whole row.

The grid responds to the **form's own width**, not the window's. Below about 480px every field
stacks full width, so a form placed in a narrow sidebar stacks even on a large screen. Buttons
stretch and step labels shorten at the same point.

## Theme variables

Override on `.fx-form` or any ancestor:

```css
.fx-form {
  --fx-primary: #0e9384;
  --fx-radius: 4px;
  --fx-gap: 20px;
  --fx-font: 'Inter', sans-serif;
}
```

| Variable | Default | Used for |
|---|---|---|
| `--fx-primary`, `--fx-on-primary` | `#4f46e5`, `#ffffff` | Buttons, focus rings, checked controls |
| `--fx-surface`, `--fx-subtle` | `#ffffff`, `#f5f6f8` | Input background; read-only and filled backgrounds |
| `--fx-border` | `#e2e5eb` | Borders and dividers |
| `--fx-text`, `--fx-muted` | `#151922`, `#667085` | Text; help text and placeholders |
| `--fx-danger` | `#d92d20` | Errors and the required mark |
| `--fx-radius` | `8px` | Corner rounding |
| `--fx-gap` | `16px` | Space between fields |
| `--fx-font`, `--fx-font-size` | inherited, `14px` | Typography |
| `--fx-control-height`, `--fx-pad-x`, `--fx-pad-y` | `38px`, `12px`, `8px` | Input size |

The size classes set the last five; override them after choosing a size if you need to.

## Helper classes

Add with `.className('...')` or the builder's "CSS classes" setting:

| Class | Effect |
|---|---|
| `fx-hide-label` | Hides the label visually. Screen readers still read it |
| `fx-stack-choices` | Lists radio or checkbox choices one per line |
| `fx-hide-narrow` | Hidden on narrow forms |
| `fx-show-narrow` | Shown only on narrow forms |
| `fx-align-end` | Pushes the component to the end of its row |

Your own classes work too; they are added to the component's wrapper, `.fx-cell`.

## Using another UI library

See [adapters](./adapters). Keep the stylesheet imported even then: it provides the grid.
