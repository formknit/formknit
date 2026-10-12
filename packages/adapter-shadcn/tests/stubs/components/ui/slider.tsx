import type { ComponentProps } from 'react'
type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & { value?: number[]; onValueChange?: (value: number[]) => void }
export const Slider = ({ value, onValueChange, ...props }: Props) => (
  <input type="range" value={value?.[0] ?? 0} onChange={(e) => onValueChange?.([Number(e.target.value)])} {...props} />
)
