const { test } = require('node:test')
const assert = require('node:assert/strict')

// The package ships two builds. Nothing but a real `require()` proves the CommonJS one loads: the
// root package.json says "type": "module", so without the directory marker written by the postbuild
// step Node reads dist/cjs as ESM and throws ERR_REQUIRE_ESM at the first consumer.
test('the CommonJS build loads through require() and decodes', () => {
  const { decodeFeed, indexIdBytes, feedAddress, PX_SCALE, MODELS, FEED_DISCRIMINATOR } = require('../dist/cjs/index.js')

  const body = Buffer.alloc(49)
  Buffer.from(FEED_DISCRIMINATOR).copy(body, 0)
  Buffer.from(indexIdBytes('H100')).copy(body, 8)
  body.writeBigUInt64LE(BigInt(2.5 * PX_SCALE), 24)
  body.writeBigUInt64LE(1800000000n, 32)
  body.writeBigInt64LE(1800000060n, 40)

  assert.equal(decodeFeed(new Uint8Array(body)).px, 2.5)
  assert.equal(feedAddress('H100').toBase58(), '7QhvJpzt6vHFoNsFVFH4kXeXPmEhnoL6QCbPaDVd91sq')
  assert.ok(MODELS.includes('H100'))
})

test('the dependency-free subpath loads through require() too', () => {
  const codec = require('../dist/cjs/codec.js')
  assert.equal(typeof codec.checkFreshness, 'function')
  assert.equal(codec.INDEX_PROGRAM_ID, '2bCR8fciYe6M4xogru1kNQb6fC4zdn9moUXEXdNxciNX')
})
