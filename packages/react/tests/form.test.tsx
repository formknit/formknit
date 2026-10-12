import { calculated, checkbox, form, number, page, repeater, select, text, type FormSchema } from '@formknit/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { Form, useField, useForm, useFormState, type FieldProps } from '../src'

afterEach(cleanup)

const admission = form('Admission form', [
  text('fullName').label('Full name').required().minLength(3),
  select('country', { NP: 'Nepal', IN: 'India' }).label('Country').required(),
  text('district').label('District').visibleWhen('country == "NP"').required(),
  number('age').label('Age').min(16),
  checkbox('agree').label('I agree').required(),
])

describe('<Form>', () => {
  it('renders fields with accessible labels', () => {
    render(<Form schema={admission} />)
    expect(screen.getByRole('heading', { name: 'Admission form' })).toBeTruthy()
    expect(screen.getByLabelText(/Full name/)).toBeTruthy()
    expect(screen.getByLabelText(/Country/)).toBeTruthy()
    expect(screen.getByLabelText(/I agree/)).toBeTruthy()
    expect(screen.queryByLabelText(/District/)).toBeNull()
  })

  it('shows and hides conditional fields', async () => {
    const user = userEvent.setup()
    render(<Form schema={admission} />)
    await user.selectOptions(screen.getByLabelText(/Country/), 'NP')
    expect(screen.getByLabelText(/District/)).toBeTruthy()
    await user.selectOptions(screen.getByLabelText(/Country/), 'IN')
    expect(screen.queryByLabelText(/District/)).toBeNull()
  })

  it('shows an error only after the field is visited', async () => {
    const user = userEvent.setup()
    render(<Form schema={admission} />)
    expect(screen.queryByText('Full name is required')).toBeNull()
    await user.click(screen.getByLabelText(/Full name/))
    await user.tab()
    expect(screen.getByText('Full name is required')).toBeTruthy()
    await user.type(screen.getByLabelText(/Full name/), 'Si')
    expect(screen.getByText('Full name must be at least 3 characters')).toBeTruthy()
    await user.type(screen.getByLabelText(/Full name/), 'ta')
    expect(screen.queryByText(/Full name must/)).toBeNull()
    expect(screen.getByLabelText(/Full name/).getAttribute('aria-invalid')).toBe('false')
  })

  it('blocks an invalid submit, shows every error and focuses the first', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Form schema={admission} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Full name is required')).toBeTruthy()
    expect(screen.getByText('Country is required')).toBeTruthy()
    expect(screen.getByText('I agree is required')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText(/Full name/))
  })

  it('submits cleaned, typed data', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form
        schema={admission}
        onSubmit={(data) => {
          expectTypeOf(data.age).toEqualTypeOf<number | null>()
          expectTypeOf(data.country).toEqualTypeOf<'' | 'NP' | 'IN'>()
          onSubmit(data)
        }}
      />,
    )
    await user.type(screen.getByLabelText(/Full name/), 'Sita Sharma')
    await user.selectOptions(screen.getByLabelText(/Country/), 'NP')
    await user.type(screen.getByLabelText(/District/), 'Kaski')
    await user.type(screen.getByLabelText(/Age/), '18.0')
    expect((screen.getByLabelText(/Age/) as HTMLInputElement).value).toBe('18.0')
    await user.click(screen.getByLabelText(/I agree/))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onSubmit).toHaveBeenCalledWith({ fullName: 'Sita Sharma', country: 'NP', district: 'Kaski', age: 18, agree: true })
  })

  it('starts from default values and reports changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Form schema={admission} defaultValues={{ fullName: 'Sita', country: 'NP' }} onChange={onChange} />)
    expect((screen.getByLabelText(/Full name/) as HTMLInputElement).value).toBe('Sita')
    expect(screen.getByLabelText(/District/)).toBeTruthy()
    await user.type(screen.getByLabelText(/District/), 'K')
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ district: 'K' }), expect.objectContaining({ valid: false }))
  })
})

const invoice = form('Fee invoice', [
  number('discount').label('Discount %'),
  repeater('items', [
    text('name').label('Item').required(),
    number('qty').label('Qty').default(1),
    number('rate').label('Rate'),
    calculated('amount', 'qty * rate').label('Amount'),
  ])
    .label('Items')
    .minItems(1)
    .maxItems(2),
  calculated('total', 'ROUND(SUM(items.amount) * (1 - discount / 100), 2)').label('Total'),
])

