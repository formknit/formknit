import {
  address, calculated, checkbox, checkboxGroup, columns, content, date, dateRange, divider, email, field, form, number, page, panel, phone, radio,
  rating, repeater, richText, select, signature, slider, text, textarea, time, toggle, url,
} from '@formknit/core'
import { act, cleanup, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, describe, expect, it } from 'vitest'
import { Form } from '../src'

afterEach(cleanup)

// jsdom cannot measure colours or layout, so those checks are left to a real browser.
const check = async (node: Element) => {
  const result = await axe.run(node, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
  return result.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`)
}

const everything = form('Everything', [
  text('name').label('Name').required().description('As on your passport'),
  textarea('bio').label('Bio'),
  richText('about').label('About'),
  email('email').label('Email'),
  phone('phone').label('Phone'),
  url('site').label('Website'),
  number('age').label('Age'),
  date('born').label('Born'),
  time('at').label('Time'),
  dateRange('stay').label('Stay'),
  address('home').label('Home'),
  select('country', { NP: 'Nepal', IN: 'India' }).label('Country'),
  radio('plan', { a: 'A', b: 'B' }).label('Plan').required(),
  checkboxGroup('likes', { x: 'X', y: 'Y' }).label('Likes'),
  checkbox('agree').label('I agree').required(),
  toggle('news').label('Newsletter'),
  rating('stars').label('Stars'),
  slider('level').label('Level').min(0).max(10),
  field('file', 'cv', { label: 'CV' }),
  signature('sign').label('Signature'),
  calculated('double', 'age * 2').label('Double'),
  panel('Group', [columns([text('a').label('A')], [text('b').label('B')])]),
  repeater('items', [text('item').label('Item'), number('qty').label('Qty')]).label('Items'),
  content('A heading', { heading: true }),
  content('Some text'),
  divider(),
])

describe('accessibility', () => {
  it('uses a checker that does catch problems', async () => {
    const { container } = render(<div><img src="x.png" /><input type="text" /></div>)
    expect((await check(container)).map((v) => v.split(':')[0]).sort()).toEqual(['image-alt', 'label'])
  })

  it('has no detectable problems in any field type, empty or with errors', async () => {
    const { container } = render(<Form schema={everything} defaultValues={{ items: [{ item: 'x', qty: 1 }] }} />)
    expect(await check(container)).toEqual([])
    act(() => screen.getByRole('button', { name: 'Submit' }).click())
    expect(await check(container)).toEqual([])
  })

  it('has none in a multi-page form, in each theme and size', async () => {
    const paged = form('Paged', [page('one', 'One', [text('a').label('A').required()]), page('two', 'Two', [text('b').label('B')])])
    const { container } = render(<Form schema={paged} theme="dark" size="lg" labelPosition="left" variant="underline" />)
    expect(await check(container)).toEqual([])
  })

  it('ties every error to its control', () => {
    render(<Form schema={everything} />)
    act(() => screen.getByRole('button', { name: 'Submit' }).click())
    const name = screen.getByLabelText(/^Name/)
    expect(name.getAttribute('aria-invalid')).toBe('true')
    const ids = name.getAttribute('aria-describedby')!.split(' ')
    expect(ids.map((id) => document.getElementById(id)?.textContent).join(' ')).toMatch(/passport.*required/)
  })
})
