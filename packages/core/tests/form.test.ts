import { describe, expect, it, vi } from 'vitest'
import {
  calculated, checkSchema, computeState, form, getInitialValues, lookup, number, rating, SchemaError, slider, text, url, validate,
  validateAsync, type FormSchema, type LookupQuery,
} from '../src'

const page = (components: FormSchema['pages'][0]['components'], extra = {}): FormSchema => ({
  version: 1,
  pages: [{ key: 'main', components, ...extra }],
})

const admission = page([
  { type: 'text', key: 'fullName', label: 'Full name', validate: { required: true, minLength: 3 } },
  { type: 'email', key: 'email', label: 'Email', validate: { required: true } },
  { type: 'number', key: 'age', label: 'Age', validate: { min: 16, max: 60 } },
  {
    type: 'select',
    key: 'country',
    label: 'Country',
    options: [
      { label: 'Nepal', value: 'NP' },
      { label: 'India', value: 'IN' },
    ],
  },
  { type: 'text', key: 'district', label: 'District', visibleWhen: 'country == "NP"', validate: { required: true } },
  { type: 'checkbox', key: 'agree', label: 'Agreement', validate: { required: true } },
])

const good = { fullName: 'Sita Sharma', email: 'sita@example.com', age: '18', country: 'NP', district: 'Kaski', agree: true }

describe('validation', () => {
  it('accepts a good submission and returns clean data', () => {
    const result = validate(admission, { ...good, hacker: 'x' })
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.data).toEqual({ ...good, age: 18 })
  })

  it('reports each kind of error', () => {
    const result = validate(admission, { fullName: 'Al', email: 'nope', age: 12, country: 'XX', agree: false })
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual({
      fullName: ['Full name must be at least 3 characters'],
      email: ['Email must be a valid email address'],
      age: ['Age must be at least 16'],
      country: ['Country has a choice that is not allowed'],
      agree: ['Please tick "Agreement"'],
    })
  })

  it('reports required fields and non-numbers', () => {
    const result = validate(admission, { age: 'abc' })
    expect(result.errors.fullName).toEqual(['Full name is required'])
    expect(result.errors.email).toEqual(['Email is required'])
    expect(result.errors.age).toEqual(['Age must be a number'])
  })

  it('ignores hidden fields: not required, not submitted', () => {
    const result = validate(admission, { ...good, country: 'IN', district: 'Kaski' })
    expect(result.valid).toBe(true)
    expect(result.data).not.toHaveProperty('district')
  })

  it('requires a visible conditional field', () => {
    const result = validate(admission, { ...good, district: '' })
    expect(result.errors).toEqual({ district: ['District is required'] })
  })

  it('supports patterns, dates, lists and custom rules', () => {
    const schema = page([
      { type: 'text', key: 'code', label: 'Code', validate: { pattern: '[A-Z]{3}\\d{2}', patternMessage: 'Use ABC12' } },
      { type: 'date', key: 'start', label: 'Start', validate: { min: '2026-01-01' } },
      { type: 'date', key: 'end', label: 'End', validate: { rules: [{ expression: '$value >= start', message: 'End must be after start' }] } },
      { type: 'checkboxGroup', key: 'days', label: 'Days', options: [{ label: 'Mon', value: 'mon' }, { label: 'Tue', value: 'tue' }], validate: { minItems: 2 } },
      { type: 'time', key: 'at', label: 'Time' },
      { type: 'phone', key: 'phone', label: 'Phone' },
    ])
    expect(validate(schema, { code: 'ABC12', start: '2026-05-01', end: '2026-05-02', days: ['mon', 'tue'], at: '09:30', phone: '+977 98-0000000' }).valid).toBe(true)
    expect(validate(schema, { code: 'abc', start: '2025-05-01', end: '2025-04-01', days: ['mon'], at: '25:00', phone: 'x' }).errors).toEqual({
      code: ['Use ABC12'],
      start: ['Start must be at least 2026-01-01'],
      end: ['End must be after start'],
      days: ['Days needs at least 2 items'],
      at: ['Time must be a valid time'],
      phone: ['Phone must be a valid phone number'],
    })
    expect(validate(schema, { start: '2026-02-30', days: ['sun'] }).errors).toEqual({
      start: ['Start must be a valid date'],
      days: ['Days has a choice that is not allowed'],
    })
  })

  it('supports requiredWhen and disabledWhen', () => {
    const schema = page([
      { type: 'checkbox', key: 'other', label: 'Other' },
      { type: 'text', key: 'reason', label: 'Reason', requiredWhen: 'other' },
      { type: 'text', key: 'locked', label: 'Locked', disabledWhen: 'other', validate: { required: true } },
    ])
    expect(validate(schema, { other: true }).errors).toEqual({ reason: ['Reason is required'] })
    expect(validate(schema, { other: false }).errors).toEqual({ locked: ['Locked is required'] })
    expect(computeState(schema, { other: true }).fields.locked.disabled).toBe(true)
  })

  it('lets messages be replaced', () => {
    const result = validate(admission, {}, { messages: { required: (label) => `${label} चाहिन्छ` } })
    expect(result.errors.fullName).toEqual(['Full name चाहिन्छ'])
  })
})

