import type {
  ButtonProps, ColumnsProps, ContentProps, FieldProps, PanelProps, PartialAdapter, RepeaterProps, StepsProps,
} from '@formknit/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

const INPUT_TYPE: Record<string, string> = { email: 'email', phone: 'tel', date: 'date', time: 'time' }
/** Error first, then the help text, in the slot Material UI reserves under a control. */
const helper = (p: { error?: string; description?: string }) => p.error ?? p.description

function Input(p: FieldProps<string | number | null>) {
  const type = p.component.type
  const multiline = type === 'textarea'
  return (
    <TextField
      id={p.id}
      name={p.path}
      label={p.label}
      type={INPUT_TYPE[type] ?? 'text'}
      value={p.value ?? ''}
      placeholder={p.placeholder}
      required={p.required}
      disabled={p.disabled}
      error={!!p.error}
      helperText={helper(p)}
      multiline={multiline}
      minRows={multiline ? (typeof p.component.rows === 'number' ? p.component.rows : 4) : undefined}
      fullWidth
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
      slotProps={{
        // Date and time inputs always show a format hint, so the label must stay out of its way.
        inputLabel: type === 'date' || type === 'time' ? { shrink: true } : undefined,
        htmlInput: type === 'number' ? { inputMode: 'decimal' } : undefined,
      }}
    />
  )
}

function Select(p: FieldProps<string>) {
  return (
    <TextField
      select
      id={p.id}
      name={p.path}
      label={p.label}
      value={p.value ?? ''}
      required={p.required}
      disabled={p.disabled}
      error={!!p.error}
      helperText={helper(p)}
      fullWidth
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    >
      <MenuItem value="">
        <em>{p.placeholder ?? 'None'}</em>
      </MenuItem>
      {p.options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  )
}

function Calculated(p: FieldProps<unknown>) {
  return (
    <TextField
      id={p.id}
      label={p.label}
      value={p.value === null || p.value === undefined ? '' : String(p.value)}
      error={!!p.error}
      helperText={helper(p)}
      fullWidth
      variant="filled"
      slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
    />
  )
}

function RadioField(p: FieldProps<string>) {
  return (
    <FormControl error={!!p.error} required={p.required} disabled={p.disabled}>
      <FormLabel id={`${p.id}-label`}>{p.label}</FormLabel>
      <RadioGroup row aria-labelledby={`${p.id}-label`} name={p.id} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} onBlur={p.onBlur}>
        {p.options.map((o) => (
          <FormControlLabel key={o.value} value={o.value} control={<Radio />} label={o.label} />
        ))}
      </RadioGroup>
      <FormHelperText>{helper(p)}</FormHelperText>
    </FormControl>
  )
}

function CheckboxGroup(p: FieldProps<string[]>) {
  const value = Array.isArray(p.value) ? p.value : []
  return (
    <FormControl component="fieldset" error={!!p.error} required={p.required} disabled={p.disabled}>
      <FormLabel component="legend">{p.label}</FormLabel>
      <FormGroup row>
        {p.options.map((o) => (
          <FormControlLabel
            key={o.value}
            label={o.label}
            control={
              <Checkbox
                checked={value.includes(o.value)}
                onChange={(e) => p.onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
                onBlur={p.onBlur}
              />
            }
          />
        ))}
      </FormGroup>
      <FormHelperText>{helper(p)}</FormHelperText>
    </FormControl>
  )
}

function Toggle(p: FieldProps<boolean>) {
  const Control = p.component.type === 'toggle' ? Switch : Checkbox
  return (
    <FormControl error={!!p.error} required={p.required} disabled={p.disabled}>
      <FormControlLabel
        label={p.label}
        required={p.required}
        control={<Control id={p.id} checked={p.value === true} onChange={(e) => p.onChange(e.target.checked)} onBlur={p.onBlur} />}
      />
      <FormHelperText>{helper(p)}</FormHelperText>
    </FormControl>
  )
}

function FileField(p: FieldProps<unknown>) {
  const name = p.value && typeof p.value === 'object' && 'name' in p.value ? String(p.value.name) : ''
  return (
    <FormControl error={!!p.error} required={p.required} disabled={p.disabled}>
      <FormLabel htmlFor={p.id}>{p.label}</FormLabel>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.5 }}>
        <Button component="label" variant="outlined" disabled={p.disabled}>
          Choose file
          <input id={p.id} type="file" hidden onChange={(e) => p.onChange(e.target.files?.[0] ?? null)} onBlur={p.onBlur} />
        </Button>
        <Typography variant="body2" color="text.secondary">
          {name || 'No file chosen'}
        </Typography>
      </Stack>
      <FormHelperText>{helper(p)}</FormHelperText>
    </FormControl>
  )
}

