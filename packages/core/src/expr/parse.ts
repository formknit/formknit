export type Ast =
  | { t: 'lit'; v: number | string | boolean | null }
  | { t: 'ref'; path: string[] }
  | { t: 'un'; op: '-' | 'NOT'; arg: Ast }
  | { t: 'bin'; op: string; l: Ast; r: Ast }
  | { t: 'call'; name: string; args: Ast[] }

export class ExprSyntaxError extends Error {
  constructor(
    message: string,
    public position: number,
  ) {
    super(message)
    this.name = 'ExprSyntaxError'
  }
}

export const MAX_LENGTH = 2000
export const MAX_DEPTH = 64

interface Tok {
  t: 'num' | 'str' | 'id' | 'op' | 'eof'
  v: string
  pos: number
}

const OPS2 = ['==', '!=', '>=', '<=', '<>', '&&', '||']
const OPS1 = '+-*/%^(),><=&!.'
const NUMBER = /\d+(\.\d+)?/y
const IDENT = /[A-Za-z_$][A-Za-z0-9_$]*/y

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
      i++
      continue
    }
    if (ch >= '0' && ch <= '9') {
      NUMBER.lastIndex = i
      const m = NUMBER.exec(src)!
      out.push({ t: 'num', v: m[0], pos: i })
      i += m[0].length
      continue
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1
      let s = ''
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\' && j + 1 < src.length) j++
        s += src[j++]
      }
      if (j >= src.length) throw new ExprSyntaxError('Text is missing its closing quote', i)
      out.push({ t: 'str', v: s, pos: i })
      i = j + 1
      continue
    }
    IDENT.lastIndex = i
    const id = IDENT.exec(src)
    if (id) {
      out.push({ t: 'id', v: id[0], pos: i })
      i += id[0].length
      continue
    }
    const two = src.slice(i, i + 2)
    if (OPS2.includes(two)) {
      out.push({ t: 'op', v: two, pos: i })
      i += 2
      continue
    }
    if (OPS1.includes(ch)) {
      out.push({ t: 'op', v: ch, pos: i })
      i++
      continue
    }
    throw new ExprSyntaxError(`Unexpected character "${ch}"`, i)
  }
  out.push({ t: 'eof', v: '', pos: src.length })
  return out
}

const COMPARE: Record<string, string> = {
  '==': '==',
  '=': '==',
  '!=': '!=',
  '<>': '!=',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
}

export function parse(src: string): Ast {
  if (src.length > MAX_LENGTH) {
    throw new ExprSyntaxError(`Expression is longer than ${MAX_LENGTH} characters`, MAX_LENGTH)
  }
  const toks = tokenize(src)
  let p = 0
  let depth = 0
  const peek = () => toks[p]
  const next = () => toks[p++]
  const isOp = (v: string) => peek().t === 'op' && peek().v === v
  const isKw = (k: string) => peek().t === 'id' && peek().v.toUpperCase() === k
  const describe = (t: Tok) => (t.t === 'eof' ? 'end of expression' : `"${t.v}"`)
  const expect = (v: string) => {
    if (!isOp(v)) throw new ExprSyntaxError(`Expected "${v}" but found ${describe(peek())}`, peek().pos)
    next()
  }
  const nested = <T>(fn: () => T): T => {
    if (++depth > MAX_DEPTH) throw new ExprSyntaxError('Expression is nested too deeply', peek().pos)
    const result = fn()
    depth--
    return result
  }

  function or(): Ast {
    return nested(() => {
      let l = and()
      while (isKw('OR') || isOp('||')) {
        next()
        l = { t: 'bin', op: 'OR', l, r: and() }
      }
      return l
    })
  }
  function and(): Ast {
    let l = not()
    while (isKw('AND') || isOp('&&')) {
      next()
      l = { t: 'bin', op: 'AND', l, r: not() }
    }
    return l
  }
  function not(): Ast {
    if (isKw('NOT') || isOp('!')) {
      next()
      return nested(() => ({ t: 'un', op: 'NOT', arg: not() }))
    }
    return compare()
  }
  function compare(): Ast {
    const l = concat()
    if (peek().t === 'op' && COMPARE[peek().v]) {
      const op = COMPARE[next().v]
      return { t: 'bin', op, l, r: concat() }
    }
    return l
  }
  function concat(): Ast {
    let l = add()
    while (isOp('&')) {
      next()
      l = { t: 'bin', op: '&', l, r: add() }
    }
    return l
  }
  function add(): Ast {
    let l = mul()
    while (isOp('+') || isOp('-')) {
      const op = next().v
      l = { t: 'bin', op, l, r: mul() }
    }
    return l
  }
  function mul(): Ast {
    let l = unary()
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = next().v
      l = { t: 'bin', op, l, r: unary() }
    }
    return l
  }
  function unary(): Ast {
    if (isOp('-')) {
      next()
      return nested(() => ({ t: 'un', op: '-', arg: unary() }))
    }
    if (isOp('+')) {
      next()
      return nested(unary)
    }
    return pow()
  }
  function pow(): Ast {
    const base = primary()
    if (isOp('^')) {
      next()
      return { t: 'bin', op: '^', l: base, r: unary() }
    }
    return base
  }
  function primary(): Ast {
    const tok = next()
    if (tok.t === 'num') return { t: 'lit', v: Number(tok.v) }
    if (tok.t === 'str') return { t: 'lit', v: tok.v }
    if (tok.t === 'op' && tok.v === '(') {
      const e = or()
      expect(')')
      return e
    }
    if (tok.t === 'id') {
      const upper = tok.v.toUpperCase()
      if (isOp('(')) {
        next()
        const args: Ast[] = []
        if (!isOp(')')) {
          args.push(or())
          while (isOp(',')) {
            next()
            args.push(or())
          }
        }
        expect(')')
        return { t: 'call', name: upper, args }
      }
      if (upper === 'TRUE') return { t: 'lit', v: true }
      if (upper === 'FALSE') return { t: 'lit', v: false }
      if (upper === 'NULL') return { t: 'lit', v: null }
      if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
        throw new ExprSyntaxError(`"${tok.v}" needs a value on each side`, tok.pos)
      }
      const path = [tok.v]
      while (isOp('.')) {
        next()
        const seg = next()
        if (seg.t !== 'id' && seg.t !== 'num') {
          throw new ExprSyntaxError(`Expected a field name after "." but found ${describe(seg)}`, seg.pos)
        }
        path.push(seg.v)
      }
      return { t: 'ref', path }
    }
    if (tok.t === 'eof') {
      throw new ExprSyntaxError(p === 1 ? 'Expression is empty' : 'Expression ends too early', tok.pos)
    }
    throw new ExprSyntaxError(`Unexpected ${describe(tok)}`, tok.pos)
  }

  const ast = or()
  if (peek().t !== 'eof') throw new ExprSyntaxError(`Unexpected ${describe(peek())}`, peek().pos)
  return ast
}

/** Every field path an expression reads, in source order. */
export function references(ast: Ast, out: string[][] = []): string[][] {
  switch (ast.t) {
    case 'ref':
      out.push(ast.path)
      break
    case 'un':
      references(ast.arg, out)
      break
    case 'bin':
      references(ast.l, out)
      references(ast.r, out)
      break
    case 'call':
      for (const a of ast.args) references(a, out)
      break
  }
  return out
}
