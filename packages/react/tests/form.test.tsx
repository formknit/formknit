import {
  address, calculated, checkbox, dateRange, form, lookup, messagesNe, number, page, rating, repeater, select, signature, slider,
  text, type FormSchema, type LookupQuery,
} from '@formknit/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { describeAdapter, Form, labelsNe, useField, useForm, useFormState, type FieldProps } from '../src'

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
    expect(screen.getByText('Please tick "I agree"')).toBeTruthy()
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
    expect(screen.queryByText('Please tick "I agree"')).toBeNull()

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

describe('appearance and layout', () => {
  it('applies size, variant, label and theme classes from props or the schema', () => {
    const schema = { ...form('A', [text('a').label('A').width(6).className('fx-hide-label'), text('b').label('B')]), appearance: { size: 'lg', variant: 'filled' } as const }
    const { container, rerender } = render(<Form schema={schema} />)
    const root = container.querySelector('form')!
    expect(root.className).toBe('fx-form fx-size-lg fx-variant-filled')
    const cells = container.querySelectorAll<HTMLElement>('.fx-cell')
    expect(cells[0].className).toBe('fx-cell fx-hide-label')
    expect(cells[0].style.getPropertyValue('--fx-span')).toBe('6')
    expect(cells[0].getAttribute('data-fx-path')).toBe('a')
    expect(cells[1].style.getPropertyValue('--fx-span')).toBe('')
    rerender(<Form schema={schema} size="sm" variant="outlined" labelPosition="left" theme="dark" className="mine" />)
    expect(root.className).toBe('fx-form fx-size-sm fx-labels-left fx-theme-dark mine')
  })
})

describe('lookups', () => {
  const fees = form('Fees', [
    text('rollNumber').label('Roll number'),
    lookup('studentName', { source: 'students', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'fullName' }).label('Student'),
  ])

  it('fetches when the matched value changes and ignores stale answers', async () => {
    const user = userEvent.setup()
    const answers: Record<string, (v: unknown) => void> = {}
    const lookupFn = vi.fn((q: LookupQuery) => new Promise<unknown>((resolve) => (answers[String(q.where.rollNo)] = resolve)))
    render(<Form schema={fees} lookup={lookupFn} lookupDelay={0} />)
    expect(lookupFn).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Roll number'), '1')
    await waitFor(() => expect(lookupFn).toHaveBeenCalledTimes(1))
    expect(lookupFn).toHaveBeenLastCalledWith({ source: 'students', where: { rollNo: '1' }, select: 'fullName', aggregate: 'first' })
    expect(screen.getByLabelText('Student').getAttribute('aria-busy')).toBe('true')

    await user.type(screen.getByLabelText('Roll number'), '2')
    await waitFor(() => expect(lookupFn).toHaveBeenCalledTimes(2))
    // The first answer arrives late and must not be shown.
    await act(async () => answers['1']('Wrong student'))
    expect(screen.getByLabelText('Student').textContent?.trim()).toBe('')
    await act(async () => answers['12']('Sita Sharma'))
    expect(screen.getByLabelText('Student').textContent).toBe('Sita Sharma')
    expect(screen.getByLabelText('Student').getAttribute('aria-busy')).toBeNull()

    await user.clear(screen.getByLabelText('Roll number'))
    await waitFor(() => expect(screen.getByLabelText('Student').textContent?.trim()).toBe(''))
    expect(lookupFn).toHaveBeenCalledTimes(2)
  })
})