const Hidden = () => null

function Panel({ component, children }: PanelProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {component.label && (
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
          {component.label}
        </Typography>
      )}
      <Stack spacing={2}>{children}</Stack>
    </Paper>
  )
}

function Columns({ columns }: ColumnsProps) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      {columns.map((col, i) => (
        <Stack key={i} spacing={2} sx={{ flex: col.width, minWidth: 0 }}>
          {col.children}
        </Stack>
      ))}
    </Stack>
  )
}

function Content({ component }: ContentProps) {
  return component.heading ? (
    <Typography variant="h6">{component.content}</Typography>
  ) : (
    <Typography color="text.secondary">{component.content}</Typography>
  )
}

function Repeater(p: RepeaterProps) {
  return (
    <FormControl component="fieldset" error={!!p.error} required={p.required} fullWidth>
      {p.label && <FormLabel component="legend">{p.label}</FormLabel>}
      {p.description && <FormHelperText sx={{ mx: 0 }}>{p.description}</FormHelperText>}
      <Stack spacing={1.5} sx={{ mt: 1 }}>
        {p.rows.map((row) => (
          <Stack key={row.index} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Stack direction={p.component.compact === true ? { xs: 'column', sm: 'row' } : 'column'} spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
              {row.children}
            </Stack>
            {!p.disabled && (
              <Stack direction="row">
                {row.moveUp && (
                  <IconButton size="small" onClick={row.moveUp} aria-label={`${p.labels.moveUp} (${row.index + 1})`}>
                    ↑
                  </IconButton>
                )}
                {row.moveDown && (
                  <IconButton size="small" onClick={row.moveDown} aria-label={`${p.labels.moveDown} (${row.index + 1})`}>
                    ↓
                  </IconButton>
                )}
                <IconButton size="small" onClick={row.remove} aria-label={`${p.labels.remove} (${row.index + 1})`}>
                  ×
                </IconButton>
              </Stack>
            )}
          </Stack>
        ))}
        {p.add && (
          <Box>
            <Button variant="outlined" size="small" onClick={p.add}>
              + {p.labels.add}
            </Button>
          </Box>
        )}
      </Stack>
      {p.error && <FormHelperText sx={{ mx: 0 }}>{p.error}</FormHelperText>}
    </FormControl>
  )
}

function FormButton({ type, variant, disabled, onClick, children }: ButtonProps) {
  return (
    <Button type={type} variant={variant === 'primary' ? 'contained' : 'outlined'} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  )
}

function Steps({ pages, step }: StepsProps) {
  return (
    <Stepper activeStep={step} alternativeLabel>
      {pages.map((page) => (
        <Step key={page.key}>
          <StepLabel>{page.title ?? page.key}</StepLabel>
        </Step>
      ))}
    </Stepper>
  )
}

/**
 * Renders Formknit forms with Material UI: `<Form schema={schema} components={muiAdapter} />`.
 * It follows your MUI theme. To change one field, spread it: `{ ...muiAdapter, fields: { ...muiAdapter.fields, date: MyDatePicker } }`.
 */
export const muiAdapter = {
  fields: {
    text: Input,
    textarea: Input,
    email: Input,
    phone: Input,
    number: Input,
    date: Input,
    time: Input,
    select: Select,
    radio: RadioField,
    checkboxGroup: CheckboxGroup,
    checkbox: Toggle,
    toggle: Toggle,
    calculated: Calculated,
    file: FileField,
    hidden: Hidden,
  },
  layout: { panel: Panel, columns: Columns, content: Content, divider: () => <Divider />, repeater: Repeater },
  ui: { Button: FormButton, Steps },
} satisfies PartialAdapter