const invoice = page([
  { type: 'number', key: 'discount', label: 'Discount %' },
  {
    type: 'repeater',
    key: 'items',
    label: 'Items',
    validate: { required: true, maxItems: 3 },
    components: [
      { type: 'text', key: 'name', label: 'Item', validate: { required: true } },
      { type: 'number', key: 'qty', label: 'Qty', validate: { min: 1 } },
      { type: 'number', key: 'rate', label: 'Rate' },
      { type: 'calculated', key: 'amount', label: 'Amount', expression: 'qty * rate' },
      { type: 'text', key: 'note', label: 'Note', visibleWhen: 'amount > 5000 AND discount > 0' },
    ],
  },
  { type: 'calculated', key: 'total', label: 'Total', expression: 'ROUND(SUM(items.amount) * (1 - discount / 100), 2)' },
  { type: 'calculated', key: 'label', label: 'Label', expression: 'IF(total > 10000, "large", "small")' },
])

describe('calculations and repeaters', () => {
  const input = {
    discount: 5,
    total: 1,
    items: [
      { name: 'Tuition', qty: '1', rate: '9000', amount: 999999, note: 'keep', junk: 1 },
      { name: 'Lab', qty: 2, rate: 1500, note: 'drop' },
    ],
  }

  it('recalculates formulas and ignores values sent by the client', () => {
    const result = validate(invoice, input)
    expect(result.valid).toBe(true)
    expect(result.data).toEqual({
      discount: 5,
      items: [
        { name: 'Tuition', qty: 1, rate: 9000, amount: 9000, note: 'keep' },
        { name: 'Lab', qty: 2, rate: 1500, amount: 3000 },
      ],
      total: 11400,
      label: 'large',
    })
  })

  it('reports errors per row', () => {
    const result = validate(invoice, { items: [{ name: '', qty: 0, rate: 5 }] })
    expect(result.errors).toEqual({
      'items.0.name': ['Item is required'],
      'items.0.qty': ['Qty must be at least 1'],
    })
  })

  it('validates the list itself', () => {
    expect(validate(invoice, {}).errors).toEqual({ items: ['Items is required'] })
    const four = Array.from({ length: 4 }, () => ({ name: 'x', qty: 1, rate: 1 }))
    expect(validate(invoice, { items: four }).errors).toEqual({ items: ['Items can have at most 3 items'] })
  })

  it('tolerates malformed input', () => {
    expect(validate(invoice, { items: 'nope' } as never).errors).toEqual({ items: ['Items is required'] })
    expect(validate(invoice, { items: [null, 5, { name: 'a', qty: 1, rate: 2 }] } as never).data.items).toEqual([
      { name: '', qty: null, rate: null, amount: 0 },
      { name: '', qty: null, rate: null, amount: 0 },
      { name: 'a', qty: 1, rate: 2, amount: 2 },
    ])
    expect(validate(invoice, null as never).valid).toBe(false)
  })

  it('exposes per-field state for renderers', () => {
    const state = computeState(invoice, input)
    expect(state.values.total).toBe(11400)
    expect(state.fields['items.0.amount']).toMatchObject({ value: 9000, disabled: true, visible: true })
    expect(state.fields['items.0.note'].visible).toBe(true)
    expect(state.fields['items.1.note'].visible).toBe(false)
    const note = invoice.pages[0].components[1].components![4]
    expect(state.isVisible(note, 'items.0')).toBe(true)
    expect(state.isVisible(note, 'items.1')).toBe(false)
  })

  it('shows a calculation error on the field', () => {
    const schema = page([
      { type: 'number', key: 'a' },
      { type: 'calculated', key: 'ratio', label: 'Ratio', expression: '10 / a' },
    ])
    const result = validate(schema, { a: 0 })
    expect(result.errors).toEqual({ ratio: ['Ratio could not be calculated (#DIV/0!)'] })
    expect(result.data.ratio).toBe(null)
  })

  it('treats hidden fields as empty in formulas', () => {
    const schema = page([
      { type: 'checkbox', key: 'hasFee' },
      { type: 'number', key: 'fee', visibleWhen: 'hasFee' },
      { type: 'number', key: 'base' },
      { type: 'calculated', key: 'total', expression: 'base + fee' },
    ])
    expect(validate(schema, { hasFee: true, fee: 50, base: 100 }).data.total).toBe(150)
    expect(validate(schema, { hasFee: false, fee: 50, base: 100 }).data).toEqual({ hasFee: false, base: 100, total: 100 })
  })

  it('chains visibility through calculated values in any document order', () => {
    const schema = page([
      { type: 'text', key: 'vip', visibleWhen: 'tier == "gold"' },
      { type: 'calculated', key: 'tier', expression: 'IF(spend >= 1000, "gold", "basic")' },
      { type: 'number', key: 'spend' },
    ])
    expect(computeState(schema, { spend: 1500 }).fields.vip.visible).toBe(true)
    expect(computeState(schema, { spend: 10 }).fields.vip.visible).toBe(false)
  })

  it('hides everything inside a hidden panel, column or page', () => {
    const schema: FormSchema = {
      version: 1,
      pages: [
        {
          key: 'one',
          components: [
            { type: 'checkbox', key: 'more' },
            {
              type: 'panel',
              visibleWhen: 'more',
              components: [
                { type: 'columns', columns: [{ components: [{ type: 'text', key: 'a', validate: { required: true } }] }] },
              ],
            },
          ],
        },
        { key: 'two', visibleWhen: 'more', components: [{ type: 'text', key: 'b', validate: { required: true } }] },
      ],
    }
    const off = computeState(schema, { more: false, a: 'x', b: 'y' })
    expect(off.valid).toBe(true)
    expect(off.data).toEqual({ more: false })
    expect(off.pages).toEqual([
      { key: 'one', visible: true, valid: true },
      { key: 'two', visible: false, valid: true },
    ])
    const on = computeState(schema, { more: true })
    expect(Object.keys(on.errors)).toEqual(['a', 'b'])
    expect(on.pages.map((p) => p.valid)).toEqual([false, false])
  })

  it('supports nested repeaters', () => {
    const schema = page([
      {
        type: 'repeater',
        key: 'orders',
        components: [
          { type: 'repeater', key: 'lines', components: [{ type: 'number', key: 'amount' }] },
          { type: 'calculated', key: 'subtotal', expression: 'SUM(lines.amount)' },
        ],
      },
      { type: 'calculated', key: 'grand', expression: 'SUM(orders.subtotal)' },
      { type: 'calculated', key: 'lineCount', expression: 'COUNT(orders.lines.amount)' },
    ])
    const data = validate(schema, { orders: [{ lines: [{ amount: 1 }, { amount: 2 }] }, { lines: [{ amount: 10 }] }] }).data
    expect(data.orders).toEqual([
      { lines: [{ amount: 1 }, { amount: 2 }], subtotal: 3 },
      { lines: [{ amount: 10 }], subtotal: 10 },
    ])
    expect(data.grand).toBe(13)
    expect(data.lineCount).toBe(3)
  })

  it('stays fast on a large form', () => {
    const components: FormSchema['pages'][0]['components'] = []
    for (let i = 0; i < 200; i++) {
      components.push({ type: 'number', key: `n${i}` })
      components.push({ type: 'calculated', key: `c${i}`, expression: i ? `c${i - 1} + n${i}` : 'n0' })
    }
    const schema = page(components)
    const values = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`n${i}`, 1]))
    computeState(schema, values)
    const start = Date.now()
    const runs = 20
    for (let i = 0; i < runs; i++) computeState(schema, values)
    const each = (Date.now() - start) / runs
    expect(computeState(schema, values).values.c199).toBe(200)
    expect(each).toBeLessThan(20)
  })
})

