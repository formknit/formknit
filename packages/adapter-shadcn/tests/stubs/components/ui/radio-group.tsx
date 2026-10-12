import { createContext, useContext, type ComponentProps } from 'react'
const Ctx = createContext<{ value?: string; onValueChange?: (value: string) => void; disabled?: boolean }>({})
type GroupProps = Omit<ComponentProps<'div'>, 'onChange'> & { value?: string; onValueChange?: (value: string) => void; disabled?: boolean }
export const RadioGroup = ({ value, onValueChange, disabled, ...props }: GroupProps) => (
  <Ctx.Provider value={{ value, onValueChange, disabled }}>
    <div role="radiogroup" {...props} />
  </Ctx.Provider>
)
export const RadioGroupItem = ({ value, ...props }: ComponentProps<'button'> & { value: string }) => {
  const group = useContext(Ctx)
  return <button type="button" role="radio" aria-checked={group.value === value} disabled={group.disabled} onClick={() => group.onValueChange?.(value)} {...props} />
}
