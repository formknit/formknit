# @formknit/builder

[[toc]]

The drag-and-drop form builder.

```bash
npm install @formknit/core @formknit/react @formknit/builder
```

```ts
import '@formknit/react/styles.css'
import '@formknit/builder/styles.css'
```

## Components

| Export | |
|---|---|
| `FormBuilder` | The builder. Props: `value`, `onChange`, `defaultValue`, `components`, `className`. See [embedding](/guide/builder) |
| `emptySchema()` | A new, empty one-page form |

## Extending

| Export | |
|---|---|
| `registerBuilderField(type, { icon?, defaults?, settings? })` | Palette icon, starting properties and settings for a field type. See [extending](/guide/builder-extending) |
| `BuilderField`, `Setting`, `SettingInput`, `SettingTab` | Their types |

`SettingInput`: `text`, `textarea`, `number`, `checkbox`, `select`, `options`, `expression`,
`rules`, `formula`, `columns`, `key`. `SettingTab`: `display`, `validation`, `logic`.

## Conditions

| Export | |
|---|---|
| `fromExpression(formula)` | A `RuleSet`, or `null` if the formula is too complex for rows |
| `toExpression(ruleSet, isNumeric?)` | A formula |
| `Rule` | `{ field, op, value }` |
| `RuleSet` | `{ mode: 'all' \| 'any', rules: (Rule \| RuleSet)[] }` |
| `Operator` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `empty`, `notEmpty`, `checked`, `unchecked` |

## CSS

`@formknit/builder/styles.css`. Classes start with `fxb-`. The builder uses the same colour
variables as forms (`--fx-primary` and friends), so theming forms themes the builder too.
