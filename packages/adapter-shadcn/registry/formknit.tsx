/**
 * Formknit adapter for shadcn/ui.
 *
 * Copy this file into your project (for example `components/formknit.tsx`), then:
 *
 *   import { shadcnAdapter } from '@/components/formknit'
 *   <Form schema={schema} components={shadcnAdapter} />
 *
 * It needs these shadcn components: button, checkbox, input, label, radio-group, select,
 * slider, switch, textarea. Add any you are missing with `npx shadcn@latest add <name>`.
 * Keep importing `@formknit/react/styles.css`: it provides the grid that lays fields out.
 *
 * The file is yours to edit. Field types it does not define (rating, date range, address,
 * signature) use Formknit's built-in components.
 */
import type { ButtonProps, FieldProps, PanelProps, PartialAdapter, RepeaterProps } from '@formknit/react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const describedBy = (p: FieldProps<any>) => [p.description && `${p.id}-desc`, p.error && `${p.id}-err`].filter(Boolean).join(' ') || undefined

function Shell({ p, label = true, children }: { p: FieldProps<any>; label?: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      {label && p.label && (
        <Label htmlFor={p.id}>
          {p.label}
          {p.required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      {children}
      {p.description && (
        <p id={`${p.id}-desc`} className="text-sm text-muted-foreground">
          {p.description}
        </p>
      )}
      {p.error && (
        <p id={`${p.id}-err`} className="text-sm text-destructive" role="alert">
          {p.error}
        </p>
      )}
    </div>
  )
}

const INPUT_TYPE: Record<string, string> = { email: 'email', phone: 'tel', date: 'date', time: 'time', url: 'url' }

function TextField(p: FieldProps<string | number | null>) {
  return (
    <Shell p={p}>
      <Input
        id={p.id}
        name={p.path}
        type={INPUT_TYPE[p.component.type] ?? 'text'}
        inputMode={p.component.type === 'number' ? 'decimal' : undefined}
        value={p.value ?? ''}
        placeholder={p.placeholder}
        disabled={p.disabled}
        required={p.required}
        aria-invalid={!!p.error}
        aria-describedby={describedBy(p)}
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
      />
    </Shell>
  )
}

function TextareaField(p: FieldProps<string>) {
  return (
    <Shell p={p}>
      <Textarea
        id={p.id}
        name={p.path}
        rows={typeof p.component.rows === 'number' ? p.component.rows : 4}
        value={p.value ?? ''}
        placeholder={p.placeholder}
        disabled={p.disabled}
        required={p.required}
        aria-invalid={!!p.error}
        aria-describedby={describedBy(p)}
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
      />
    </Shell>
  )
}

function ReadOnlyField(p: FieldProps<unknown>) {
  const text = p.value === null || p.value === undefined ? '' : Array.isArray(p.value) ? p.value.join(', ') : String(p.value)
  return (
    <Shell p={p}>
      <Input id={p.id} value={text} readOnly aria-busy={p.loading || undefined} aria-describedby={describedBy(p)} className="bg-muted" />
    </Shell>
  )
}

function SelectField(p: FieldProps<string>) {
  return (
    <Shell p={p}>
      <Select value={p.value || undefined} onValueChange={p.onChange} disabled={p.disabled}>
        <SelectTrigger id={p.id} className="w-full" aria-invalid={!!p.error} aria-describedby={describedBy(p)} onBlur={p.onBlur}>
          <SelectValue placeholder={p.placeholder ?? 'Select…'} />
        </SelectTrigger>
        <SelectContent>
          {p.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Shell>
  )
}

function RadioField(p: FieldProps<string>) {
  return (
    <Shell p={p} label={false}>
      <Label id={`${p.id}-label`}>
        {p.label}
        {p.required && <span className="text-destructive"> *</span>}
      </Label>
      <RadioGroup value={p.value ?? ''} onValueChange={p.onChange} disabled={p.disabled} aria-labelledby={`${p.id}-label`} aria-describedby={describedBy(p)} onBlur={p.onBlur}>
        {p.options.map((o) => (
          <div key={o.value} className="flex items-center gap-2">
            <RadioGroupItem value={o.value} id={`${p.id}-${o.value}`} />
            <Label htmlFor={`${p.id}-${o.value}`} className="font-normal">
              {o.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </Shell>
  )
}

function CheckboxGroupField(p: FieldProps<string[]>) {
  const value = Array.isArray(p.value) ? p.value : []
  return (
    <Shell p={p} label={false}>
      <Label id={`${p.id}-label`}>
        {p.label}
        {p.required && <span className="text-destructive"> *</span>}
      </Label>
      <div role="group" aria-labelledby={`${p.id}-label`} aria-describedby={describedBy(p)} className="grid gap-2">
        {p.options.map((o) => (
          <div key={o.value} className="flex items-center gap-2">
            <Checkbox
              id={`${p.id}-${o.value}`}
              checked={value.includes(o.value)}
              disabled={p.disabled}
              onCheckedChange={(checked) => p.onChange(checked === true ? [...value, o.value] : value.filter((v) => v !== o.value))}
              onBlur={p.onBlur}
            />
            <Label htmlFor={`${p.id}-${o.value}`} className="font-normal">
              {o.label}
            </Label>
          </div>
        ))}
      </div>
    </Shell>
  )
}

function ToggleField(p: FieldProps<boolean>) {
  const Control = p.component.type === 'toggle' ? Switch : Checkbox
  return (
    <Shell p={p} label={false}>
      <div className="flex items-center gap-2">
        <Control
          id={p.id}
          checked={p.value === true}
          disabled={p.disabled}
          aria-invalid={!!p.error}
          aria-describedby={describedBy(p)}
          onCheckedChange={(checked) => p.onChange(checked === true)}
          onBlur={p.onBlur}
        />
        <Label htmlFor={p.id} className="font-normal">
          {p.label}
          {p.required && <span className="text-destructive"> *</span>}
        </Label>
      </div>
    </Shell>
  )
}

function SliderField(p: FieldProps<number | null>) {
  const min = typeof p.component.validate?.min === 'number' ? p.component.validate.min : 0
  const max = typeof p.component.validate?.max === 'number' ? p.component.validate.max : 100
  return (
    <Shell p={p}>
      <div className="flex items-center gap-3">
        <Slider
          id={p.id}
          value={[typeof p.value === 'number' ? p.value : min]}
          min={min}
          max={max}
          step={typeof p.component.step === 'number' ? p.component.step : 1}
          disabled={p.disabled}
          aria-describedby={describedBy(p)}
          onValueChange={([value]) => p.onChange(value)}
          onBlur={p.onBlur}
        />
        <span className="w-10 text-right text-sm tabular-nums">{typeof p.value === 'number' ? p.value : '–'}</span>
      </div>
    </Shell>
  )
}

function FileField(p: FieldProps<unknown>) {
  const name = p.value && typeof p.value === 'object' && 'name' in p.value ? String(p.value.name) : ''
  return (
    <Shell p={p}>
      {name ? (
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
          {!p.disabled && (
            <Button type="button" variant="outline" size="sm" onClick={() => p.onChange(null)}>
              Remove
            </Button>
          )}
        </div>
      ) : (
        <Input
          id={p.id}
          type="file"
          accept={p.component.accept}
          disabled={p.disabled || p.loading}
          aria-invalid={!!p.error}
          aria-busy={p.loading || undefined}
          aria-describedby={describedBy(p)}
          onChange={(e) => p.onChange(e.target.files?.[0] ?? null)}
          onBlur={p.onBlur}
        />
      )}
    </Shell>
  )
}

function Panel({ component, children }: PanelProps) {
  return (
    <section className="rounded-lg border p-4">
      {component.label && <h3 className="mb-3 font-semibold">{component.label}</h3>}
      <div className="fx-stack">{children}</div>
    </section>
  )
}

function Repeater(p: RepeaterProps) {
  return (
    <div className="grid gap-3">
      {p.label && (
        <Label>
          {p.label}
          {p.required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
      {p.rows.map((row) => (
        <div key={row.index} className={p.component.compact === true ? 'flex items-end gap-2' : 'flex items-start gap-2 rounded-lg border p-3'}>
          <div className={p.component.compact === true ? 'fx-stack fx-compact-row min-w-0 flex-1' : 'fx-stack min-w-0 flex-1'}>{row.children}</div>
          {!p.disabled && (
            <div className="flex gap-1">
              {row.moveUp && (
                <Button type="button" variant="ghost" size="icon" onClick={row.moveUp} aria-label={`${p.labels.moveUp} (${row.index + 1})`}>
                  ↑
                </Button>
              )}
              {row.moveDown && (
                <Button type="button" variant="ghost" size="icon" onClick={row.moveDown} aria-label={`${p.labels.moveDown} (${row.index + 1})`}>
                  ↓
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" onClick={row.remove} aria-label={`${p.labels.remove} (${row.index + 1})`}>
                ×
              </Button>
            </div>
          )}
        </div>
      ))}
      {p.add && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={p.add}>
            + {p.labels.add}
          </Button>
        </div>
      )}
      {p.error && (
        <p className="text-sm text-destructive" role="alert">
          {p.error}
        </p>
      )}
    </div>
  )
}

function FormButton({ type, variant, disabled, onClick, children }: ButtonProps) {
  return (
    <Button type={type} variant={variant === 'primary' ? 'default' : 'outline'} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  )
}

export const shadcnAdapter = {
  fields: {
    text: TextField,
    email: TextField,
    phone: TextField,
    number: TextField,
    url: TextField,
    date: TextField,
    time: TextField,
    textarea: TextareaField,
    select: SelectField,
    radio: RadioField,
    checkboxGroup: CheckboxGroupField,
    checkbox: ToggleField,
    toggle: ToggleField,
    slider: SliderField,
    calculated: ReadOnlyField,
    lookup: ReadOnlyField,
    file: FileField,
  },
  layout: { panel: Panel, repeater: Repeater },
  ui: { Button: FormButton },
} satisfies PartialAdapter
