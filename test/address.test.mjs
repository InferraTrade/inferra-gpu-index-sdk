import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PublicKey } from '@solana/web3.js'
import { INDEX_PROGRAM_ID, MODELS, feedAddress, toPublicKey } from '../dist/esm/index.js'

// These addresses are published: they are in the docs, on the status page and in third-party
// integrations. If derivation ever drifts from them, an integrator reads the wrong account and gets
// a real price for something else. Retired models stay in this table on purpose: their accounts
// still exist on chain, and anyone who wired one up before it was retired must keep resolving to
// the same address rather than to a fresh, empty one. Same addresses on devnet and mainnet.
const PUBLISHED = {
  A100: '8qEhhkGv4aK2zMDR76xWLtKAyPoGujj6V7s1WCzQn3Js',
  H100: '7QhvJpzt6vHFoNsFVFH4kXeXPmEhnoL6QCbPaDVd91sq',
  H200: '839HYdedzHxEXxuUPx6EEdWzsE4meDtBhbuoC23doYmg',
  B200: 'akwmbi8T8eEQ5duy6KWkpTNv3bTRU84iBFdUpAabUun',
  A5000: '7E4ZmS2HK9hqU89dLonJ5DBRFZYdT3goGkwFkTmzrdx7',   // retired 2026-08-10
  RTX3070: '2A9unYiSDhnYyKXxsSfToX49WngneSDFgQFFFgRUWgeh', // retired 2026-08-24
}

test('derivation matches every published address', () => {
  for (const [model, address] of Object.entries(PUBLISHED)) {
    assert.equal(feedAddress(model).toBase58(), address, `${model} derives to the wrong account`)
  }
})

test('every listed model derives to a real off-curve PDA', () => {
  for (const model of MODELS) {
    assert.ok(!PublicKey.isOnCurve(feedAddress(model).toBytes()), `${model} is not a PDA`)
  }
})

test('the program id is accepted as a string or as a PublicKey, with the same result', () => {
  const asKey = new PublicKey(INDEX_PROGRAM_ID)
  assert.equal(feedAddress('H100', asKey).toBase58(), feedAddress('H100', INDEX_PROGRAM_ID).toBase58())
  assert.ok(toPublicKey(INDEX_PROGRAM_ID).equals(asKey))
})

test('the model id is case-insensitive at the address level', () => {
  assert.equal(feedAddress('h100').toBase58(), PUBLISHED.H100)
})

test('a different program id derives a different address', () => {
  const other = feedAddress('H100', '11111111111111111111111111111111')
  assert.notEqual(other.toBase58(), feedAddress('H100').toBase58())
})

test('the published model list is the mainnet set', () => {
  assert.deepEqual([...MODELS], ['A100', 'H100', 'H200', 'B200'])
})
