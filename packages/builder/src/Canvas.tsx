import { getField, type ComponentSchema, type FormSchema } from '@formknit/core'
import { useRef, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { cx, Icon, useBuilder, type Drag } from './context'
import { iconFor } from './meta'
import { clone, isData, listAt, parsePath, pathKey, uniqueKey, type Path } from './ops'

const GRIP =
  '<circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/>'

/** A list that components can be dropped into: a page, a panel, a column or a repeater's row. */
export function DropList({ listPath, empty }: { listPath: Path; empty: string }) {
  const b = useBuilder()
  const ref = useRef<HTMLDivElement>(null)
  const key = pathKey(listPath)
  const list = listAt(b.schema, listPath) ?? []

  // A component cannot be dropped inside itself.
  const allowed = () => b.drag !== null && !(b.drag.kind === 'move' && `${key}/`.startsWith(`${b.drag.path}/`))
  const indexAt = (e: DragEvent) => {
    const cards = [...(ref.current?.children ?? [])].filter((el) => el.hasAttribute('data-card'))
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) return i
    }
    return cards.length
  }
  const onDragOver = (e: DragEvent) => {
    if (!b.drag) return
    // Stop here either way, so a drop refused by this list is not picked up by the list around it.
    e.stopPropagation()
    if (!allowed()) return
    e.preventDefault()
    const index = indexAt(e)
    if (b.indicator?.list !== key || b.indicator.index !== index) b.setIndicator({ list: key, index })
  }
  const onDrop = (e: DragEvent) => {
    if (!b.drag) return
    e.stopPropagation()
    if (!allowed()) return
    e.preventDefault()
    b.drop(listPath, indexAt(e))
  }
  const line = (index: number) =>
    b.indicator?.list === key && b.indicator.index === index && <div className="fxb-indicator" key={`line-${index}`} />

  return (
    <div ref={ref} className={cx('fxb-list', list.length === 0 && 'fxb-list-empty')} onDragOver={onDragOver} onDrop={onDrop}>
      {list.map((c, i) => [line(i), <Card key={`${i}-${c.type}-${c.key ?? ''}`} component={c} path={[...listPath, i]} />])}
      {line(list.length)}
      {list.length === 0 && <div className="fxb-empty">{empty}</div>}
    </div>
  )
}

function Preview({ component: c, path }: { component: ComponentSchema; path: Path }) {
  const { adapter } = useBuilder()
  const kind = getField(c.type)?.kind
  // The preview shows the real control but must not take focus or input.
  const inert = (el: HTMLElement | null) => el?.setAttribute('inert', '')

  if (kind === 'input' || kind === 'calculated') {
    const Field = adapter.fields[c.type]
    if (!Field) return <div className="fxb-note">No component is registered for "{c.type}"</div>
    if (c.type === 'hidden') return <div className="fxb-note">Hidden field: not shown to the person filling in the form</div>
    const empty = c.type === 'checkboxGroup' ? [] : c.type === 'checkbox' || c.type === 'toggle' ? false : ''
    return (
      <div className="fx-form fxb-preview" ref={inert}>
        <Field
          id={`preview-${pathKey(path)}`}
          path={c.key ?? ''}
          component={c}
          label={c.label}
          description={c.description}
          placeholder={c.placeholder}
          options={c.options ?? []}
          value={kind === 'calculated' ? c.expression : (c.defaultValue ?? empty)}
          onChange={() => {}}
          onBlur={() => {}}
          error={undefined}
          required={!!c.validate?.required}
          disabled={false}
        />
      </div>
    )
  }
  if (kind === 'repeater') {
    return (
      <div className="fxb-container">
        <div className="fxb-container-title">{c.label || c.key} · fields in each row</div>
        <DropList listPath={[...path, 'k']} empty="Drop the fields each row should have" />
      </div>
    )
  }
  if (c.type === 'columns') {
    return (
      <div className="fxb-columns">
        {(c.columns ?? []).map((_, n) => (
          <DropList key={n} listPath={[...path, n]} empty="Drop a field" />
        ))}
      </div>
    )
  }
  if (kind === 'layout') {
    return (
      <div className="fxb-container">
        {c.label && <div className="fxb-container-title">{c.label}</div>}
        <DropList listPath={[...path, 'k']} empty="Drop fields into this group" />
      </div>
    )
  }
  if (kind === 'content') {
    const Content = adapter.layout[c.type] ?? adapter.layout.content
    return (
      <div className="fx-form fxb-preview" ref={inert}>
        <Content component={c} />
      </div>
    )
  }
  return <div className="fxb-note">Unknown field type "{c.type}"</div>
}

