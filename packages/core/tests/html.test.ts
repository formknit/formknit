import { describe, expect, it } from 'vitest'
import { form, htmlToText, richText, sanitizeHtml, validate } from '../src'

describe('sanitizeHtml', () => {
  it('keeps ordinary formatting', () => {
    const html = '<h2>Title</h2><p>Some <strong>bold</strong> and <em>italic</em> text.</p><ul><li><p>One</p></li><li><p>Two</p></li></ul><hr>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('drops attributes and keeps only safe links', () => {
    expect(sanitizeHtml('<p style="color:red" onclick="x()" class="a">Hi</p>')).toBe('<p>Hi</p>')
    expect(sanitizeHtml('<a href="https://example.com/?a=1&b=2" onclick="x()">go</a>')).toBe(
      '<a href="https://example.com/?a=1&amp;b=2" rel="noopener noreferrer nofollow" target="_blank">go</a>',
    )
    expect(sanitizeHtml('<a href="/about">a</a>')).toContain('href="/about"')
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', '&#106;avascript:alert(1)', 'data:text/html,<b>x</b>', '//evil.example', ' javascript:x', 'vbscript:x']) {
      expect(sanitizeHtml(`<a href="${bad}">x</a>`), bad).toBe('<a>x</a>')
    }
  })

  it('removes anything that could run', () => {
    const attacks = [
      '<script>alert(1)</script>',
      '<scr<script></script>ipt>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<img src=x onerror=alert(1)',
      '<svg onload=alert(1)><circle/></svg>',
      '<iframe src="https://evil.example"></iframe>',
      '<p onmouseover="alert(1)">x</p>',
      '<style>body{background:url(javascript:x)}</style>',
      '<!-- <script>alert(1)</script> -->',
      '<a href="x" onclick=alert(1)>x</a>',
      '<p title="><script>alert(1)</script>">x</p>',
      '<math><mtext><script>alert(1)</script></mtext></math>',
      '<<p>script>alert(1)</script>',
    ]
    for (const attack of attacks) {
      const clean = sanitizeHtml(attack)
      // Whatever is left must not contain a tag or attribute outside the allowed set.
      expect(clean, attack).not.toMatch(/<(?!\/?(p|br|strong|b|em|i|u|s|code|pre|h[1-4]|ul|ol|li|blockquote|a|hr)\b)[a-z!/]/i)
      expect(clean, attack).not.toMatch(/<[^>]*\son\w+\s*=/i)
      expect(clean, attack).not.toMatch(/javascript:/i)
    }
  })

  it('escapes loose text and closes what was left open', () => {
    expect(sanitizeHtml('1 < 2 & 3 > 2 &amp; &copy;')).toBe('1 &lt; 2 &amp; 3 &gt; 2 &amp; &copy;')
    expect(sanitizeHtml('<p><strong>open')).toBe('<p><strong>open</strong></p>')
    expect(sanitizeHtml('</p>stray')).toBe('stray')
    expect(sanitizeHtml('<ul><li>a</ul>')).toBe('<ul><li>a</li></ul>')
  })

  it('is stable when run twice', () => {
    const once = sanitizeHtml('<p>a <b>b</b> <a href="https://x.test/?q=1&r=2">c</a> &lt;tag&gt;</p>')
    expect(sanitizeHtml(once)).toBe(once)
  })

  it('can be limited to fewer tags', () => {
    expect(sanitizeHtml('<h2>T</h2><p><strong>b</strong></p>', { tags: ['p', 'strong'] })).toBe('T<p><strong>b</strong></p>')
  })
})

describe('htmlToText', () => {
  it('returns the words on separate lines', () => {
    expect(htmlToText('<h2>Title</h2><p>One &amp; two</p><ul><li>a</li><li>b</li></ul>')).toBe('Title\nOne & two\na\nb')
  })
})

describe('rich text field', () => {
  const schema = form('Post', [richText('body').label('Body').required().minLength(5).maxLength(20)])

  it('cleans the value on the server and counts words, not markup', () => {
    const ok = validate(schema, { body: '<p onclick="x()">Hello <strong>there</strong></p><script>alert(1)</script>' })
    expect(ok.valid).toBe(true)
    expect(ok.data.body).toBe('<p>Hello <strong>there</strong></p>')
    expect(validate(schema, { body: '<p><strong>Hey</strong></p>' }).errors.body).toBeTruthy()
    expect(validate(schema, { body: `<p>${'x'.repeat(21)}</p>` }).errors.body).toBeTruthy()
  })

  it('treats an empty editor as empty', () => {
    const result = validate(schema, { body: '<p></p>' })
    expect(result.valid).toBe(false)
    expect(result.errors.body[0]).toMatch(/required/)
  })
})