describe('drafts and uploads', () => {
  const memory = () => {
    const data = new Map<string, string>()
    return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
  }
  const schema = form('Draft', [text('name').label('Name').required(), number('age').label('Age')])

  it('saves a draft, restores it and clears it after submit', async () => {
    const user = userEvent.setup()
    const storage = memory()
    const first = render(<Form schema={schema} draft={{ key: 'd1', storage, delay: 0 }} />)
    await user.type(screen.getByLabelText(/Name/), 'Sita')
    await waitFor(() => expect(JSON.parse(storage.data.get('d1')!)).toEqual({ name: 'Sita', age: null }))
    first.unmount()

    const onSubmit = vi.fn()
    render(<Form schema={schema} defaultValues={{ name: 'Default', age: 30 }} draft={{ key: 'd1', storage, delay: 0 }} onSubmit={onSubmit} />)
    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe('Sita')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Sita', age: null }))
    expect(storage.data.has('d1')).toBe(false)
  })

  it('ignores a corrupt draft', () => {
    const storage = memory()
    storage.data.set('d2', '{not json')
    render(<Form schema={schema} defaultValues={{ name: 'Default' }} draft={{ key: 'd2', storage }} />)
    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe('Default')
  })

  it('uploads a chosen file, keeps its details and lets it be removed', async () => {
    const user = userEvent.setup()
    const upload = form('U', [{ schema: { type: 'file', key: 'cv', label: 'CV', validate: { maxSizeMb: 1 } } } as never])
    const onUpload = vi.fn(async () => 'https://files.example/cv.pdf')
    const onSubmit = vi.fn()
    render(<Form schema={upload} onUpload={onUpload} onSubmit={onSubmit} />)
    const file = new File(['hello'], 'cv.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('CV'), file)
    await waitFor(() => expect(screen.getByText('cv.pdf')).toBeTruthy())
    expect(onUpload).toHaveBeenCalledWith(file)
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onSubmit).toHaveBeenCalledWith({ cv: { name: 'cv.pdf', size: 5, type: 'application/pdf', url: 'https://files.example/cv.pdf' } })
    await user.click(screen.getByRole('button', { name: 'Remove cv.pdf' }))
    expect(screen.getByLabelText('CV').getAttribute('type')).toBe('file')
  })
})

describe('rating and slider', () => {
  it('sets and clears a rating, and moves a slider', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Form schema={form('R', [rating('stars').label('Stars'), slider('volume').label('Volume').min(0).max(10)])} onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: '4 of 5' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ stars: 4 }), expect.anything())
    await user.click(screen.getByRole('radio', { name: '4 of 5' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ stars: null }), expect.anything())
    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '7' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ volume: 7 }), expect.anything())
  })
})

describe('date range, address, signature and translations', () => {
  const schema = form('F', [dateRange('stay').label('Stay').required(), address('home').label('Home'), signature('sign').label('Sign')])

  it('edits composite values and validates them', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Form schema={schema} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('Stay is required')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Stay start'), { target: { value: '2026-10-05' } })
    expect(screen.getByText('Stay needs both a start and an end date')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Stay end'), { target: { value: '2026-10-01' } })
    expect(screen.getByText('Stay cannot end before it starts')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Stay end'), { target: { value: '2026-10-09' } })

    await user.type(screen.getByLabelText('City'), 'Pokhara')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('Home needs at least a street and a city')).toBeTruthy()
    await user.type(screen.getByLabelText('Street address'), '12 Lake Road')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onSubmit).toHaveBeenCalledWith({
      stay: { start: '2026-10-05', end: '2026-10-09' },
      home: { line1: '12 Lake Road', line2: '', city: 'Pokhara', region: '', postcode: '', country: '' },
      sign: '',
    })
  })

  it('shows a saved signature and clears it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const png = 'data:image/png;base64,iVBORw0KGgo='
    render(<Form schema={schema} defaultValues={{ sign: png }} onChange={onChange} />)
    expect((screen.getByAltText('Sign (saved)') as HTMLImageElement).src).toBe(png)
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sign: '' }), expect.anything())
    expect(screen.getByRole('img', { name: /Sign: draw/ }).tagName).toBe('CANVAS')
  })

  it('speaks Nepali when given the Nepali messages and labels', async () => {
    const user = userEvent.setup()
    render(<Form schema={form('F', [text('name').label('नाम').required()])} compute={{ messages: messagesNe }} labels={labelsNe} />)
    await user.click(screen.getByRole('button', { name: 'पेस गर्नुहोस्' }))
    expect(screen.getByText('नाम आवश्यक छ')).toBeTruthy()
  })

  it('reports what an adapter covers', () => {
    const report = describeAdapter({ fields: { text: () => null }, layout: { panel: () => null } })
    expect(report.own).toEqual(['text', 'panel'])
    expect(report.fallback).toContain('signature')
    expect(report.missing).toEqual([])
  })
})