function Card({ component: c, path }: { component: ComponentSchema; path: Path }) {
  const b = useBuilder()
  const key = pathKey(path)
  const selected = b.selected === key
  const def = getField(c.type)
  const index = path[path.length - 1] as number
  const listPath = path.slice(0, -1)
  const siblings = listAt(b.schema, listPath)?.length ?? 0
  const name = c.label || c.key || def?.label || c.type

  const move = (delta: number) =>
    b.apply((draft) => {
      const list = listAt(draft, listPath)!
      const [node] = list.splice(index, 1)
      list.splice(index + delta, 0, node)
      return node
    })
  const duplicate = () =>
    b.apply((draft) => {
      const list = listAt(draft, listPath)!
      const copy = clone(list[index])
      list.splice(index + 1, 0, copy)
      // Give every field in the copy its own key, one at a time so they do not collide with each other.
      const visit = (node: ComponentSchema) => {
        if (node.key && isData(node)) node.key = uniqueKey(draft, node.key.replace(/\d+$/, '') || node.type, node)
        node.components?.forEach(visit)
        node.columns?.forEach((col) => col.components.forEach(visit))
      }
      visit(copy)
      return copy
    })
  const remove = () =>
    b.apply((draft) => {
      listAt(draft, listPath)!.splice(index, 1)
      return null
    })

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      b.select(key)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove()
    }
  }
  const action = (label: string, glyph: ReactNode, run: () => void, disabled = false) => (
    <button
      type="button"
      className="fxb-action"
      aria-label={`${label}: ${name}`}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        run()
      }}
    >
      {glyph}
    </button>
  )

  return (
    <div
      data-card
      className={cx('fxb-card', selected && 'fxb-selected', b.drag?.kind === 'move' && b.drag.path === key && 'fxb-dragging')}
      draggable
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={`${def?.label ?? c.type}: ${name}`}
      onClick={(e) => {
        e.stopPropagation()
        b.select(key)
      }}
      onKeyDown={onKeyDown}
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer?.setData('text/plain', key)
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
        b.setDrag({ kind: 'move', path: key })
      }}
      onDragEnd={() => b.setDrag(null)}
    >
      <div className="fxb-card-bar">
        <span className="fxb-grip">
          <Icon markup={GRIP} size={14} />
        </span>
        <span className="fxb-type">
          <Icon markup={iconFor(c.type)} size={13} />
          {def?.label ?? c.type}
        </span>
        {c.key && isData(c) && <code className="fxb-key">{c.key}</code>}
        {c.visibleWhen && <span className="fxb-badge">Conditional</span>}
        <span className="fxb-spacer" />
        {selected && (
          <span className="fxb-actions">
            {action('Move up', '↑', () => move(-1), index === 0)}
            {action('Move down', '↓', () => move(1), index >= siblings - 1)}
            {action('Duplicate', '⧉', duplicate)}
            {action('Delete', '×', remove)}
          </span>
        )}
      </div>
      <Preview component={c} path={path} />
    </div>
  )
}

/** Tabs for the form's pages, and the drop area for the current page. */
export function Canvas() {
  const b = useBuilder()
  const pages = b.schema.pages
  const addPage = () =>
    b.apply((draft) => {
      const keys = new Set(draft.pages.map((p) => p.key))
      let n = draft.pages.length + 1
      while (keys.has(`page${n}`)) n++
      draft.pages.push({ key: `page${n}`, title: `Page ${n}`, components: [] })
      b.setPageIndex(draft.pages.length - 1)
      return null
    })
  return (
    <div className="fxb-canvas" onClick={() => b.select(null)}>
      <div className="fxb-pages" role="tablist" aria-label="Pages">
        {pages.map((page, i) => (
          <button
            key={page.key}
            type="button"
            role="tab"
            aria-selected={i === b.pageIndex}
            className={cx('fxb-page-tab', i === b.pageIndex && 'fxb-active')}
            onClick={(e) => {
              e.stopPropagation()
              b.setPageIndex(i)
              b.select(null)
            }}
          >
            <span className="fxb-page-number">{i + 1}</span>
            {page.title || page.key}
          </button>
        ))}
        <button type="button" className="fxb-page-tab fxb-page-add" onClick={(e) => (e.stopPropagation(), addPage())}>
          + Add page
        </button>
      </div>
      <div className="fxb-sheet">
        {b.schema.title && <div className="fxb-form-title">{b.schema.title}</div>}
        <DropList listPath={[b.pageIndex]} empty="Drag a field here, or click one in the list on the left" />
      </div>
    </div>
  )
}

/** Carries out a drop. Shared by the canvas and the palette's click-to-add. */
export function performDrop(
  draft: FormSchema,
  drag: Drag,
  listPath: Path,
  index: number,
  create: (type: string) => ComponentSchema,
): ComponentSchema | null {
  const target = listAt(draft, listPath)
  if (!target) return null
  if (drag.kind === 'new') {
    const c = create(drag.type)
    target.splice(index, 0, c)
    return c
  }
  const from = parsePath(drag.path)
  const source = listAt(draft, from.slice(0, -1))
  const at = from[from.length - 1] as number
  const node = source?.[at]
  if (!source || !node) return null
  source.splice(at, 1)
  // Removing an earlier sibling shifts the position we were aiming for.
  target.splice(source === target && at < index ? index - 1 : index, 0, node)
  return node
}
