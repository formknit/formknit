import { compile, ExprSyntaxError, functionNames, getField, type ComponentSchema, type FormSchema, type Option } from '@formknit/core'
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react'
import { fromExpression, isGroup, OPERATORS, toExpression, type Rule, type RuleSet } from './conditions'
import { cx, useBuilder } from './context'
import { settingsFor, type Setting, type SettingTab } from './meta'
import {
  componentAt, fieldsInScope, getProp, isAutoKey, isValidKey, parsePath, renameKey, setProp, toKey, uniqueKey, walk,
  type Path, type ScopeField,
} from './ops'

type Target = Record<string, unknown>

function Row({ label, help, htmlFor, children }: { label: string; help?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="fxb-setting">
      <label className="fxb-setting-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {help && <div className="fxb-help">{help}</div>}
    </div>
  )
}

function syntaxError(source: string): string | null {
  if (!source.trim()) return null
  try {
    compile(source)
    return null
  } catch (e) {
    return e instanceof ExprSyntaxError ? e.message : String(e)
  }
}

/** A box for an expression, with a syntax check underneath. */
function ExpressionInput(props: { id?: string; value: string; onChange: (value: string) => void; rows?: number; placeholder?: string; inputRef?: Ref<HTMLTextAreaElement> }) {
  const error = syntaxError(props.value)
  return (
    <>
      <textarea
        id={props.id}
        ref={props.inputRef}
        className={cx('fxb-input fxb-code', error && 'fxb-bad')}
        rows={props.rows ?? 2}
        value={props.value}
        placeholder={props.placeholder}
        spellCheck={false}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {error && (
        <div className="fxb-error" role="alert">
          {error}
        </div>
      )}
      {!error && props.value.trim() && <div className="fxb-ok">Formula is valid</div>}
    </>
  )
}

function KeyEditor({ id, component, onRename }: { id: string; component: ComponentSchema; onRename: (key: string) => void }) {
  const { schema } = useBuilder()
  const [text, setText] = useState(component.key ?? '')
  const [syncedTo, setSyncedTo] = useState(component.key)
  // The key can change underneath us when it follows the label; show the new one.
  if (syncedTo !== component.key) {
    setSyncedTo(component.key)
    setText(component.key ?? '')
  }
  let taken = false
  walk(schema, (c) => {
    if (c !== component && c.key === text) taken = true
  })
  const error = !isValidKey(text) ? 'Use letters, digits and _, starting with a letter' : taken ? 'Another field already uses this key' : null
  return (
    <>
      <input
        id={id}
        className={cx('fxb-input fxb-code', error && 'fxb-bad')}
        value={text}
        spellCheck={false}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          let clash = false
          walk(schema, (c) => {
            if (c !== component && c.key === next) clash = true
          })
          if (isValidKey(next) && !clash) {
            setSyncedTo(next)
            onRename(next)
          }
        }}
      />
      {error && (
        <div className="fxb-error" role="alert">
          {error}
        </div>
      )}
    </>
  )
}

