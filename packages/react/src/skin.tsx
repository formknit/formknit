import type { ReactNode } from 'react'
import type {
  Adapter, ButtonProps, ColumnsProps, ContentProps, FieldProps, PanelProps, RepeaterProps, StepsProps,
} from './types'

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')
const describedBy = (p: { id: string; description?: string; error?: string }) =>
  cx(p.description && `${p.id}-desc`, p.error && `${p.id}-err`) || undefined

interface ShellProps {
  props: FieldProps<any>
  /** Groups (radio, checkbox list) are labelled by a legend instead of a label. */
  group?: boolean
  /** The control draws its own label, e.g. a single checkbox. */
  ownLabel?: boolean
  children: ReactNode
}

/** Label, description and error around a control. */
function Shell({ props: p, group, ownLabel, children }: ShellProps) {
  const star = p.required && (
    <span className="fx-required" aria-hidden="true">
      {' '}
      *
    </span>
  )
  const label =
    !ownLabel &&
    p.label &&
    (group ? (
      <legend className="fx-label">
        {p.label}
        {star}
      </legend>
    ) : (
      <label className="fx-label" htmlFor={p.id}>
        {p.label}
        {star}
      </label>
    ))
  const body = (
    <>
      {label}
      {children}
      {p.description && (
        <div className="fx-description" id={`${p.id}-desc`}>
          {p.description}
        </div>
      )}
      <div className="fx-error" id={`${p.id}-err`} aria-live="polite">
        {p.error}
      </div>
    </>
  )
  const className = cx('fx-field', `fx-field-${p.component.type}`, p.error && 'fx-invalid')
  return group ? <fieldset className={className}>{body}</fieldset> : <div className={className}>{body}</div>
}

const INPUT_TYPE: Record<string, string> = { email: 'email', phone: 'tel', date: 'date', time: 'time', url: 'url' }

