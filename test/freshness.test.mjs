import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkFreshness, INFERRA_ESCROW_MAX_AGE_SECONDS } from '../dist/esm/codec.js'

const feed = (over = {}) => ({ indexId: 'H100', px: 2.54, pxRaw: 2540000n, ts: 0, blockTs: 0, ...over })

// The check that actually protects money. A frozen feed keeps its last good value, so a naive read
// returns a plausible number nobody stands behind.
test('a frozen feed is refused even though it holds a sane price', () => {
  const now = 1800000000
  const r = checkFreshness(feed({ ts: now - 3600, blockTs: now - 3600 }), 600, now)
  assert.equal(r.ok, false)
  assert.match(r.reason, /stale by 3000s/)
  assert.equal(r.ageSeconds, 3600)
})

test('a never-written feed is refused', () => {
  const r = checkFreshness(feed({ px: 0, pxRaw: 0n }), 600, 1800000000)
  assert.equal(r.ok, false)
  assert.match(r.reason, /never been written/)
})

test('a fresh feed passes and reports its age', () => {
  const now = 1800000000
  const r = checkFreshness(feed({ ts: now - 120, blockTs: now - 120 }), 600, now)
  assert.deepEqual(r, { ok: true, reason: null, ageSeconds: 120 })
})

// Exactly at the window is inside it: the boundary belongs to the caller's number, not to ours.
test('age equal to the window still passes', () => {
  const now = 1800000000
  assert.equal(checkFreshness(feed({ blockTs: now - 600 }), 600, now).ok, true)
  assert.equal(checkFreshness(feed({ blockTs: now - 601 }), 600, now).ok, false)
})

test('a clock running behind the chain gives a negative age, not a false stale', () => {
  const now = 1800000000
  const r = checkFreshness(feed({ blockTs: now + 5 }), 600, now)
  assert.equal(r.ok, true)
  assert.equal(r.ageSeconds, -5)
})

// Defaulting a missing window would be this package choosing how old a price may be before it stops
// being a price, which is not a decision it is in a position to make.
test('a missing or nonsensical window throws instead of being guessed', () => {
  for (const bad of [0, -1, NaN, Infinity]) {
    assert.throws(() => checkFreshness(feed(), bad, 1), (e) => e.code === 'BAD_ARGUMENT')
  }
})

test('the documented escrow window matches what the chain enforces', () => {
  assert.equal(INFERRA_ESCROW_MAX_AGE_SECONDS, 1200)
})