describe('repeaters and calculations', () => {
  it('adds rows, recalculates live and removes rows', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Form schema={invoice} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('Items needs at least 1 item')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '+ Add' }))
    expect((screen.getByLabelText(/Qty/) as HTMLInputElement).value).toBe('1')
    await user.type(screen.getByLabelText(/Item/), 'Tuition')
    await user.type(screen.getByLabelText(/Rate/), '9000')
    expect(screen.getByLabelText('Amount').textContent).toBe('9000')
    expect(screen.getByLabelText('Total').textContent).toBe('9000')

    await user.click(screen.getByRole('button', { name: '+ Add' }))
    expect(screen.queryByRole('button', { name: '+ Add' })).toBeNull()
    const rates = screen.getAllByLabelText(/Rate/)
    await user.type(screen.getAllByLabelText(/Item/)[1], 'Lab')
    await user.clear(screen.getAllByLabelText(/Qty/)[1])
    await user.type(screen.getAllByLabelText(/Qty/)[1], '2')
    await user.type(rates[1], '1500')
    await user.type(screen.getByLabelText(/Discount/), '5')
    expect(screen.getByLabelText('Total').textContent).toBe('11400')

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onSubmit).toHaveBeenCalledWith({
      discount: 5,
      items: [
        { name: 'Tuition', qty: 1, rate: 9000, amount: 9000 },
        { name: 'Lab', qty: 2, rate: 1500, amount: 3000 },
      ],
      total: 11400,
    })

    await user.click(screen.getByRole('button', { name: 'Remove (1)' }))
    expect(screen.getAllByLabelText(/Item/)).toHaveLength(1)
    expect((screen.getByLabelText(/Item/) as HTMLInputElement).value).toBe('Lab')
    expect(screen.getByLabelText('Total').textContent).toBe('2850')
  })
})

const wizard = form('Admission', [
  page('personal', 'Personal', [text('fullName').label('Full name').required(), checkbox('needsHostel').label('I need a hostel room')]),
  page('hostel', 'Hostel', [text('room').label('Room type').required()]).visibleWhen('needsHostel'),
  page('confirm', 'Confirm', [checkbox('agree').label('I agree').required()]),
])

describe('multi-step forms', () => {
  it('validates each step, skips hidden pages and goes back', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Form schema={wizard} onSubmit={onSubmit} />)
    expect(screen.getByText('Step 1 of 2')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Full name is required')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Personal' })).toBeTruthy()

    await user.type(screen.getByLabelText(/Full name/), 'Sita')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Confirm' })).toBeTruthy()
    expect(screen.queryByText('I agree is required')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByLabelText(/hostel room/))
    expect(screen.getByText('Step 1 of 3')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Hostel' })).toBeTruthy()
    await user.type(screen.getByLabelText(/Room type/), 'Single')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByLabelText(/I agree/))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onSubmit).toHaveBeenCalledWith({ fullName: 'Sita', needsHostel: true, room: 'Single', agree: true })
  })
})

describe('adapters and headless use', () => {
  it('renders a field with a custom component', async () => {
    const user = userEvent.setup()
    const Shout = (p: FieldProps<string>) => (
      <label>
        {p.label?.toUpperCase()}
        <input data-testid="custom" value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} onBlur={p.onBlur} />
        {p.error && <b>{p.error}</b>}
      </label>
    )
    render(<Form schema={admission} components={{ fields: { text: Shout } }} />)
    await user.type(screen.getAllByTestId('custom')[0], 'Si')
    await user.tab()
    expect(screen.getByText('FULL NAME')).toBeTruthy()
    expect(screen.getByText('Full name must be at least 3 characters')).toBeTruthy()
    expect(screen.getByLabelText(/Country/).tagName).toBe('SELECT')
  })

  it('reports unknown field types instead of crashing', () => {
    const schema: FormSchema = { version: 1, pages: [{ key: 'main', components: [{ type: 'sparkle', key: 'x' }] }] }
    render(<Form schema={schema} />)
    expect(screen.getByText('Unknown field type "sparkle"')).toBeTruthy()
  })

  it('works without <Form>', async () => {
    const user = userEvent.setup()
    function Headless() {
      const f = useForm(admission)
      const state = useFormState(f)
      const name = useField('fullName', f)
      return (
        <div>
          <input aria-label="name" value={String(name.value ?? '')} onChange={(e) => name.setValue(e.target.value)} />
          <output data-testid="valid">{String(state.state.valid)}</output>
          <output data-testid="errors">{name.errors.join(',')}</output>
        </div>
      )
    }
    render(<Headless />)
    expect(screen.getByTestId('errors').textContent).toBe('Full name is required')
    await user.type(screen.getByLabelText('name'), 'Sita')
    expect(screen.getByTestId('errors').textContent).toBe('')
    expect(screen.getByTestId('valid').textContent).toBe('false')
  })

  it('re-renders only the field that changed', async () => {
    const user = userEvent.setup()
    const renders: Record<string, number> = {}
    const Counting = (p: FieldProps<string>) => {
      renders[p.path] = (renders[p.path] ?? 0) + 1
      return <input aria-label={p.label} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} />
    }
    const schema = form('Two', [text('a').label('A'), text('b').label('B')])
    render(<Form schema={schema} components={{ fields: { text: Counting } }} />)
    const before = { ...renders }
    await user.type(within(document.body).getByLabelText('A'), 'xyz')
    expect(renders.a - before.a).toBe(3)
    expect(renders.b - before.b).toBe(0)
  })
})
