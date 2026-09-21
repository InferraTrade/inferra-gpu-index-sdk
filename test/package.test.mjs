import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** Every leaf string in the exports map that looks like a relative file path. */
function* targets(node) {
  if (typeof node === 'string') { if (node.startsWith('./')) yield node; return }
  for (const value of Object.values(node)) yield* targets(value)
}

// The classic publish failure is an exports map pointing at a file the build does not produce:
// `npm publish` is happy, and every consumer gets ERR_MODULE_NOT_FOUND.
test('every path the package advertises exists in the build', () => {
  const advertised = new Set([...targets(pkg.exports), pkg.main, pkg.module, pkg.types])
  for (const rel of advertised) {
    assert.ok(existsSync(join(root, rel)), `${rel} is advertised by package.json but was not built`)
  }
})

test('the package is publishable: public name, not private, access declared', () => {
  assert.equal(pkg.private, undefined, 'private:true blocks publication')
  assert.equal(pkg.name, '@inferra-trade/gpu-index')
  assert.equal(pkg.publishConfig?.access, 'public', 'a scoped package defaults to restricted')
})

// dist is generated, never committed, and rebuilt by prepublishOnly. Without that guard the
// published tarball is whatever happened to be on disk, which is how a stale build ships.
test('publishing rebuilds and retests first', () => {
  assert.match(pkg.scripts.prepublishOnly, /test/)
  assert.match(pkg.scripts.test, /build/)
})

// `node --test` with no pattern: the runner's own discovery finds test/*.test.{mjs,cjs} on every
// supported Node. A quoted glob is expanded by the runner only from Node 22, and on 18 and 20 it is
// taken literally, which is how the first CI run failed on two of three versions.
test('the test script relies on the runner\'s discovery, not on a glob', () => {
  assert.doesNotMatch(pkg.scripts.test, /\*/)
})
