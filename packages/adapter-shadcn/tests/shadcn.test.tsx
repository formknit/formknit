import { calculated, checkbox, checkboxGroup, form, number, radio, repeater, select, slider, text, toggle } from '@formknit/core'
import { describeAdapter, Form } from '@formknit/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shadcnAdapter } from '../registry/formknit'

afterEach(cleanup)

const schema = form('Admission', [
  text('fullName').label('Full name').required().description('As on your certificate'),
  select('country', { NP: 'Nepal', IN: 'India' }).label('Country').required(),
  text('district').label('District').visibleWhen('country == "NP"'),
  radio('programme', { bsc: 'BSc', bba: 'BBA' }).label('Programme'),
  checkboxGroup('days', { mon: 'Mon', tue: 'Tue' }).label('Days'),
  toggle('hostel').label('Hostel'),
  slider('confidence').label('Confidence').min(0).max(10),
  repeater('items', [number('qty').label('Qty').default(2), number('rate').label('Rate'), calculated('amount', 'qty * rate').label('Amount')]).label('Items'),
  calculated('total', 'SUM(items.amount)').label('Total'),
  checkbox('agree').label('I agree').required(),
])

describe('shadcn/ui adapter', () => {
  // These tests use stand-ins for the shadcn components with the same props, so they check
  // the adapter's wiring. They do not check how real shadcn components look or behave.
  it('wires every component to the form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { container } = render(<Form schema={schema} components={shadcnAdapter} onSubmit={onSubmit} />)
    expect(container.querySelector('.fx-input')).toBeNull()
    expect(screen.getByText('As on your certificate').id).toBe(screen.getByLabelText(/Full name/).getAttribute('aria-describedby'))

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('Full name is required')).toBeTruthy()
    expect(screen.getByText('Country is required')).toBeTruthy()
    expect(screen.getByText('Please tick "I agree"')).toBeTruthy()
    expect(screen.getByLabelText(/Full name/).getAttribute('aria-invalid')).toBe('true')

    await user.type(screen.getByLabelText(/Full name/), 'Sita Sharma')
    await user.click(screen.getByRole('option', { name: 'Nepal' }))
    await user.type(screen.getByLabelText('District'), 'Kaski')
    await user.click(screen.getByRole('radio', { name: 'BBA' }))
    await user.click(screen.getByRole('checkbox', { name: 'Tue' }))
    await user.click(screen.getByRole('switch', { name: 'Hostel' }))
    fireEvent.change(screen.getByLabelText('Confidence'), { target: { value: '7' } })
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.type(screen.getByLabelText('Rate'), '1500')
    expect((screen.getByLabelText('Total') as HTMLInputElement).value).toBe('3000')
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledWith({
      fullName: 'Sita Sharma', country: 'NP', district: 'Kaski', programme: 'bba', days: ['tue'], hostel: true, confidence: 7,
      items: [{ qty: 2, rate: 1500, amount: 3000 }], total: 3000, agree: true,
    })
  })

  it('covers the common fields and leaves the rest to the built-in skin', () => {
    const report = describeAdapter(shadcnAdapter)
    expect(report.missing).toEqual([])
    expect(report.fallback.sort()).toEqual(['address', 'columns', 'content', 'dateRange', 'divider', 'hidden', 'rating', 'signature'])
  })
})
