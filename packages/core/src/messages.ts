const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Every message the core can produce. Replace any of them to translate or reword. */
export const defaultMessages = {
  required: (label: string) => `${label} is required`,
  /** A required checkbox or toggle that is not ticked. */
  mustTick: (label: string) => `Please tick "${label}"`,
  minLength: (label: string, n: number) => `${label} must be at least ${plural(n, 'character')}`,
  maxLength: (label: string, n: number) => `${label} must be at most ${plural(n, 'character')}`,
  min: (label: string, n: number | string) => `${label} must be at least ${n}`,
  max: (label: string, n: number | string) => `${label} must be at most ${n}`,
  pattern: (label: string) => `${label} is not in the expected format`,
  email: (label: string) => `${label} must be a valid email address`,
  number: (label: string) => `${label} must be a number`,
  date: (label: string) => `${label} must be a valid date`,
  time: (label: string) => `${label} must be a valid time`,
  phone: (label: string) => `${label} must be a valid phone number`,
  url: (label: string) => `${label} must be a web address starting with http:// or https://`,
  fileSize: (label: string, mb: number) => `${label} must be ${mb} MB or smaller`,
  fileType: (label: string, accept: string) => `${label} must be one of: ${accept}`,
  signature: (label: string) => `${label} needs a signature`,
  dateRange: (label: string) => `${label} needs both a start and an end date`,
  dateOrder: (label: string) => `${label} cannot end before it starts`,
  address: (label: string) => `${label} needs at least a street and a city`,
  option: (label: string) => `${label} has a choice that is not allowed`,
  minItems: (label: string, n: number) => `${label} needs at least ${plural(n, 'item')}`,
  maxItems: (label: string, n: number) => `${label} can have at most ${plural(n, 'item')}`,
  calculation: (label: string, code: string) => `${label} could not be calculated (${code})`,
}

export type Messages = typeof defaultMessages
