import type { ComponentProps } from 'react'
type Props = Omit<ComponentProps<'button'>, 'onChange'> & { checked?: boolean | 'indeterminate'; onCheckedChange?: (checked: boolean | 'indeterminate') => void }
export const Checkbox = ({ checked, onCheckedChange, ...props }: Props) => (
  <button type="button" role="checkbox" aria-checked={checked === true} onClick={() => onCheckedChange?.(checked !== true)} {...props} />
)
