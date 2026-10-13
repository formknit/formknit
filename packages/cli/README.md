# @formknit/cli

Command-line tools for [Formknit](https://github.com/formknit/formknit) form schemas stored as
JSON files.

```bash
npm install --save-dev @formknit/cli
```

```bash
npx formknit check forms/admission.json            # report problems; exits with 1 if any are errors
npx formknit types forms/admission.json            # print a TypeScript type for the form's data
npx formknit types forms/admission.json -o src/admission.d.ts
```

`check` finds duplicate keys, formulas that do not parse, references to fields that do not
exist and circular formulas. Run it in CI to stop a broken form from being deployed.

MIT licence.
