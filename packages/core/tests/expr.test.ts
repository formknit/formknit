import { describe, expect, it } from 'vitest'
import { compile, evaluate, ExprError, ExprSyntaxError, registerFunction } from '../src'

const data = {
  qty: 3,
  price: 9.99,
  discount: 5,
  name: 'Sita',
  country: 'NP',
  agree: true,
  empty: '',
  missing: null,
  tags: ['red', 'blue'],
  born: '2004-03-18',
  items: [
    { name: 'Tuition', qty: 1, rate: 9000, amount: 9000 },
    { name: 'Lab', qty: 2, rate: 1500, amount: 3000 },
  ],
}
const now = new Date(2026, 9, 12)
const run = (src: string) => evaluate(src, data, { now })

describe('expressions', () => {
  const cases: [string, unknown][] = [
    // arithmetic
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['10 / 4', 2.5],
    ['10 % 4', 2],
    ['2 ^ 3', 8],
    ['-2 ^ 2', -4],
    ['2 ^ -1', 0.5],
    ['0.1 + 0.2', 0.3],
    ['qty * price', 29.97],
    ['- qty + 10', 7],
    ['"12" + 1', 13],
    ['missing + 1', 1],
    // text
    ['"a" & "b" & 1', 'ab1'],
    ['CONCAT(name, " ", country)', 'Sita NP'],
    ['UPPER(name)', 'SITA'],
    ['LEN(name)', 4],
    ['TRIM("  x ")', 'x'],
    ["'single' & \"double\"", 'singledouble'],
    ['"say \\"hi\\""', 'say "hi"'],
    // comparison
    ['qty > 2', true],
    ['qty >= 3 AND price < 10', true],
    ['country == "NP"', true],
    ['country = "NP"', true],
    ['country != "IN"', true],
    ['country <> "NP"', false],
    ['country == "np"', false],
    ['empty == ""', true],
    ['missing == ""', true],
    ['missing == 0', false],
    ['missing > 0', false],
    ['"10" == 10', true],
    ['agree == true', true],
    ['born < "2010-01-01"', true],
    // logic
    ['true AND false', false],
    ['true OR false', true],
    ['NOT true', false],
    ['NOT (qty > 5)', true],
    ['!agree', false],
    ['qty > 5 || name == "Sita"', true],
    ['qty > 1 && qty < 5', true],
    ['AND(qty > 1, agree)', true],
    ['OR(qty > 10, false)', false],
    ['true or FALSE', true],
    ['false AND 1 / 0', false],
    ['true OR 1 / 0', true],
    // conditionals
    ['IF(qty > 2, "many", "few")', 'many'],
    ['IF(qty > 5, "many")', null],
    ['IF(true, 1, 1 / 0)', 1],
    ['IFERROR(1 / 0, -1)', -1],
    ['COALESCE(missing, empty, name)', 'Sita'],
    ['ISEMPTY(missing)', true],
    ['ISEMPTY(name)', false],
    // aggregates
    ['SUM(1, 2, 3)', 6],
    ['SUM(items.amount)', 12000],
    ['SUM(items.qty) * 2', 6],
    ['AVG(items.amount)', 6000],
    ['MIN(items.rate)', 1500],
    ['MAX(items.rate, 20000)', 20000],
    ['COUNT(items)', 2],
    ['COUNT(items.name)', 2],
    ['COUNT(missing, empty, 0)', 1],
    ['AVG(missing)', null],
    ['items.0.amount', 9000],
    ['ROUND(SUM(items.amount) * (1 - discount / 100), 2)', 11400],
    ['ROUND(2.345, 2)', 2.35],
    ['ROUND(1.005, 2)', 1.01],
    ['ROUND(2.5)', 3],
    ['FLOOR(2.9)', 2],
    ['CEIL(2.1)', 3],
    ['ABS(-4)', 4],
    ['CONTAINS(tags, "red")', true],
    ['CONTAINS(tags, "green")', false],
    ['CONTAINS(name, "IT")', true],
    // dates
    ['TODAY()', '2026-10-12'],
    ['YEAR(born)', 2004],
    ['MONTH(born)', 3],
    ['DAY(born)', 18],
    ['DATEDIF(born, TODAY(), "Y")', 22],
    ['DATEDIF("2026-01-31", "2026-03-01", "M")', 1],
    ['DATEDIF("2026-10-01", "2026-10-12", "D")', 11],
    ['DATEDIF(missing, TODAY(), "Y")', null],
  ]
  it.each(cases)('%s', (src, expected) => {
    expect(run(src)).toEqual(expected)
  })

  const failures: [string, string][] = [
    ['1 / 0', '#DIV/0!'],
    ['5 % 0', '#DIV/0!'],
    ['name * 2', '#VALUE!'],
    ['tags + 1', '#VALUE!'],
    ['tags == "red"', '#VALUE!'],
    ['name > 3', '#VALUE!'],
    ['SUM(items.name)', '#VALUE!'],
    ['NOPE(1)', '#NAME?'],
    ['YEAR("not a date")', '#VALUE!'],
    ['YEAR("2026-02-30")', '#VALUE!'],
    ['1 + 1 / 0', '#DIV/0!'],
    ['UPPER(1 / 0)', '#DIV/0!'],
  ]
  it.each(failures)('%s gives %s', (src, code) => {
    const result = run(src)
    expect(result).toBeInstanceOf(ExprError)
    expect((result as ExprError).code).toBe(code)
  })

  const invalid = ['', '1 +', '(1 + 2', '1 2', 'SUM(1,', '"open', 'a..b', '1 # 2', 'AND', 'a ==', ')']
  it.each(invalid)('rejects %j', (src) => {
    expect(() => compile(src)).toThrow(ExprSyntaxError)
  })

  it('reports where a syntax error is', () => {
    try {
      compile('1 + # 2')
      throw new Error('should not parse')
    } catch (e) {
      expect(e).toBeInstanceOf(ExprSyntaxError)
      expect((e as ExprSyntaxError).position).toBe(4)
    }
  })

  it('lists the fields an expression reads', () => {
    expect(compile('SUM(items.amount) * (1 - discount / 100)').refs).toEqual([['items', 'amount'], ['discount']])
  })

  it('limits length and nesting', () => {
    expect(() => compile('1' + ' + 1'.repeat(600))).toThrow(/longer than/)
    expect(() => compile('('.repeat(80) + '1' + ')'.repeat(80))).toThrow(/nested too deeply/)
  })

  it('limits evaluation steps', () => {
    const result = evaluate('1' + ' + 1'.repeat(400), {}, { maxSteps: 100 })
    expect((result as ExprError).code).toBe('#LIMIT!')
  })

  it('cannot reach JavaScript globals or prototypes', () => {
    expect(run('constructor')).toBe(null)
    expect(run('name.constructor')).toBe(null)
    expect(run('__proto__')).toBe(null)
    expect((run('eval("1")') as ExprError).code).toBe('#NAME?')
  })

  it('supports custom functions', () => {
    registerFunction('double', (args) => Number(args[0]) * 2)
    expect(run('DOUBLE(qty)')).toBe(6)
    expect(evaluate('VAT(100)', {}, { functions: { VAT: ([n]) => Number(n) * 0.13 } })).toBe(13)
    expect((evaluate('BOOM()', {}, { functions: { BOOM: () => { throw new Error('x') } } }) as ExprError).code).toBe('#ERROR!')
  })
})
