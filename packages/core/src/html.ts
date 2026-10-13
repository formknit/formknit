/** Tags a rich text value may contain. Everything else is shown as plain text. */
export const RICH_TEXT_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr',
] as const

export interface SanitizeOptions {
  /** Tags to keep. Defaults to RICH_TEXT_TAGS. */
  tags?: readonly string[]
}

const VOID = new Set(['br', 'hr'])
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

const escapeText = (s: string) => s.replace(/&(?!(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,30});)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const decode = (s: string) =>
  s.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,30});/gi, (whole, name: string) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? whole
    const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  })

/** A link target people can safely click: a web address, an email, a phone number, or a path on this site. */
function safeHref(raw: string): string | null {
  // Browsers ignore tabs, new lines and control characters inside an address, so they must not hide a scheme.
  const href = decode(raw).replace(/[\u0000- \u007f-\u009f]/g, '')
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return href
  return /^[/#?]/.test(href) && !href.startsWith('//') ? href : null
}

/**
 * Makes HTML from an editor safe to store and show. The result is rebuilt from scratch: only
 * the listed tags survive, with no attributes except a checked `href` on links, and everything
 * else (scripts, styles, event handlers, unknown tags, comments) becomes plain text or is dropped.
 */
export function sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
  const allowed = new Set(options.tags ?? RICH_TEXT_TAGS)
  // The contents of these are never text a person wrote.
  const input = String(html).replace(/<(script|style|iframe|object|embed|template|noscript)\b[\s\S]*?(<\/\1\s*>|$)/gi, '').replace(/<!--[\s\S]*?(-->|$)/g, '')
  const open: string[] = []
  let out = ''
  let last = 0
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g
  for (let m = tag.exec(input); m; m = tag.exec(input)) {
    out += escapeText(input.slice(last, m.index))
    last = tag.lastIndex
    const name = m[2].toLowerCase()
    if (!allowed.has(name)) continue
    if (m[1]) {
      // Close only what is open, closing anything left open inside it first.
      const at = open.lastIndexOf(name)
      if (at === -1) continue
      while (open.length > at) out += `</${open.pop()}>`
    } else if (VOID.has(name)) {
      out += `<${name}>`
    } else if (name === 'a') {
      const found = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(m[3])
      const href = found ? safeHref(found[1] ?? found[2] ?? found[3] ?? '') : null
      out += href ? `<a href="${escapeAttr(href)}" rel="noopener noreferrer nofollow" target="_blank">` : '<a>'
      open.push(name)
    } else {
      out += `<${name}>`
      open.push(name)
    }
  }
  out += escapeText(input.slice(last))
  while (open.length) out += `</${open.pop()}>`
  return out
}

/** The words in a piece of HTML, without the markup. Blocks become separate lines. */
export function htmlToText(html: string): string {
  return decode(
    String(html)
      .replace(/<(script|style)\b[\s\S]*?(<\/\1\s*>|$)/gi, '')
      .replace(/<\/(p|h[1-6]|li|blockquote|pre|div)\s*>|<(br|hr)\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
