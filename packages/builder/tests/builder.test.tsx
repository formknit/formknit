import { checkbox, defineField, field, form, number, select, text, validate, type FormSchema, type InferData } from '@formknit/core'
import type { FieldProps } from '@formknit/react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { FormBuilder, registerBuilderField } from '../src'

afterEach(cleanup)

function setup(start?: FormSchema) {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<FormBuilder defaultValue={start} onChange={onChange} />)
  const latest = (): FormSchema => onChange.mock.calls[onChange.mock.calls.length - 1][0]
  const palette = within(screen.getByRole('navigation', { name: 'Fields' }))
  const settings = () => within(screen.getByRole('complementary', { name: 'Settings' }))
  return { user, onChange, latest, palette, settings }
}

describe('<FormBuilder>', () => {
  it('adds fields from the palette and selects them', async () => {
    const { user, latest, palette, settings } = setup()
    await user.click(palette.getByRole('button', { name: /^Text$/ }))
    await user.click(palette.getByRole('button', { name: /^Number$/ }))
    expect(latest().pages[0].components).toEqual([
      { type: 'text', label: 'Text', key: 'text' },
      { type: 'number', label: 'Number', key: 'number' },
    ])
    expect(screen.getByRole('button', { name: 'Number: Number' }).getAttribute('aria-pressed')).toBe('true')
    expect(settings().getByLabelText('Label')).toBeTruthy()
  })

  it('edits settings; the key follows the label until edited by hand', async () => {
    const { user, latest, palette, settings } = setup()
    await user.click(palette.getByRole('button', { name: /^Text$/ }))
    const label = settings().getByLabelText('Label')
    await user.clear(label)
    await user.type(label, 'Full name')
    expect(latest().pages[0].components[0]).toMatchObject({ label: 'Full name', key: 'fullName' })
    expect((settings().getByLabelText('Field key') as HTMLInputElement).value).toBe('fullName')

    const key = settings().getByLabelText('Field key')
    await user.clear(key)
    expect(settings().getByRole('alert').textContent).toMatch(/letters, digits/)
    await user.type(key, 'applicant')
    await user.type(settings().getByLabelText('Label'), 's')
    expect(latest().pages[0].components[0]).toMatchObject({ label: 'Full names', key: 'applicant' })

    await user.type(settings().getByLabelText('Placeholder'), 'e.g. Sita')
    await user.click(settings().getByRole('tab', { name: 'Validation' }))
    await user.click(settings().getByLabelText('Required'))
    await user.type(settings().getByLabelText('Minimum length'), '3')
    expect(latest().pages[0].components[0]).toEqual({
      type: 'text', label: 'Full names', key: 'applicant', placeholder: 'e.g. Sita', validate: { required: true, minLength: 3 },
    })
    await user.click(settings().getByLabelText('Required'))
    await user.clear(settings().getByLabelText('Minimum length'))
    expect(latest().pages[0].components[0]).not.toHaveProperty('validate')
  })

  it('refuses a key another field uses', async () => {
    const { user, onChange, settings } = setup(form('F', [text('a'), text('b')]))
    await user.click(screen.getByRole('button', { name: 'Text: b' }))
    const key = settings().getByLabelText('Field key')
    await user.clear(key)
    await user.type(key, 'a')
    expect(settings().getByRole('alert').textContent).toMatch(/already uses/)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('moves, duplicates and deletes', async () => {
    const { user, latest } = setup(form('F', [text('a').label('A'), text('b').label('B'), text('c').label('C')]))
    const keys = () => latest().pages[0].components.map((c) => c.key)
    await user.click(screen.getByRole('button', { name: 'Text: A' }))
    expect((screen.getByRole('button', { name: 'Move up: A' }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Move down: A' }))
    expect(keys()).toEqual(['b', 'a', 'c'])
    expect(screen.getByRole('button', { name: 'Text: A' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Duplicate: A' }))
    expect(keys()).toEqual(['b', 'a', 'a2', 'c'])
    await user.click(screen.getByRole('button', { name: 'Delete: A' }))
    expect(keys()).toEqual(['b', 'a', 'c'])
    screen.getByRole('button', { name: 'Text: C' }).focus()
    await user.keyboard('{Delete}')
    expect(keys()).toEqual(['b', 'a'])
  })

  it('undoes and redoes, treating one burst of typing as a single step', async () => {
    const { user, latest, palette, settings } = setup()
    await user.click(palette.getByRole('button', { name: /^Text$/ }))
    await user.type(settings().getByLabelText('Placeholder'), 'abc')
    expect(latest().pages[0].components[0].placeholder).toBe('abc')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(latest().pages[0].components[0]).not.toHaveProperty('placeholder')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(latest().pages[0].components).toEqual([])
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(latest().pages[0].components[0].placeholder).toBe('abc')
  })

  it('drops a palette field and moves a field into a panel by dragging', async () => {
    const { latest, palette } = setup(form('F', [text('a').label('A')]))
    const pageList = () => screen.getByRole('button', { name: 'Text: A' }).parentElement!
    fireEvent.dragStart(palette.getByRole('button', { name: /^Panel$/ }))
    fireEvent.dragOver(pageList())
    fireEvent.drop(pageList())
    expect(latest().pages[0].components.map((c) => c.type)).toEqual(['text', 'panel'])

    const inside = screen.getByText('Drop fields into this group').parentElement!
    fireEvent.dragStart(screen.getByRole('button', { name: 'Text: A' }))
    fireEvent.dragOver(inside)
    fireEvent.drop(inside)
    expect(latest().pages[0].components).toEqual([{ type: 'panel', label: 'Panel', components: [{ type: 'text', key: 'a', label: 'A' }] }])

    // A container cannot be dropped inside itself.
    const nested = screen.getByRole('button', { name: 'Text: A' }).parentElement!
    const before = latest()
    fireEvent.dragStart(screen.getByRole('button', { name: 'Panel: Panel' }))
    fireEvent.dragOver(nested)
    fireEvent.drop(nested)
    expect(latest()).toBe(before)
  })

  it('builds a show-when rule and writes it as an expression', async () => {
    const { user, latest, settings } = setup(form('F', [select('country', { NP: 'Nepal', IN: 'India' }).label('Country'), number('age').label('Age'), checkbox('agree').label('Agree'), text('district').label('District')]))
    await user.click(screen.getByRole('button', { name: 'Text: District' }))
    await user.click(settings().getByRole('tab', { name: 'Logic' }))
    await user.click(settings().getByRole('button', { name: '+ Add rule' }))
    await user.selectOptions(settings().getByLabelText('Rule 1 field'), 'country')
    await user.type(settings().getByLabelText('Rule 1 value'), 'NP')
    expect(latest().pages[0].components[3].visibleWhen).toBe('country == "NP"')

    await user.click(settings().getByRole('button', { name: '+ Add rule' }))
    await user.selectOptions(settings().getByLabelText('Rule 2 field'), 'age')
    await user.selectOptions(settings().getByLabelText('Rule 2 comparison'), 'gte')
    await user.type(settings().getByLabelText('Rule 2 value'), '16')
    expect(latest().pages[0].components[3].visibleWhen).toBe('country == "NP" AND age >= 16')
    await user.click(settings().getByRole('button', { name: 'Any of these' }))
    expect(latest().pages[0].components[3].visibleWhen).toBe('country == "NP" OR age >= 16')

    await user.click(settings().getByRole('button', { name: '+ Add rule' }))
    await user.selectOptions(settings().getByLabelText('Rule 3 field'), 'agree')
    expect(latest().pages[0].components[3].visibleWhen).toBe('country == "NP" OR age >= 16 OR agree == true')
    expect(screen.getByText('Conditional')).toBeTruthy()

    await user.click(settings().getByRole('button', { name: 'Remove rule 1' }))
    await user.click(settings().getByRole('button', { name: 'Remove rule 1' }))
    await user.click(settings().getByRole('button', { name: 'Remove rule 1' }))
    expect(latest().pages[0].components[3]).not.toHaveProperty('visibleWhen')
  })

  it('builds a nested group of rules', async () => {
    const { user, latest, settings } = setup(form('F', [select('country', { NP: 'Nepal' }).label('Country'), number('age').label('Age'), checkbox('consent').label('Consent'), text('district').label('District')]))
    await user.click(screen.getByRole('button', { name: 'Text: District' }))
    await user.click(settings().getByRole('tab', { name: 'Logic' }))
    await user.click(settings().getByRole('button', { name: '+ Add rule' }))
    await user.selectOptions(settings().getByLabelText('Rule 1 field'), 'country')
    await user.type(settings().getByLabelText('Rule 1 value'), 'NP')
    await user.click(settings().getByRole('button', { name: '+ Add group' }))
    await user.selectOptions(settings().getByLabelText('Group rule 1 field'), 'age')
    await user.selectOptions(settings().getByLabelText('Group rule 1 comparison'), 'gte')
    await user.type(settings().getByLabelText('Group rule 1 value'), '16')
    expect(latest().pages[0].components[3].visibleWhen).toBe('country == "NP" AND age >= 16')
    await user.click(settings().getByRole('button', { name: '+ Add to group' }))
    await user.selectOptions(settings().getByLabelText('Group rule 2 field'), 'consent')
    expect(latest().pages[0].components[3].visibleWhen).toBe('country == "NP" AND (age >= 16 OR consent == true)')
    await user.click(settings().getByRole('button', { name: 'Remove group 2' }))
    expect(latest().pages[0].components[3].visibleWhen).toBe('country == "NP"')
  })

  it('sets width, appearance and lookup settings', async () => {
    const { user, latest, palette, settings } = setup()
    await user.selectOptions(settings().getByLabelText('Size'), 'lg')
    await user.selectOptions(settings().getByLabelText('Field style'), 'filled')
    expect(latest().appearance).toEqual({ size: 'lg', variant: 'filled' })
    await user.selectOptions(settings().getByLabelText('Size'), '')
    expect(latest().appearance).toEqual({ variant: 'filled' })

    await user.click(palette.getByRole('button', { name: /^Text$/ }))
    await user.selectOptions(settings().getByLabelText('Width'), '6')
    expect(latest().pages[0].components[0].width).toBe(6)
    expect(screen.getByText('50% wide')).toBeTruthy()
    await user.selectOptions(settings().getByLabelText('Width'), '')
    expect(latest().pages[0].components[0]).not.toHaveProperty('width')

    await user.click(palette.getByRole('button', { name: /^Lookup$/ }))
    expect(screen.getByText('1 problem')).toBeTruthy()
    await user.type(settings().getByLabelText('Data source'), 'students')
    await user.type(settings().getByLabelText('Field to match in the source'), 'rollNo')
    await user.type(settings().getByLabelText('Value to match'), 'text')
    await user.type(settings().getByLabelText('Field to return'), 'fullName')
    await user.selectOptions(settings().getByLabelText('If several records match'), 'sum')
    expect(latest().pages[0].components[1]).toEqual({
      type: 'lookup', label: 'Lookup', key: 'lookup', source: 'students', matchField: 'rollNo', matchValue: 'text', returnField: 'fullName', aggregate: 'sum',
    })
    expect(screen.getByText('No problems')).toBeTruthy()
  })

  it('drags a card by touch', () => {
    const { latest } = setup(form('F', [text('a').label('A'), text('b').label('B'), text('c').label('C')]))
    const card = (name: string) => screen.getByRole('button', { name: `Text: ${name}` })
    const list = card('A').parentElement!
    // jsdom has no layout, so place the three cards 100px apart and say which element is under the finger.
    ;['A', 'B', 'C'].forEach((name, i) => {
      card(name).getBoundingClientRect = () => ({ top: i * 100, height: 100 }) as DOMRect
    })
    document.elementFromPoint = () => list
    const touch = (y: number) => ({ touches: [{ clientX: 10, clientY: y }] })
    fireEvent.touchStart(card('A').querySelector('.fxb-grip')!)
    fireEvent.touchMove(document, touch(260))
    expect(document.querySelector('.fxb-indicator')).toBeTruthy()
    fireEvent.touchEnd(document)
    expect(latest().pages[0].components.map((c) => c.key)).toEqual(['b', 'c', 'a'])
    expect(document.querySelector('.fxb-indicator')).toBeNull()
  })

  it('edits options and formulas, and reports problems', async () => {
    const { user, latest, palette, settings } = setup()
    await user.click(palette.getByRole('button', { name: /^Select$/ }))
    const first = settings().getByLabelText('Option 1 label')
    await user.clear(first)
    await user.type(first, 'Nepal')
    await user.click(settings().getByRole('button', { name: '+ Add option' }))
    await user.click(settings().getByRole('button', { name: 'Remove option 2' }))
    expect(latest().pages[0].components[0].options).toEqual([
      { label: 'Nepal', value: 'nepal' },
      { label: 'Option 3', value: 'option3' },
    ])

    await user.click(palette.getByRole('button', { name: /^Calculated$/ }))
    const formula = settings().getByLabelText('Formula')
    await user.clear(formula)
    await user.type(formula, '1 +')
    expect(settings().getByRole('alert').textContent).toBe('Expression ends too early')
    expect(screen.getByText('1 problem')).toBeTruthy()
    await user.type(formula, ' 2')
    expect(settings().getByText('Formula is valid')).toBeTruthy()
    expect(screen.getByText('No problems')).toBeTruthy()
    // Inserts at the cursor, which is left between the brackets ready for typing.
    ;(formula as HTMLTextAreaElement).setSelectionRange(4, 5)
    await user.click(settings().getByRole('button', { name: 'SUM' }))
    expect(latest().pages[0].components[1].expression).toBe('1 + SUM()')
    await user.keyboard('2, 3')
    expect(latest().pages[0].components[1].expression).toBe('1 + SUM(2, 3)')
  })

  it('manages pages', async () => {
    const { user, latest, palette, settings } = setup()
    await user.click(screen.getByRole('button', { name: '+ Add page' }))
    expect(latest().pages.map((p) => p.key)).toEqual(['page1', 'page2'])
    expect(screen.getByRole('tab', { name: /Page 2/ }).getAttribute('aria-selected')).toBe('true')
    await user.click(palette.getByRole('button', { name: /^Text$/ }))
    expect(latest().pages[1].components).toHaveLength(1)

    await user.click(screen.getByRole('tab', { name: /Page 2/ }))
    const title = settings().getByLabelText('Page title')
    await user.clear(title)
    await user.type(title, 'Fees')
    expect(latest().pages[1].title).toBe('Fees')
    await user.click(settings().getByRole('button', { name: 'Move earlier' }))
    expect(latest().pages.map((p) => p.key)).toEqual(['page2', 'page1'])
    await user.click(settings().getByRole('button', { name: 'Delete page' }))
    expect(latest().pages.map((p) => p.key)).toEqual(['page1'])

    await user.type(settings().getByLabelText('Form title'), 'Admission')
    expect(latest().title).toBe('Admission')
  })

  it('previews the form and edits it as JSON', async () => {
    const start = form('Admission', [text('fullName').label('Full name').required()])
    const { user, latest } = setup(start)
    await user.click(screen.getByRole('tab', { name: 'Preview' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('Full name is required')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'JSON' }))
    const editor = screen.getByLabelText(/Schema JSON/) as HTMLTextAreaElement
    expect(JSON.parse(editor.value)).toEqual(start)
    fireEvent.change(editor, { target: { value: '{ "pages": ' } })
    expect(screen.getByRole('alert')).toBeTruthy()
    const next: FormSchema = { version: 1, pages: [{ key: 'main', components: [{ type: 'number', key: 'age', label: 'Age' }] }] }
    fireEvent.change(editor, { target: { value: JSON.stringify(next) } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(latest()).toEqual(next)
    expect(validate(latest(), { age: '7' }).data).toEqual({ age: 7 })
  })

  it('follows a controlled value', async () => {
    const a = form('A', [text('one')])
    const b = form('B', [text('two')])
    const { rerender } = render(<FormBuilder value={a} />)
    expect(screen.getByRole('button', { name: 'Text: one' })).toBeTruthy()
    rerender(<FormBuilder value={b} />)
    expect(screen.getByRole('button', { name: 'Text: two' })).toBeTruthy()
  })

  it('supports a custom field type end to end, as the guide describes', async () => {
    defineField({
      type: 'colour',
      kind: 'input',
      label: 'Colour',
      group: 'Basic',
      emptyValue: '',
      coerce: (v) => (typeof v === 'string' ? v.toLowerCase() : ''),
      check: (value, _c, label) => (/^#[0-9a-f]{6}$/.test(String(value)) ? null : `${label} must be a colour like #1a2b3c`),
    })
    registerBuilderField('colour', {
      icon: '<circle cx="12" cy="12" r="9"/>',
      defaults: () => ({ label: 'Colour' }),
      settings: [{ path: 'palette', label: 'Palette name', input: 'text', tab: 'display' }],
    })
    const ColourField = (p: FieldProps<string>) => <input aria-label={p.label} data-testid="colour-preview" value={p.value || '#000000'} onChange={(e) => p.onChange(e.target.value)} />

    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FormBuilder onChange={onChange} components={{ fields: { colour: ColourField } }} />)
    await user.click(within(screen.getByRole('navigation', { name: 'Fields' })).getByRole('button', { name: /^Colour$/ }))
    expect(screen.getByTestId('colour-preview')).toBeTruthy()
    await user.type(within(screen.getByRole('complementary', { name: 'Settings' })).getByLabelText('Palette name'), 'brand')
    const built: FormSchema = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(built.pages[0].components[0]).toEqual({ type: 'colour', label: 'Colour', key: 'colour', palette: 'brand' })

    expect(validate(built, { colour: '#1A2B3C' }).data).toEqual({ colour: '#1a2b3c' })
    expect(validate(built, { colour: 'red' }).errors).toEqual({ colour: ['Colour must be a colour like #1a2b3c'] })

    const typed = form('Brand', [field<'brand', string>('colour', 'brand', { label: 'Brand colour' })])
    expectTypeOf<InferData<typeof typed>>().toEqualTypeOf<{ brand: string }>()
  })
})
