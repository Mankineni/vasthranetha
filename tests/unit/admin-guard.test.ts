// Every admin server action and admin route handler must check the owner
// itself; the admin layout's check does not protect actions or handlers.
import fs from 'node:fs'
import path from 'node:path'

const ADMIN = path.join(process.cwd(), 'src', 'app', 'admin')

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? walk(full) : [full]
  })
}

/** Splits a file into its exported functions: name and body text up to the next export. */
function exportedFunctions(source: string): { name: string; body: string }[] {
  const re = /export\s+(?:async\s+)?function\s+(\w+)/g
  const starts = [...source.matchAll(re)]
  return starts.map((m, i) => ({
    name: m[1],
    body: source.slice(m.index!, i + 1 < starts.length ? starts[i + 1].index : source.length),
  }))
}

const files = walk(ADMIN)
const rel = (f: string) => path.relative(process.cwd(), f).replace(/\\/g, '/')

test('every exported server action under /admin calls requireOwner()', () => {
  const actionFiles = files.filter((f) => /\.tsx?$/.test(f) && fs.readFileSync(f, 'utf8').trimStart().startsWith("'use server'"))
  expect(actionFiles.length).toBeGreaterThanOrEqual(3)
  const missing: string[] = []
  for (const file of actionFiles) {
    for (const fn of exportedFunctions(fs.readFileSync(file, 'utf8'))) {
      // Sign-in itself and its redirect helper are the only actions open to signed-out visitors.
      if (rel(file).endsWith('admin/login/actions.ts')) continue
      if (!/requireOwner\(\)/.test(fn.body)) missing.push(`${rel(file)}: ${fn.name}`)
    }
  }
  expect(missing).toEqual([])
})

// Handlers that are public on purpose: the install manifest, the service worker
// script, and sign-out (which only ends the caller's own session).
const PUBLIC_HANDLERS = ['admin/manifest.webmanifest/route.ts', 'admin/sw.js/route.ts', 'admin/logout/route.ts']

test('every admin route handler checks the owner (except the deliberately public ones)', () => {
  const handlers = files.filter((f) => f.endsWith('route.ts')).filter((f) => !PUBLIC_HANDLERS.some((p) => rel(f).endsWith(p)))
  expect(handlers.length).toBeGreaterThanOrEqual(4)
  const missing = handlers.filter((f) => !/(getOwner|requireOwner)\(\)/.test(fs.readFileSync(f, 'utf8'))).map(rel)
  expect(missing).toEqual([])
})
