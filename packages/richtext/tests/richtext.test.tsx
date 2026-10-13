import { form, richText, text, type FormSchema } from '@formknit/core'
import { defaultAdapter, Form } from '@formknit/react'
import type { Editor } from '@tiptap/react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRichTextField, parseToolbar, RichTextView, withRichText } from '../src'

afterEach(cleanup)

// jsdom has no layout, which the editor asks about when it scrolls the cursor into view.
const noRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList
Range.prototype.getClientRects = noRects
Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) })
Element.prototype.getClientRects = noRects
document.elementFromPoint = () => null

const schema = form('Post', [text('title').label('Title'), richText('body').label('Body').description('Say something').required()])

async function mount(options: Parameters<typeof createRichTextField>[0] = {}, s: FormSchema = schema, initial: Record<string, unknown> = {}) {
  let editor: Editor | undefined
  const onSubmit = vi.fn()
  const adapter = withRichText(defaultAdapter, { ...options, onReady: (e) => (editor = e) })
  render(<Form schema={s} components={adapter} defaultValues={initial} onSubmit={onSubmit} />)
  await waitFor(() => expect(editor).toBeDefined())
  return { editor: editor!, onSubmit }
}

describe('rich text field', () => {
  it('is a labelled text box with a toolbar', async () => {
    await mount()
    const box = screen.getByRole('textbox', { name: /Body/ })
    expect(box.getAttribute('aria-multiline')).toBe('true')
    expect(box.getAttribute('aria-required')).toBe('true')
    expect(box.getAttribute('aria-describedby')).toContain('-desc')
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeTruthy()
    for (const name of ['Bold', 'Italic', 'Underline', 'Heading', 'Bulleted list', 'Numbered list', 'Quote', 'Link', 'Undo', 'Redo']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('shows the stored value and submits what is typed as clean HTML', async () => {
    const { editor, onSubmit } = await mount({}, schema, { body: '<p>Hello</p>' })
    expect(screen.getByRole('textbox', { name: /Body/ }).textContent).toBe('Hello')
    act(() => {
      editor.commands.setContent('<p>Hello <strong>world</strong></p><script>alert(1)</script>', { emitUpdate: true })
    })
    act(() => screen.getByRole('button', { name: 'Submit' }).click())
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].body).toBe('<p>Hello <strong>world</strong></p>')
  })

  it('formats with the toolbar and shows which buttons are on', async () => {
    const { editor } = await mount({}, schema, { body: '<p>Hello</p>' })
    act(() => {
      editor.commands.selectAll()
    })
    act(() => screen.getByRole('button', { name: 'Bold' }).click())
    expect(editor.getHTML()).toBe('<p><strong>Hello</strong></p>')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('true'))
    act(() => screen.getByRole('button', { name: 'Bulleted list' }).click())
    expect(editor.getHTML()).toContain('<ul>')
  })

  it('adds, changes and removes a link', async () => {
    const { editor } = await mount({}, schema, { body: '<p>Hello</p>' })
    act(() => {
      editor.commands.selectAll()
    })
    act(() => screen.getByRole('button', { name: 'Link' }).click())
    const box = screen.getByRole('textbox', { name: 'Link address' })
    fireEvent.change(box, { target: { value: 'example.com/a' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(editor.getHTML()).toContain('href="https://example.com/a"')
    expect(screen.queryByRole('textbox', { name: 'Link address' })).toBeNull()

    act(() => screen.getByRole('button', { name: 'Link' }).click())
    expect((screen.getByRole('textbox', { name: 'Link address' }) as HTMLInputElement).value).toBe('https://example.com/a')
    act(() => screen.getByRole('button', { name: 'Remove link' }).click())
    expect(editor.getHTML()).toBe('<p>Hello</p>')

    // With the cursor in empty space, the address itself becomes the linked text.
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    })
    act(() => screen.getByRole('button', { name: 'Link' }).click())
    fireEvent.change(screen.getByRole('textbox', { name: 'Link address' }), { target: { value: 'https://x.test' } })
    act(() => screen.getByRole('button', { name: 'Apply' }).click())
    expect(editor.getHTML()).toContain('<a target="_blank" rel="noopener noreferrer nofollow" href="https://x.test">https://x.test</a>')
  })

  it('reports an empty editor as empty, so "required" works', async () => {
    const { editor, onSubmit } = await mount({}, schema, { body: '<p>Hello</p>' })
    act(() => {
      editor.commands.clearContent(true)
    })
    act(() => screen.getByRole('button', { name: 'Submit' }).click())
    await waitFor(() => expect(screen.getByText(/Body is required/)).toBeTruthy())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('lets a field, or the app, choose the buttons and add its own', async () => {
    const shout = vi.fn()
    const custom = form('Post', [richText('body').label('Body').set({ toolbar: 'bold, shout' })])
    await mount({ toolbar: ['italic'], items: { shout: { label: 'Shout', icon: '<path d="M4 12h16"/>', run: shout } } }, custom)
    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Italic' })).toBeNull()
    act(() => screen.getByRole('button', { name: 'Shout' }).click())
    expect(shout).toHaveBeenCalled()
  })

  it('uses the app-wide toolbar when the field has none, and can hide it', async () => {
    await mount({ toolbar: [] })
    expect(screen.queryByRole('toolbar')).toBeNull()
  })
})

describe('helpers', () => {
  it('reads a toolbar from a list or from text', () => {
    expect(parseToolbar('bold, italic | link')).toEqual(['bold', 'italic', '|', 'link'])
    expect(parseToolbar(['bold'])).toEqual(['bold'])
    expect(parseToolbar('')).toBeUndefined()
    expect(parseToolbar(undefined)).toBeUndefined()
  })

  it('shows stored text safely', () => {
    const { container } = render(<RichTextView html={'<p>Hi <strong>there</strong></p><img src=x onerror="alert(1)">'} />)
    expect(container.querySelector('strong')?.textContent).toBe('there')
    expect(container.querySelector('img')).toBeNull()
  })
})