describe('schema checks', () => {
  const messages = (schema: FormSchema) => checkSchema(schema).map((i) => `${i.level}: ${i.message}`)

  it('passes a good schema', () => {
    expect(checkSchema(admission)).toEqual([])
    expect(checkSchema(invoice)).toEqual([])
  })

  it('finds structural problems', () => {
    expect(
      messages(
        page([
          { type: 'text' },
          { type: 'text', key: '1st' },
          { type: 'text', key: 'dup' },
          { type: 'number', key: 'dup' },
          { type: 'text', key: 'and' },
          { type: 'sparkle', key: 'x' },
          { type: 'select', key: 'pick' },
          { type: 'calculated', key: 'calc' },
          { type: 'text', key: 'bad', visibleWhen: '1 +' },
          { type: 'text', key: 'ghost', visibleWhen: 'nobody == 1' },
        ]),
      ),
    ).toEqual([
      'error: A text field needs a key',
      'error: Key "1st" may only use letters, digits and _ and cannot start with a digit',
      'error: Key "dup" is used more than once',
      'error: Key "and" is a reserved word',
      'error: Unknown field type "sparkle"',
      'warning: Select field has no options',
      'error: A calculated field needs an expression',
      'error: visibleWhen: Expression ends too early',
      'warning: Unknown field "nobody"',
    ])
  })

  it('finds circular references', () => {
    const schema = page([
      { type: 'calculated', key: 'a', expression: 'b + 1' },
      { type: 'calculated', key: 'b', expression: 'a + 1' },
    ])
    expect(messages(schema)).toEqual(['error: Circular reference: a → b → a'])
    expect(() => validate(schema, {})).toThrow(SchemaError)
    expect(() => computeState(schema, {})).not.toThrow()
  })

  it('finds a field whose visibility depends on itself', () => {
    expect(messages(page([{ type: 'text', key: 'a', visibleWhen: 'a == "x"' }]))).toEqual(['error: Circular reference: a → a'])
  })

  it('survives a malformed schema', () => {
    expect(messages({} as never)).toContain('error: A form needs a list of pages')
    expect(messages({ version: 1, pages: [{ key: 'p', components: [null, { key: 'x' }] }] } as never)).toEqual([
      'error: Every component needs a type',
      'error: Every component needs a type',
    ])
  })
})

