import { form, number, panel, repeater, select, text } from '@formknit/core'
import { act, cleanup, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, describe, expect, it } from 'vitest'
import { FormBuilder } from '../src'

afterEach(cleanup)

// jsdom cannot measure colours or layout, so those checks are left to a real browser.
const check = async (node: Element) => {
  const result = await axe.run(node, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
  return result.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.html.slice(0, 140)).join(' | ')}`)
}

const schema = form('Order', [
  text('name').label('Name').required(),
  select('size', { s: 'Small', l: 'Large' }).label('Size'),
  panel('Details', [number('qty').label('Qty')]),
  repeater('items', [text('item').label('Item')]).label('Items'),
])

describe('builder accessibility', () => {
  it('has no detectable problems on the canvas, with a field selected, or in preview', async () => {
    const { container } = render(<FormBuilder defaultValue={schema} />)
    expect(await check(container)).toEqual([])
    // Selecting a field opens its settings.
    act(() => screen.getByRole('group', { name: 'Text: Name' }).click())
    expect(await check(container)).toEqual([])
    for (const tab of ['Validation', 'Logic']) {
      const button = screen.queryByRole('tab', { name: tab }) ?? screen.queryByRole('button', { name: tab })
      if (button) act(() => button.click())
      expect(await check(container), tab).toEqual([])
    }
    act(() => screen.getByRole('tab', { name: 'Preview' }).click())
    expect(await check(container)).toEqual([])
    act(() => screen.getByRole('tab', { name: 'JSON' }).click())
    expect(await check(container)).toEqual([])
  })
})
