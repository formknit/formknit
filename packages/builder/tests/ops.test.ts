import { calculated, checkSchema, columns, form, number, panel, repeater, text } from '@formknit/core'
import { describe, expect, it } from 'vitest'
import { fromExpression, toExpression } from '../src/conditions'
import { newComponent, settingsFor } from '../src/meta'
import {
  clone, componentAt, fieldsInScope, findPath, getProp, isAutoKey, isValidKey, listAt, pathKey, parsePath, renameKey,
  renameRef, setProp, toKey, uniqueKey,
} from '../src/ops'

const schema = () =>
  clone(
    form('Invoice', [
      text('fullName').label('Full name'),
      panel('Contact', [text('email'), columns([text('city')], [text('zip')])]),
      repeater('items', [number('qty'), number('rate'), calculated('amount', 'qty * rate')]),
      calculated('total', 'SUM(items.amount)').visibleWhen('fullName != "amount"'),
    ]),
  )

describe('schema operations', () => {
  it('addresses components by path', () => {
    const s = schema()
    expect(componentAt(s, [0, 0])?.key).toBe('fullName')
    expect(componentAt(s, [0, 1, 'k', 0])?.key).toBe('email')
    expect(componentAt(s, [0, 1, 'k', 1, 1, 0])?.key).toBe('zip')
    expect(componentAt(s, [0, 2, 'k', 2])?.key).toBe('amount')
    expect(listAt(s, [0, 1, 'k', 1, 0])?.map((c) => c.key)).toEqual(['city'])
    expect(findPath(s, componentAt(s, [0, 1, 'k', 1, 1, 0])!)).toEqual([0, 1, 'k', 1, 1, 0])
    expect(parsePath(pathKey([0, 1, 'k', 1, 1, 0]))).toEqual([0, 1, 'k', 1, 1, 0])
    expect(componentAt(s, [0, 9])).toBeUndefined()
  })

  it('makes keys from labels and keeps them unique', () => {
    expect(toKey('Full name')).toBe('fullName')
    expect(toKey('  Date of birth (BS) ')).toBe('dateOfBirthBs')
    expect(toKey('2nd phone')).toBe('ndPhone')
    expect(toKey('—')).toBe('')
    const s = schema()
    expect(uniqueKey(s, 'phone')).toBe('phone')
    expect(uniqueKey(s, 'email')).toBe('email2')
    expect(uniqueKey(s, 'qty')).toBe('qty2')
    expect(uniqueKey(s, 'and')).toBe('field')
    expect(uniqueKey(s, 'email', componentAt(s, [0, 1, 'k', 0]))).toBe('email')
    expect(isValidKey('a_1')).toBe(true)
    expect(isValidKey('1a')).toBe(false)
    expect(isValidKey('constructor')).toBe(false)
  })

  it('knows when a key still follows its label', () => {
    expect(isAutoKey({ type: 'text', key: 'text2', label: 'Text' })).toBe(true)
    expect(isAutoKey({ type: 'text', key: 'fullName', label: 'Full name' })).toBe(true)
    expect(isAutoKey({ type: 'text', key: 'fullName2', label: 'Full name' })).toBe(true)
    expect(isAutoKey({ type: 'text', key: 'applicant', label: 'Full name' })).toBe(false)
  })

  it('renames references in expressions but not in text or function names', () => {
    expect(renameRef('qty * rate + SUM(qty) & "qty" & qtyTotal', 'qty', 'count')).toBe('count * rate + SUM(count) & "qty" & qtyTotal')
    expect(renameRef('SUM(items.amount)', 'amount', 'cost')).toBe('SUM(items.cost)')
    expect(renameRef('sum > 1 AND SUM(x)', 'sum', 'total')).toBe('total > 1 AND SUM(x)')
    const s = schema()
    renameKey(s, componentAt(s, [0, 2, 'k', 2])!, 'cost')
    expect(componentAt(s, [0, 3])).toMatchObject({ expression: 'SUM(items.cost)', visibleWhen: 'fullName != "amount"' })
    renameKey(s, componentAt(s, [0, 2, 'k', 0])!, 'count')
    expect(componentAt(s, [0, 2, 'k', 2])?.expression).toBe('count * rate')
    expect(checkSchema(s)).toEqual([])
  })

  it('reads and writes nested properties, pruning empties', () => {
    const c: Record<string, unknown> = { type: 'text' }
    setProp(c, 'validate.min', 3)
    setProp(c, 'validate.required', true)
    expect(c).toEqual({ type: 'text', validate: { min: 3, required: true } })
    expect(getProp(c, 'validate.min')).toBe(3)
    setProp(c, 'validate.min', undefined)
    setProp(c, 'validate.required', false)
    expect(c).toEqual({ type: 'text' })
    setProp(c, 'validate.min', 0)
    expect(c).toEqual({ type: 'text', validate: { min: 0 } })
  })

  it('lists the fields an expression can use', () => {
    const s = schema()
    const keys = (path: Parameters<typeof fieldsInScope>[1]) => fieldsInScope(s, path).map((f) => f.key)
    expect(keys(null)).toEqual(['fullName', 'email', 'city', 'zip', 'items', 'total'])
    expect(keys([0, 2, 'k', 2])).toEqual(['fullName', 'email', 'city', 'zip', 'items', 'qty', 'rate', 'total'])
    expect(keys([0, 3])).toEqual(['fullName', 'email', 'city', 'zip', 'items'])
  })

  it('creates sensible new components and settings', () => {
    expect(newComponent('text')).toEqual({ type: 'text', label: 'Text' })
    expect(newComponent('select').options).toHaveLength(2)
    expect(newComponent('columns').columns).toHaveLength(2)
    expect(newComponent('divider')).toEqual({ type: 'divider' })
    expect(settingsFor('text').map((x) => x.path)).toEqual([
      'label', 'key', 'placeholder', 'description', 'validate.required', 'validate.minLength', 'validate.maxLength',
      'validate.pattern', 'validate.patternMessage', 'visibleWhen', 'requiredWhen', 'disabledWhen',
    ])
    expect(settingsFor('calculated').map((x) => x.path)).toEqual(['label', 'key', 'expression', 'description', 'visibleWhen'])
    expect(settingsFor('divider').map((x) => x.path)).toEqual(['visibleWhen'])
  })
})