function OptionsEditor({ options, onChange }: { options: Option[]; onChange: (options: Option[]) => void }) {
  const edit = (i: number, patch: Partial<Option>) => onChange(options.map((o, n) => (n === i ? { ...o, ...patch } : o)))
  return (
    <div className="fxb-options">
      {options.map((o, i) => (
        <div className="fxb-option" key={i}>
          <input
            className="fxb-input"
            aria-label={`Option ${i + 1} label`}
            value={o.label}
            onChange={(e) => {
              // The stored value follows the label until someone edits it by hand.
              const follows = o.value === toKey(o.label) || /^option\d+$/.test(o.value)
              edit(i, { label: e.target.value, ...(follows ? { value: toKey(e.target.value) || o.value } : {}) })
            }}
          />
          <input className="fxb-input fxb-code" aria-label={`Option ${i + 1} value`} value={o.value} onChange={(e) => edit(i, { value: e.target.value })} />
          <button type="button" className="fxb-action" aria-label={`Remove option ${i + 1}`} onClick={() => onChange(options.filter((_, n) => n !== i))}>
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="fxb-button"
        onClick={() => onChange([...options, { label: `Option ${options.length + 1}`, value: `option${options.length + 1}` }])}
      >
        + Add option
      </button>
    </div>
  )
}

const NUMERIC_TYPES = new Set(['number', 'calculated'])
const BOOLEAN_TYPES = new Set(['checkbox', 'toggle'])

/** The rows of one rule set: its rules, and at the top level its groups. */
function RuleRows({ set, fields, depth, onChange }: { set: RuleSet; fields: ScopeField[]; depth: number; onChange: (next: RuleSet) => void }) {
  const edit = (i: number, node: Rule | RuleSet) => onChange({ ...set, rules: set.rules.map((r, n) => (n === i ? node : r)) })
  const remove = (i: number) => onChange({ ...set, rules: set.rules.filter((_, n) => n !== i) })
  const name = depth === 0 ? 'Rule' : 'Group rule'
  return (
    <>
      {set.rules.length > 1 && (
        <div className="fxb-segment" role="group" aria-label={depth === 0 ? 'How rules combine' : 'How this group combines'}>
          {(['all', 'any'] as const).map((mode) => (
            <button key={mode} type="button" className={cx(set.mode === mode && 'fxb-active')} aria-pressed={set.mode === mode} onClick={() => onChange({ ...set, mode })}>
              {mode === 'all' ? 'All of these' : 'Any of these'}
            </button>
          ))}
        </div>
      )}
      {set.rules.map((node, i) => {
        if (isGroup(node)) {
          return (
            <div className="fxb-rule-group" key={i}>
              <div className="fxb-rule-line">
                <span className="fxb-group-title">Group</span>
                <span className="fxb-spacer" />
                <button type="button" className="fxb-action" aria-label={`Remove group ${i + 1}`} onClick={() => remove(i)}>
                  ×
                </button>
              </div>
              <RuleRows set={node} fields={fields} depth={depth + 1} onChange={(next) => edit(i, next)} />
            </div>
          )
        }
        const type = fields.find((f) => f.key === node.field)?.type ?? ''
        const operator = OPERATORS.find((o) => o.op === node.op)!
        return (
          <div className="fxb-rule" key={i}>
            <div className="fxb-rule-line">
              <select
                className="fxb-input"
                aria-label={`${name} ${i + 1} field`}
                value={node.field}
                onChange={(e) => {
                  const nextType = fields.find((f) => f.key === e.target.value)?.type ?? ''
                  edit(i, { ...node, field: e.target.value, ...(BOOLEAN_TYPES.has(nextType) ? { op: 'checked' as const, value: '' } : {}) })
                }}
              >
                <option value="">Choose a field…</option>
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button type="button" className="fxb-action" aria-label={`Remove ${name.toLowerCase()} ${i + 1}`} onClick={() => remove(i)}>
                ×
              </button>
            </div>
            <div className="fxb-rule-line">
              <select className="fxb-input" aria-label={`${name} ${i + 1} comparison`} value={node.op} onChange={(e) => edit(i, { ...node, op: e.target.value as Rule['op'] })}>
                {OPERATORS.filter((o) => (BOOLEAN_TYPES.has(type) ? !o.needsValue : true)).map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </select>
              {operator.needsValue && (
                <input className="fxb-input" aria-label={`${name} ${i + 1} value`} value={node.value} onChange={(e) => edit(i, { ...node, value: e.target.value })} />
              )}
            </div>
          </div>
        )
      })}
      <div className="fxb-rule-line">
        <button type="button" className="fxb-button" onClick={() => onChange({ ...set, rules: [...set.rules, { field: '', op: 'eq', value: '' }] })}>
          + {depth === 0 ? 'Add rule' : 'Add to group'}
        </button>
        {depth === 0 && (
          <button
            type="button"
            className="fxb-button"
            onClick={() => onChange({ ...set, rules: [...set.rules, { mode: set.mode === 'all' ? 'any' : 'all', rules: [{ field: '', op: 'eq', value: '' }] }] })}
          >
            + Add group
          </button>
        )}
      </div>
    </>
  )
}

/** Builds a condition from rows of "field, comparison, value", or as a typed formula. */
function RulesEditor({ value, fields, onChange }: { value: string; fields: ScopeField[]; onChange: (value: string) => void }) {
  const parsed = fromExpression(value)
  const [raw, setRaw] = useState(parsed === null)
  // Half-finished rows cannot be written as an expression, so the rows live here while editing.
  const [set, setSet] = useState<RuleSet>(parsed ?? { mode: 'all', rules: [] })
  const numeric = (key: string) => NUMERIC_TYPES.has(fields.find((f) => f.key === key)?.type ?? '')
  const update = (next: RuleSet) => {
    setSet(next)
    onChange(toExpression(next, numeric))
  }

  if (raw) {
    return (
      <>
        <ExpressionInput value={value} onChange={onChange} placeholder='country == "NP" AND age >= 16' />
        <button
          type="button"
          className="fxb-link"
          disabled={parsed === null}
          title={parsed === null ? 'This formula is too complex for the rule editor' : undefined}
          onClick={() => {
            setSet(parsed!)
            setRaw(false)
          }}
        >
          Use the rule editor
        </button>
      </>
    )
  }
  return (
    <div className="fxb-rules">
      {set.rules.length === 0 && <div className="fxb-help">Always shown. Add a rule to show it only sometimes.</div>}
      <RuleRows set={set} fields={fields} depth={0} onChange={update} />
      <button type="button" className="fxb-link" onClick={() => setRaw(true)}>
        Write a formula
      </button>
    </div>
  )
}

function FormulaEditor({ id, value, fields, onChange }: { id: string; value: string; fields: ScopeField[]; onChange: (value: string) => void }) {
  const box = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<number | null>(null)
  // Puts the cursor back after the inserted text once React has written the new value.
  useEffect(() => {
    if (caret.current === null || !box.current) return
    box.current.focus()
    box.current.setSelectionRange(caret.current, caret.current)
    caret.current = null
  })
  const insert = (text: string) => {
    const el = box.current
    // A new calculated field starts as "0"; replace that placeholder instead of adding to it.
    if (!el || value.trim() === '0' || value.trim() === '') {
      caret.current = text.endsWith('()') ? text.length - 1 : text.length
      return onChange(text)
    }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    caret.current = start + (text.endsWith('()') ? text.length - 1 : text.length)
    onChange(value.slice(0, start) + text + value.slice(end))
  }
  return (
    <>
      <ExpressionInput id={id} inputRef={box} value={value} onChange={onChange} rows={3} placeholder="qty * rate" />
      {fields.length > 0 && (
        <>
          <div className="fxb-help">Insert a field</div>
          <div className="fxb-chips">
            {fields.map((f) => (
              <button key={f.key} type="button" className="fxb-chip" title={f.label} onClick={() => insert(f.key)}>
                {f.key}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="fxb-help">Insert a function</div>
      <div className="fxb-chips">
        {functionNames().map((name) => (
          <button key={name} type="button" className="fxb-chip" onClick={() => insert(`${name}()`)}>
            {name}
          </button>
        ))}
      </div>
    </>
  )
}

interface SettingFieldProps {
  setting: Setting
  target: Target
  fields: ScopeField[]
  /** Applies an edit to the same object inside the draft. */
  edit: (change: (target: Target, draft: FormSchema) => void, coalesce: string) => void
}

function SettingField({ setting: s, target, fields, edit }: SettingFieldProps) {
  const id = useId()
  const value = getProp(target, s.path)
  const set = (next: unknown) => edit((t) => setProp(t, s.path, next), s.path)
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : ''

  switch (s.input) {
    case 'checkbox':
      return (
        <label className="fxb-check">
          <input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} />
          <span>{s.label}</span>
        </label>
      )
    case 'key':
      return (
        <Row label={s.label} help={s.help} htmlFor={id}>
          <KeyEditor id={id} component={target as ComponentSchema} onRename={(key) => edit((t, draft) => renameKey(draft, t as ComponentSchema, key), 'key')} />
        </Row>
      )
    case 'options':
      return (
        <Row label={s.label}>
          <OptionsEditor options={Array.isArray(value) ? (value as Option[]) : []} onChange={(options) => edit((t) => (t.options = options), 'options')} />
        </Row>
      )
    case 'rules':
      return (
        <Row label={s.label}>
          <RulesEditor value={text} fields={fields} onChange={set} />
        </Row>
      )
    case 'expression':
      return (
        <Row label={s.label} help={s.help} htmlFor={id}>
          <ExpressionInput id={id} value={text} onChange={set} placeholder="Leave empty for never" />
        </Row>
      )
    case 'formula':
      return (
        <Row label={s.label} htmlFor={id}>
          <FormulaEditor id={id} value={text} fields={fields} onChange={(next) => edit((t) => (t.expression = next), s.path)} />
        </Row>
      )
    case 'select':
      return (
        <Row label={s.label} help={s.help} htmlFor={id}>
          <select
            id={id}
            className="fxb-input"
            value={value === undefined ? '' : String(value)}
            onChange={(e) => {
              const picked = (s.choices ?? []).find((c) => String(c.value) === e.target.value)
              set(picked && picked.value !== '' ? picked.value : undefined)
            }}
          >
            {(s.choices ?? []).map((c) => (
              <option key={String(c.value)} value={String(c.value)}>
                {c.label}
              </option>
            ))}
          </select>
        </Row>
      )
    case 'columns': {
      const count = Array.isArray(value) ? value.length : 2
      return (
        <Row label={s.label} htmlFor={id}>
          <select
            id={id}
            className="fxb-input"
            value={count}
            onChange={(e) =>
              edit((t) => {
                const cols = ((t as ComponentSchema).columns ?? []).slice()
                const next = Number(e.target.value)
                while (cols.length < next) cols.push({ components: [] })
                // Fields in removed columns move to the last one that remains.
                while (cols.length > next) cols[next - 1].components.push(...cols.pop()!.components)
                ;(t as ComponentSchema).columns = cols
              }, 'columns')
            }
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Row>
      )
    }
    case 'number':
      return (
        <Row label={s.label} help={s.help} htmlFor={id}>
          <input
            id={id}
            className="fxb-input"
            type="number"
            value={text}
            onChange={(e) => {
              // An unfinished number such as "1." reads as empty; wait for it to be complete.
              if (e.target.value === '' && e.target.validity.badInput) return
              set(e.target.value === '' ? undefined : Number(e.target.value))
            }}
          />
        </Row>
      )
    case 'textarea':
      return (
        <Row label={s.label} help={s.help} htmlFor={id}>
          <textarea id={id} className="fxb-input" rows={3} value={text} onChange={(e) => set(e.target.value)} />
        </Row>
      )
    default:
      return (
        <Row label={s.label} help={s.help} htmlFor={id}>
          <input
            id={id}
            className="fxb-input"
            value={text}
            onChange={(e) => {
              if (s.path !== 'label') return set(e.target.value)
              edit((t, draft) => {
                const c = t as ComponentSchema
                // A key nobody has customised follows the label.
                const follow = getField(c.type)?.kind !== 'layout' && c.key !== undefined && isAutoKey(c)
                setProp(t, 'label', e.target.value)
                if (follow) renameKey(draft, c, uniqueKey(draft, toKey(e.target.value) || c.type, c))
              }, 'label')
            }}
          />
        </Row>
      )
  }
}

const TABS: { id: SettingTab; label: string }[] = [
  { id: 'display', label: 'Display' },
  { id: 'validation', label: 'Validation' },
  { id: 'logic', label: 'Logic' },
]

function ComponentSettings({ path }: { path: Path }) {
  const b = useBuilder()
  const [tab, setTab] = useState<SettingTab>('display')
  const c = componentAt(b.schema, path)
  if (!c) return null
  const def = getField(c.type)
  const all = settingsFor(c.type)
  const tabs = TABS.filter((t) => all.some((s) => s.tab === t.id))
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id
  const fields = fieldsInScope(b.schema, path)
  const pathText = path.join('/')
  return (
    <>
      <div className="fxb-settings-head">
        <div className="fxb-settings-title">{def?.label ?? c.type}</div>
        {c.key && <code className="fxb-key">{c.key}</code>}
      </div>
      {tabs.length > 1 && (
        <div className="fxb-segment" role="tablist" aria-label="Settings">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={cx(active === t.id && 'fxb-active')} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {all
        .filter((s) => s.tab === active)
        .map((s) => (
          <SettingField
            key={s.path}
            setting={s}
            target={c}
            fields={fields}
            edit={(change, coalesce) =>
              b.apply((draft) => {
                const target = componentAt(draft, path)
                if (target) change(target, draft)
              }, `${pathText}:${coalesce}`)
            }
          />
        ))}
    </>
  )
}

const text = (path: string, label: string, help?: string): Setting => ({ path, label, input: 'text', tab: 'display', help })
const pick = (path: string, label: string, choices: [string, string][]): Setting => ({
  path,
  label,
  input: 'select',
  tab: 'display',
  choices: choices.map(([value, text]) => ({ value, label: text })),
})
const FORM_SETTINGS = [
  text('title', 'Form title'),
  text('description', 'Description'),
  text('submitLabel', 'Submit button label', 'Defaults to "Submit"'),
  pick('appearance.size', 'Size', [['', 'Medium'], ['sm', 'Small'], ['lg', 'Large']]),
  pick('appearance.variant', 'Field style', [['', 'Outlined'], ['filled', 'Filled'], ['underline', 'Underline']]),
  pick('appearance.labelPosition', 'Labels', [['', 'Above the field'], ['left', 'Beside the field']]),
  pick('appearance.theme', 'Theme', [['', 'Light'], ['dark', 'Dark'], ['auto', 'Match the system']]),
]
const PAGE_SETTINGS: Setting[] = [
  text('title', 'Page title'),
  text('description', 'Description'),
  { path: 'visibleWhen', label: 'Show this page when', input: 'rules', tab: 'logic' },
]

function PageSettings() {
  const b = useBuilder()
  const index = b.pageIndex
  const page = b.schema.pages[index]
  const fields = fieldsInScope(b.schema, null)
  const count = b.schema.pages.length
  if (!page) return null
  const movePage = (delta: number) => {
    b.apply((draft) => {
      const [moved] = draft.pages.splice(index, 1)
      draft.pages.splice(index + delta, 0, moved)
      return null
    })
    b.setPageIndex(index + delta)
  }
  return (
    <>
      <div className="fxb-settings-head">
        <div className="fxb-settings-title">Form</div>
      </div>
      {FORM_SETTINGS.map((s) => (
        <SettingField key={s.path} setting={s} target={b.schema as unknown as Target} fields={fields} edit={(change, coalesce) => b.apply((draft) => change(draft as unknown as Target, draft), `form:${coalesce}`)} />
      ))}
      <hr className="fxb-rule-divider" />
      <div className="fxb-settings-head">
        <div className="fxb-settings-title">
          Page {index + 1} of {count}
        </div>
      </div>
      {PAGE_SETTINGS.map((s) => (
        <SettingField
          key={`${index}-${s.path}`}
          setting={s}
          target={page as unknown as Target}
          fields={fields}
          edit={(change, coalesce) => b.apply((draft) => change(draft.pages[index] as unknown as Target, draft), `page${index}:${coalesce}`)}
        />
      ))}
      {count > 1 && (
        <div className="fxb-rule-line">
          <button type="button" className="fxb-button" disabled={index === 0} onClick={() => movePage(-1)}>
            Move earlier
          </button>
          <button type="button" className="fxb-button" disabled={index >= count - 1} onClick={() => movePage(1)}>
            Move later
          </button>
          <button
            type="button"
            className="fxb-button fxb-danger"
            onClick={() => {
              b.apply((draft) => {
                draft.pages.splice(index, 1)
                return null
              })
              b.setPageIndex(Math.max(0, index - 1))
            }}
          >
            Delete page
          </button>
        </div>
      )}
      <div className="fxb-help">Select a field on the canvas to edit it.</div>
    </>
  )
}

export function Settings() {
  const b = useBuilder()
  return (
    <aside className="fxb-settings" aria-label="Settings">
      {b.selected ? <ComponentSettings key={b.selected} path={parsePath(b.selected)} /> : <PageSettings />}
    </aside>
  )
}