describe('hostile input', () => {
  it('does not let data or keys touch object prototypes', () => {
    const schema = page([
      { type: 'hidden', key: 'token' },
      { type: 'calculated', key: 'leak', expression: 'token.constructor' },
    ])
    const input = JSON.parse('{"token": {"a": 1}, "__proto__": {"polluted": true}, "constructor": "x"}')
    const result = validate(schema, input)
    expect(result.data).toEqual({ token: { a: 1 }, leak: null })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.getPrototypeOf(computeState(schema, input).values)).toBe(Object.prototype)
    expect(checkSchema(page([{ type: 'text', key: '__proto__' }]))[0].message).toMatch(/reserved/)
    expect(checkSchema(page([{ type: 'text', key: 'constructor' }]))[0].message).toMatch(/reserved/)
  })
})

describe('initial values', () => {
  it('uses defaults, then empty values, and fills partial rows', () => {
    const schema = page([
      { type: 'text', key: 'name', defaultValue: 'Guest' },
      { type: 'number', key: 'qty' },
      { type: 'checkbox', key: 'agree' },
      { type: 'checkboxGroup', key: 'days', options: [{ label: 'Mon', value: 'mon' }] },
      { type: 'panel', components: [{ type: 'text', key: 'inside' }] },
      { type: 'repeater', key: 'items', components: [{ type: 'text', key: 'label', defaultValue: 'New' }, { type: 'number', key: 'n' }] },
      { type: 'calculated', key: 'calc', expression: '1' },
    ])
    expect(getInitialValues(schema)).toEqual({ name: 'Guest', qty: null, agree: false, days: [], inside: '', items: [] })
    expect(getInitialValues(schema, { name: 'Sita', items: [{ n: 2 }] })).toMatchObject({ name: 'Sita', items: [{ label: 'New', n: 2 }] })
  })
})