describe('rules and expressions', () => {
  const numeric = (field: string) => field === 'age'

  it('writes rules as an expression', () => {
    expect(
      toExpression(
        {
          mode: 'all',
          rules: [
            { field: 'country', op: 'eq', value: 'NP' },
            { field: 'age', op: 'gte', value: '16' },
            { field: 'name', op: 'contains', value: 'a "b"' },
            { field: 'note', op: 'notEmpty', value: '' },
            { field: 'agree', op: 'checked', value: '' },
            { field: '', op: 'eq', value: 'ignored' },
          ],
        },
        numeric,
      ),
    ).toBe('country == "NP" AND age >= 16 AND CONTAINS(name, "a \\"b\\"") AND NOT ISEMPTY(note) AND agree == true')
    expect(toExpression({ mode: 'any', rules: [{ field: 'a', op: 'empty', value: '' }, { field: 'b', op: 'unchecked', value: '' }] })).toBe(
      'ISEMPTY(a) OR b != true',
    )
    expect(toExpression({ mode: 'all', rules: [] })).toBe('')
  })

  it('reads an expression back as the same rules', () => {
    const set = {
      mode: 'all' as const,
      rules: [
        { field: 'country', op: 'eq' as const, value: 'NP' },
        { field: 'age', op: 'gte' as const, value: '16' },
        { field: 'name', op: 'contains' as const, value: 'a "b"' },
        { field: 'note', op: 'notEmpty' as const, value: '' },
        { field: 'agree', op: 'checked' as const, value: '' },
        { field: 'items.qty', op: 'lt' as const, value: '5' },
      ],
    }
    expect(fromExpression(toExpression(set, numeric))).toEqual(set)
    expect(fromExpression('a = "x" OR b <> "y"')).toEqual({
      mode: 'any',
      rules: [
        { field: 'a', op: 'eq', value: 'x' },
        { field: 'b', op: 'neq', value: 'y' },
      ],
    })
    expect(fromExpression('')).toEqual({ mode: 'all', rules: [] })
    expect(fromExpression(undefined)).toEqual({ mode: 'all', rules: [] })
  })

  it('gives up on expressions the rule editor cannot show', () => {
    expect(fromExpression('a == 1 AND (b == 2 OR c == 3)')).toBeNull()
    expect(fromExpression('qty * rate > 100')).toBeNull()
    expect(fromExpression('a == b')).toBeNull()
    expect(fromExpression('LEN(a) > 3')).toBeNull()
    expect(fromExpression('a ==')).toBeNull()
  })
})
