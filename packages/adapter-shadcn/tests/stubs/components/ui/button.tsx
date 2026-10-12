import type { ComponentProps } from 'react'
type Props = ComponentProps<'button'> & {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}
export const Button = ({ variant, size, ...props }: Props) => <button data-variant={variant ?? 'default'} data-size={size} {...props} />