describe('lookups, files and extra fields', () => {
  const students: Record<string, { fullName: string; paid: number[] }> = {
    '2027-0142': { fullName: 'Sita Sharma', paid: [9000, 3000] },
  }
  const lookupFn = vi.fn(async (q: LookupQuery) => {
    const student = students[String(q.where.rollNo)]
    if (!student) return null
    return q.aggregate === 'sum' ? student.paid.reduce((a, b) => a + b, 0) : student.fullName
  })
  const fees = form('Fees', [
    text('rollNumber').required(),
    lookup('studentName', { source: 'students', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'fullName' }).required(),
    lookup('paid', { source: 'payments', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'amount', aggregate: 'sum' }),
    number('due'),
    calculated('balance', 'due - paid'),
  ])

  it('describes what each lookup needs', () => {
    const state = computeState(fees, { rollNumber: '2027-0142' })
    expect(state.fields.studentName.lookup).toEqual({ source: 'students', where: { rollNo: '2027-0142' }, select: 'fullName', aggregate: 'first' })
    expect(state.fields.studentName.disabled).toBe(true)
    expect(computeState(fees, {}).fields.studentName.lookup).toBeNull()
    expect(state.fields.rollNumber.lookup).toBeUndefined()
  })

  it('fetches lookups on the server and ignores what the client sent', async () => {
    const result = await validateAsync(fees, { rollNumber: '2027-0142', studentName: 'Forged', paid: 999999, due: 20000 }, { lookup: lookupFn })
    expect(result.valid).toBe(true)
    expect(result.data).toEqual({ rollNumber: '2027-0142', studentName: 'Sita Sharma', paid: 12000, due: 20000, balance: 8000 })
    const missing = await validateAsync(fees, { rollNumber: 'nobody', studentName: 'Forged' }, { lookup: lookupFn })
    expect(missing.errors).toEqual({ studentName: ['studentName is required'] })
    expect(missing.data.studentName).toBeNull()
  })

  it('warns about an incomplete lookup', () => {
    expect(checkSchema(page([{ type: 'lookup', key: 'x' }])).map((i) => i.message)).toEqual([
      'A lookup field needs a source, a field to match and a value to match',
    ])
  })

  it('checks file size and type', () => {
    const schema = page([{ type: 'file', key: 'cv', label: 'CV', accept: '.pdf, image/*', validate: { maxSizeMb: 2, required: true } }])
    const check = (file: unknown) => validate(schema, { cv: file }).errors.cv
    expect(check({ name: 'cv.pdf', size: 1000, type: 'application/pdf' })).toBeUndefined()
    expect(check({ name: 'photo.PNG', size: 1000, type: 'image/png' })).toBeUndefined()
    expect(check({ name: 'cv.pdf', size: 3 * 1024 * 1024, type: 'application/pdf' })).toEqual(['CV must be 2 MB or smaller'])
    expect(check({ name: 'cv.docx', size: 10, type: 'application/msword' })).toEqual(['CV must be one of: .pdf, image/*'])
    expect(check(null)).toEqual(['CV is required'])
  })

  it('supports web addresses, ratings and sliders', () => {
    const schema = form('F', [url('site').label('Site'), rating('stars').label('Stars').max(5), slider('volume').label('Volume').min(0).max(10)])
    expect(schema.pages[0].components[1]).toMatchObject({ type: 'rating', max: 5 })
    expect(validate(schema, { site: 'https://example.com/a?b=1', stars: '4', volume: 7 }).data).toEqual({ site: 'https://example.com/a?b=1', stars: 4, volume: 7 })
    expect(validate(schema, { site: 'example.com', stars: 9, volume: 11 }).errors).toEqual({
      site: ['Site must be a web address starting with http:// or https://'],
      stars: ['Stars must be at most 5'],
      volume: ['Volume must be at most 10'],
    })
  })

  it('carries width, class and appearance in the schema', () => {
    const schema = form('F', [text('a').width(6).className('fx-hide-label')])
    expect(schema.pages[0].components[0]).toEqual({ type: 'text', key: 'a', width: 6, className: 'fx-hide-label' })
    expect(checkSchema({ ...schema, appearance: { size: 'lg', variant: 'filled' } })).toEqual([])
  })
})
