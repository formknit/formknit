import { createContext, useContext, type ComponentProps, type ReactNode } from 'react'
const Ctx = createContext<{ value?: string; onValueChange?: (value: string) => void; disabled?: boolean }>({})
export const Select = (props: { value?: string; onValueChange?: (value: string) => void; disabled?: boolean; children: ReactNode }) => (
  <Ctx.Provider value={props}>{props.children}</Ctx.Provider>
)
export const SelectTrigger = (props: ComponentProps<'button'>) => <button type="button" role="combobox" aria-expanded disabled={useContext(Ctx).disabled} {...props} />
export const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{useContext(Ctx).value ?? placeholder}</span>
export const SelectContent = ({ children }: { children: ReactNode }) => <div role="listbox">{children}</div>
export const SelectItem = ({ value, children }: { value: string; children: ReactNode }) => {
  const select = useContext(Ctx)
  return (
    <div role="option" aria-selected={select.value === value} onClick={() => select.onValueChange?.(value)}>
      {children}
    </div>
  )
}
