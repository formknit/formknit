# @formknit/adapter-mui

Renders [Formknit](https://github.com/formknit/formknit) forms with Material UI components, using
your MUI theme.

```bash
npm install @formknit/core @formknit/react @formknit/adapter-mui @mui/material @emotion/react @emotion/styled
```

```tsx
import { muiAdapter } from '@formknit/adapter-mui'
import { Form } from '@formknit/react'
import '@formknit/react/styles.css'   // layout only; the controls are styled by MUI

<Form schema={schema} components={muiAdapter} onSubmit={save} />
```

Pass the same adapter to `<FormBuilder components={muiAdapter}>` so previews match.

Needs MUI 6 or newer. Field types MUI has no component for (signature, address, date range)
use Formknit's built-in ones.

MIT licence.