function Input(p: FieldProps<string | number | null>) {
  const numeric = p.component.type === 'number'
  return (
    <Shell props={p}>
      <input
        className="fx-input"
        id={p.id}
        name={p.path}
        type={INPUT_TYPE[p.component.type] ?? 'text'}
        inputMode={numeric ? 'decimal' : undefined}
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

function Textarea(p: FieldProps<string>) {
  return (
    <Shell props={p}>
      <textarea
        className="fx-input fx-textarea"
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

function Select(p: FieldProps<string>) {
  return (
    <Shell props={p}>
      <select
        className="fx-input fx-select"
        id={p.id}
        name={p.path}
        value={p.value ?? ''}
        disabled={p.disabled}
        required={p.required}
        aria-invalid={!!p.error}
        aria-describedby={describedBy(p)}
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
      >
        <option value="">{p.placeholder ?? 'Select…'}</option>
        {p.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  )
}

function Radio(p: FieldProps<string>) {
  return (
    <Shell props={p} group>
      <div className="fx-choices" role="radiogroup" aria-describedby={describedBy(p)} aria-invalid={!!p.error}>
        {p.options.map((o, i) => (
          <label className="fx-choice" key={o.value}>
            <input
              type="radio"
              id={i === 0 ? p.id : undefined}
              name={p.id}
              value={o.value}
              checked={p.value === o.value}
              disabled={p.disabled}
              onChange={() => p.onChange(o.value)}
              onBlur={p.onBlur}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </Shell>
  )
}

function CheckboxGroup(p: FieldProps<string[]>) {
  const value = Array.isArray(p.value) ? p.value : []
  return (
    <Shell props={p} group>
      <div className="fx-choices" aria-describedby={describedBy(p)}>
        {p.options.map((o, i) => (
          <label className="fx-choice" key={o.value}>
            <input
              type="checkbox"
              id={i === 0 ? p.id : undefined}
              name={p.path}
              value={o.value}
              checked={value.includes(o.value)}
              disabled={p.disabled}
              onChange={(e) => p.onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
              onBlur={p.onBlur}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </Shell>
  )
}

function Checkbox(p: FieldProps<boolean>) {
  return (
    <Shell props={p} ownLabel>
      <label className="fx-choice">
        <input
          type="checkbox"
          id={p.id}
          name={p.path}
          role={p.component.type === 'toggle' ? 'switch' : undefined}
          checked={p.value === true}
          disabled={p.disabled}
          required={p.required}
          aria-invalid={!!p.error}
          aria-describedby={describedBy(p)}
          onChange={(e) => p.onChange(e.target.checked)}
          onBlur={p.onBlur}
        />
        <span>
          {p.label}
          {p.required && (
            <span className="fx-required" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </span>
      </label>
    </Shell>
  )
}

function Calculated(p: FieldProps<unknown>) {
  const text = p.value === null || p.value === undefined ? '' : Array.isArray(p.value) ? p.value.join(', ') : String(p.value)
  return (
    <Shell props={p}>
      <output className={cx('fx-input fx-output', p.loading && 'fx-loading')} id={p.id} aria-describedby={describedBy(p)} aria-busy={p.loading || undefined}>
        {text || '\u00a0'}
      </output>
    </Shell>
  )
}

function Rating(p: FieldProps<number | string | null>) {
  const max = typeof p.component.max === 'number' ? p.component.max : 5
  const value = Number(p.value) || 0
  return (
    <Shell props={p} group>
      <div className="fx-rating" role="radiogroup" aria-describedby={describedBy(p)}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <label key={n} className={cx('fx-star', n <= value && 'fx-star-on')}>
            <input
              type="radio"
              className="fx-visually-hidden"
              id={n === 1 ? p.id : undefined}
              name={p.id}
              checked={value === n}
              disabled={p.disabled}
              aria-label={`${n} of ${max}`}
              // Clicking the current rating again clears it.
              onClick={() => value === n && p.onChange(null)}
              onChange={() => p.onChange(n)}
              onBlur={p.onBlur}
            />
            <span aria-hidden="true">★</span>
          </label>
        ))}
      </div>
    </Shell>
  )
}

function Slider(p: FieldProps<number | string | null>) {
  const min = typeof p.component.validate?.min === 'number' ? p.component.validate.min : 0
  const max = typeof p.component.validate?.max === 'number' ? p.component.validate.max : 100
  const shown = p.value === null || p.value === undefined || p.value === '' ? min : Number(p.value)
  return (
    <Shell props={p}>
      <div className="fx-slider">
        <input
          type="range"
          id={p.id}
          name={p.path}
          min={min}
          max={max}
          step={typeof p.component.step === 'number' ? p.component.step : 1}
          value={shown}
          disabled={p.disabled}
          aria-describedby={describedBy(p)}
          onChange={(e) => p.onChange(Number(e.target.value))}
          onBlur={p.onBlur}
        />
        <output className="fx-slider-value" htmlFor={p.id}>
          {p.value === null || p.value === undefined || p.value === '' ? '–' : String(p.value)}
        </output>
      </div>
    </Shell>
  )
}

const fileSize = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

function FileInput(p: FieldProps<unknown>) {
  const file = p.value && typeof p.value === 'object' ? (p.value as { name?: unknown; size?: unknown }) : null
  return (
    <Shell props={p}>
      {file ? (
        <div className="fx-input fx-file-chosen">
          <span className="fx-file-name">{String(file.name ?? 'File')}</span>
          {typeof file.size === 'number' && <span className="fx-description">{fileSize(file.size)}</span>}
          {!p.disabled && (
            <button type="button" className="fx-icon-button" aria-label={`Remove ${String(file.name ?? 'file')}`} onClick={() => p.onChange(null)}>
              ×
            </button>
          )}
        </div>
      ) : (
        <input
          className={cx('fx-input fx-file', p.loading && 'fx-loading')}
          id={p.id}
          name={p.path}
          type="file"
          accept={p.component.accept}
          disabled={p.disabled || p.loading}
          aria-invalid={!!p.error}
          aria-busy={p.loading || undefined}
          aria-describedby={describedBy(p)}
          // The Form turns the chosen File into a stored value (see `onUpload`).
          onChange={(e) => p.onChange(e.target.files?.[0] ?? null)}
          onBlur={p.onBlur}
        />
      )}
    </Shell>
  )
}

const Hidden = () => null

function Panel({ component, children }: PanelProps) {
  return (
    <fieldset className="fx-panel">
      {component.label && <legend className="fx-panel-title">{component.label}</legend>}
      <div className="fx-stack">{children}</div>
    </fieldset>
  )
}

function Columns({ columns }: ColumnsProps) {
  return (
    <div className="fx-columns">
      {columns.map((col, i) => (
        <div className="fx-column fx-stack" key={i} style={{ flexGrow: col.width }}>
          {col.children}
        </div>
      ))}
    </div>
  )
}

function Content({ component }: ContentProps) {
  return component.heading ? (
    <h3 className="fx-heading">{component.content}</h3>
  ) : (
    <p className="fx-text">{component.content}</p>
  )
}

const Divider = () => <hr className="fx-divider" />

function Repeater(p: RepeaterProps) {
  return (
    <fieldset className={cx('fx-field', 'fx-repeater', p.component.compact === true && 'fx-repeater-compact', p.error && 'fx-invalid')}>
      {p.label && (
        <legend className="fx-label">
          {p.label}
          {p.required && (
            <span className="fx-required" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </legend>
      )}
      {p.description && <div className="fx-description">{p.description}</div>}
      {p.rows.map((row) => (
        <div className={cx('fx-row', row.index === 0 && 'fx-row-first')} key={row.index}>
          <div className={cx('fx-row-fields fx-stack', p.component.compact === true && 'fx-compact-row')}>{row.children}</div>
          {!p.disabled && (
            <div className="fx-row-actions">
              {row.moveUp && (
                <button type="button" className="fx-icon-button" onClick={row.moveUp} aria-label={`${p.labels.moveUp} (${row.index + 1})`}>
                  ↑
                </button>
              )}
              {row.moveDown && (
                <button type="button" className="fx-icon-button" onClick={row.moveDown} aria-label={`${p.labels.moveDown} (${row.index + 1})`}>
                  ↓
                </button>
              )}
              <button type="button" className="fx-icon-button" onClick={row.remove} aria-label={`${p.labels.remove} (${row.index + 1})`}>
                ×
              </button>
            </div>
          )}
        </div>
      ))}
      {p.add && (
        <div>
          <Button type="button" variant="secondary" onClick={p.add}>
            + {p.labels.add}
          </Button>
        </div>
      )}
      <div className="fx-error" aria-live="polite">
        {p.error}
      </div>
    </fieldset>
  )
}

function Button({ type, variant, disabled, onClick, children }: ButtonProps) {
  return (
    <button type={type} className={cx('fx-button', `fx-button-${variant}`)} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

function Steps({ pages, step }: StepsProps) {
  return (
    <ol className="fx-steps">
      {pages.map((page, i) => (
        <li key={page.key} className={cx('fx-step', i < step && 'fx-step-done', i === step && 'fx-step-current')} aria-current={i === step ? 'step' : undefined}>
          <span className="fx-step-bar" />
          <span className="fx-step-label">
            {i + 1}. {page.title ?? page.key}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** The built-in look: plain HTML controls styled by `styles.css` and its `--fx-*` variables. */
export const defaultAdapter: Adapter = {
  fields: {
    text: Input,
    email: Input,
    phone: Input,
    date: Input,
    time: Input,
    number: Input,
    url: Input,
    rating: Rating,
    slider: Slider,
    lookup: Calculated,
    textarea: Textarea,
    select: Select,
    radio: Radio,
    checkboxGroup: CheckboxGroup,
    checkbox: Checkbox,
    toggle: Checkbox,
    calculated: Calculated,
    file: FileInput,
    hidden: Hidden,
  },
  layout: { panel: Panel, columns: Columns, content: Content, divider: Divider, repeater: Repeater },
  ui: { Button, Steps },
}
