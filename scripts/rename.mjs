#!/usr/bin/env node
// Renames the project everywhere the brand appears.
//   node scripts/rename.mjs <new-name> [--dry]
// The current name is read from the root package.json ("<name>-monorepo").
// Folder names never contain the brand, so only file contents change.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(import.meta.url), '..', '..')
const args = process.argv.slice(2)
const dry = args.includes('--dry')
const next = args.find((a) => !a.startsWith('--'))

if (!next || !/^[a-z][a-z0-9]*$/.test(next)) {
  console.error('Usage: node scripts/rename.mjs <new-name> [--dry]\nThe name must be lowercase letters and digits, e.g. formknit')
  process.exit(1)
}

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const prev = rootPkg.name.replace(/-monorepo$/, '')
if (prev === next) {
  console.error(`The project is already called ${next}`)
  process.exit(1)
}

const title = (s) => s[0].toUpperCase() + s.slice(1)
const pairs = [
  [prev, next],
  [title(prev), title(next)],
  [prev.toUpperCase(), next.toUpperCase()],
]

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage'])
const SKIP_FILES = new Set(['pnpm-lock.yaml'])
const TEXT = /\.(m?[jt]sx?|json|md|ya?ml|css|html|txt)$|^LICENSE$|^\.[a-z]+rc$/

let files = 0
let total = 0
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(path)
      continue
    }
    if (SKIP_FILES.has(name) || !TEXT.test(name)) continue
    const before = readFileSync(path, 'utf8')
    let after = before
    let count = 0
    for (const [from, to] of pairs) {
      const parts = after.split(from)
      count += parts.length - 1
      after = parts.join(to)
    }
    if (!count) continue
    files++
    total += count
    console.log(`${String(count).padStart(4)}  ${relative(root, path)}`)
    if (!dry) writeFileSync(path, after)
  }
}
walk(root)

console.log(`\n${dry ? 'Would change' : 'Changed'} ${total} occurrences in ${files} files: ${prev} -> ${next}`)
if (!dry) {
  console.log('\nStill to do by hand:')
  console.log('  1. pnpm install            (refreshes the lockfile)')
  console.log('  2. pnpm test && pnpm build')
  console.log('  3. Rename the project folder, the git remote and the Figma file')
  console.log('  4. Reserve the .com domain, the npm scope and the GitHub organisation')
}
