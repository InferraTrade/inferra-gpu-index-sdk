import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  FEED_ACCOUNT_BYTES, FEED_DISCRIMINATOR, INDEX_ID_BYTES, decodeFeed, indexIdBytes, InferraIndexError,
} from '../dist/esm/codec.js'
import { encodeFeed } from './encode.mjs'

test('decodeFeed round-trips the on-chain layout', () => {
  const f = decodeFeed(encodeFeed({ indexId: 'H100', px: 2.5487, ts: 1800000000, blockTs: 1800000060 }))
  assert.equal(f.indexId, 'H100')
  assert.ok(Math.abs(f.px - 2.5487) < 1e-9)
  assert.equal(f.pxRaw, 2548700n)
  assert.equal(f.ts, 1800000000)
  assert.equal(f.blockTs, 1800000060)
})

test('decodeFeed reads a longer account, so trailing fields cannot shift the price', () => {
  const body = encodeFeed({ indexId: 'B200', px: 6.3259, ts: 1, blockTs: 2 })
  const padded = new Uint8Array(FEED_ACCOUNT_BYTES + 32)
  padded.set(body)
  assert.equal(decodeFeed(padded).pxRaw, 6325900n)
})

// Anchor derives every account discriminator the same way, so the constant can be checked against
// the rule rather than against a number copied from an explorer.
test('the Feed discriminator is sha256("account:Feed")[0..8]', () => {
  const expected = createHash('sha256').update('account:Feed').digest().subarray(0, 8)
  assert.deepEqual([...FEED_DISCRIMINATOR], [...expected])
})

// The program owns a config account too, and it is longer than a feed. Without this check its bytes
// decode into a "price" with a straight face.
test('decodeFeed refuses bytes that are not a Feed account', () => {
  const notAFeed = encodeFeed({ indexId: 'H100', px: 1, ts: 1, blockTs: 2, discriminator: Uint8Array.of(155, 12, 170, 224, 30, 250, 204, 130) })
  assert.throws(() => decodeFeed(notAFeed), (e) => e instanceof InferraIndexError && e.code === 'NOT_A_FEED')
})

test('decodeFeed rejects a short account instead of returning garbage', () => {
  assert.throws(() => decodeFeed(new Uint8Array(FEED_ACCOUNT_BYTES - 1)), (e) => {
    assert.ok(e instanceof InferraIndexError)
    assert.equal(e.code, 'FEED_TOO_SHORT')
    return true
  })
})

test('decodeFeed refuses a price it cannot represent exactly, rather than rounding it', () => {
  const bytes = encodeFeed({ indexId: 'H100', pxRaw: 2n ** 63n, ts: 1, blockTs: 2 })
  assert.throws(() => decodeFeed(bytes), (e) => e.code === 'PRICE_UNREPRESENTABLE')
})

test('decodeFeed reads the model back off the account rather than trusting the caller', () => {
  assert.equal(decodeFeed(encodeFeed({ indexId: 'A100', px: 1, ts: 1, blockTs: 2 })).indexId, 'A100')
})

test('indexIdBytes right-zero-pads to the width the program keys feeds on', () => {
  const bytes = indexIdBytes('H100')
  assert.equal(bytes.length, INDEX_ID_BYTES)
  assert.deepEqual([...bytes.subarray(0, 4)], [...Buffer.from('H100')])
  assert.ok(bytes.subarray(4).every((b) => b === 0))
})

// The chain keys feeds on the uppercase name. A lowercase id that derived a different address would
// read as "no feed on this cluster", which is the wrong answer to a typo.
test('indexIdBytes is case-insensitive', () => {
  assert.deepEqual([...indexIdBytes('h100')], [...indexIdBytes('H100')])
  assert.deepEqual([...indexIdBytes('b200')], [...indexIdBytes('B200')])
})

// Truncating would return a valid-looking address for a model nobody asked about, and the caller
// would then read a real price for the wrong card.
test('indexIdBytes throws on a model id too long to be a key', () => {
  assert.throws(() => indexIdBytes('A'.repeat(INDEX_ID_BYTES + 1)), (e) => e.code === 'MODEL_ID_TOO_LONG')
})
