import { calculated, checkbox, checkboxGroup, form, number, page, radio, repeater, select, text, toggle } from '@formknit/core'
import { Form } from '@formknit/react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { muiAdapter } from '../src'

afterEach(cleanup)

const schema = form('Admission', [
  page('one', 'Details', [
    text('fullName').label('Full name').required().minLength(3),
    select('country', { NP: 'Nepal', IN: 'India' }).label('Country').required(),
    text('district').label('District').visibleWhen('country == "NP"'),
    radio('programme', { bsc: 'BSc', bba: 'BBA' }).label('Programme'),
    checkboxGroup('days', { mon: 'Mon', tue: 'Tue' }).label('Days'),
    toggle('hostel').label('Hostel'),
  ]),
  page('two', 'Fees', [
    repeater('items', [number('qty').label('Qty').default(2), number('rate').label('Rate'), calculated('amount', 'qty * rate').label('Amount')]).label('Items').minItems(1),
    calculated('total', 'SUM(items.amount)').label('Total'),
    checkbox('agree').label('I agree').required(),
  ]),
])

describe('Material UI adapter', () => {
  it('renders every field with Material UI and runs a whole form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { container } = render(<Form schema={schema} components={muiAdapter} onSubmit={onSubmit} />)
    expect(container.querySelector('.MuiTextField-root')).toBeTruthy()
    expect(container.querySelector('.MuiStepper-root')).toBeTruthy()
    expect(container.querySelector('.fx-input')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Full name is required')).toBeTruthy()
    expect(screen.getByText('Country is required')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /Full name/ }).getAttribute('aria-invalid')).toBe('true')

    await user.type(screen.getByRole('textbox', { name: /Full name/ }), 'Sita Sharma')
    await user.click(screen.getByRole('combobox', { name: /Country/ }))
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Nepal' }))
    await user.type(screen.getByRole('textbox', { name: /District/ }), 'Kaski')
    await user.click(screen.getByRole('radio', { name: 'BBA' }))
    await user.click(screen.getByRole('checkbox', { name: 'Tue' }))
    await user.click(screen.getByRole('switch', { name: 'Hostel' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('Items needs at least 1 item')).toBeTruthy()
    expect(screen.getByText('Please tick "I agree"')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.type(screen.getByRole('textbox', { name: 'Rate' }), '1500')
    expect((screen.getByRole('textbox', { name: 'Total' }) as HTMLInputElement).value).toBe('3000')
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledWith({
      fullName: 'Sita Sharma', country: 'NP', district: 'Kaski', programme: 'bba', days: ['tue'], hostel: true,
      items: [{ qty: 2, rate: 1500, amount: 3000 }], total: 3000, agree: true,
    })
  })
})
