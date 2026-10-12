import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  calculated, checkbox, checkboxGroup, checkSchema, columns, content, divider, email, form, number, page, panel,
  repeater, select, text, validate, type InferData,
} from '../src'

const invoice = form('Fee invoice', [
  text('rollNumber').label('Roll number').required().pattern(/\d{4}-\d{4}/, 'Use 2027-0142'),
  select('country', { NP: 'Nepal', IN: 'India' }),
  text('district').visibleWhen('country == "NP"'),
  panel('Contact', [email('email'), checkbox('agree').required()]),
  columns([number('discount').min(0).max(100)], [checkboxGroup('days', { mon: 'Mon', tue: 'Tue' })]),
  content('Add each fee', { heading: true }),
  divider(),
  repeater('items', [text('name').required(), number('qty').min(1), number('rate'), calculated('amount', 'qty * rate')]).minItems(1),
  calculated('total', 'ROUND(SUM(items.amount) * (1 - discount / 100), 2)').check('$value > 0', 'Total must be positive'),
])

describe('code-first builders', () => {
  it('produces plain, valid schema JSON', () => {
    expect(checkSchema(invoice)).toEqual([])
    expect(JSON.parse(JSON.stringify(invoice))).toEqual(invoice)
    expect(invoice.pages[0].components[0]).toEqual({
      type: 'text',
      key: 'rollNumber',
      label: 'Roll number',
      validate: { required: true, pattern: '\\d{4}-\\d{4}', patternMessage: 'Use 2027-0142' },
    })
    expect(invoice.pages[0].components[1].options).toEqual([
      { label: 'Nepal', value: 'NP' },
      { label: 'India', value: 'IN' },
    ])
  })

  it('validates like a hand-written schema', () => {
    const result = validate(invoice, {
      rollNumber: '2027-0142', country: 'NP', district: 'Kaski', email: '', agree: true, discount: 5, days: ['mon'],
      items: [{ name: 'Tuition', qty: 1, rate: 9000 }, { name: 'Lab', qty: 2, rate: 1500 }],
    })
    expect(result.errors).toEqual({})
    expect(result.data.total).toBe(11400)
    expect(validate(invoice, { rollNumber: 'x' }).errors).toMatchObject({
      rollNumber: ['Use 2027-0142'],
      agree: ['Please tick "agree"'],
      items: ['items needs at least 1 item'],
      total: ['Total must be positive'],
    })
  })

  it('infers the data type', () => {
    type Data = InferData<typeof invoice>
    expectTypeOf<Data>().toEqualTypeOf<{
      rollNumber: string
      country: '' | 'NP' | 'IN'
      district: string
      email: string
      agree: boolean
      discount: number | null
      days: ('mon' | 'tue')[]
      items: { name: string; qty: number | null; rate: number | null; amount: number | null }[]
      total: number | null
    }>()
  })

  it('builds multi-step forms', () => {
    const wizard = form('Admission', [
      page('personal', 'Personal', [text('fullName').required()]),
      page('fees', 'Fees', [number('fee')]).visibleWhen('fullName != ""').description('What you owe'),
    ])
    expect(wizard.pages.map((p) => p.key)).toEqual(['personal', 'fees'])
    expect(wizard.pages[1]).toMatchObject({ title: 'Fees', visibleWhen: 'fullName != ""', description: 'What you owe' })
    expectTypeOf<InferData<typeof wizard>>().toEqualTypeOf<{ fullName: string; fee: number | null }>()
    expect(checkSchema(wizard)).toEqual([])
  })
})
