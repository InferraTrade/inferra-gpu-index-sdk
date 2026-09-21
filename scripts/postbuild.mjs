// Tell Node how to read each build directory.
//
// The root package.json says `"type": "module"`, which makes every .js file under it ESM — including
// the CommonJS build. A directory-level package.json is the documented way to say otherwise, and
// TypeScript resolves declaration files by the same rule, so this is also what keeps `require()`
// callers from being handed ESM type definitions.
//
// Written here rather than committed as two files so `npm run clean` can delete dist wholesale.

import { writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

for (const [dir, type] of [['esm', 'module'], ['cjs', 'commonjs']]) {
  const target = join(dist, dir)
  if (!existsSync(target)) {
    console.error(`postbuild: ${target} is missing — did tsc fail?`)
    process.exit(1)
  }
  writeFileSync(join(target, 'package.json'), `${JSON.stringify({ type }, null, 2)}\n`)
}
