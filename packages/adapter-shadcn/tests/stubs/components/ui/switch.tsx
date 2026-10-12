import type { ComponentProps } from 'react'
type Props = Omit<ComponentProps<'button'>, 'onChange'> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }
export const Switch = ({ checked, onCheckedChange, ...props }: Props) => (
  <button type="button" role="switch" aria-checked={checked === true} onClick={() => onCheckedChange?.(!checked)} {...props} />
)
