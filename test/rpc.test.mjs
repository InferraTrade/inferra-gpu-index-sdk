import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PublicKey } from '@solana/web3.js'
import { readFeed, readFeeds, watchFeed, feedAddress, INDEX_PROGRAM_ID, MODELS } from '../dist/esm/index.js'
import { encodeFeed } from './encode.mjs'

// The RPC layer, against a fake Connection. web3.js's Connection is only ever called through four
// methods here, and a fake that records the calls pins the two properties a real node cannot be
// asked to demonstrate on demand: that an account owned by another program is refused, and that
// a hundred-and-first address goes out in a second request.
const PROGRAM = new PublicKey(INDEX_PROGRAM_ID)
const OTHER = new PublicKey('11111111111111111111111111111111')

const account = (model, owner = PROGRAM, over = {}) => ({
  owner,
  data: Buffer.from(encodeFeed({ indexId: model, px: 2.5, ts: 1800000000, blockTs: 1800000060, ...over })),
  lamports: 1, executable: false,
})

function fakeConnection(accounts) {
  const calls = []
  const byAddress = new Map(Object.entries(accounts).map(([model, info]) => [feedAddress(model).toBase58(), info]))
  const listeners = new Map()
  let nextId = 1
  return {
    calls,
    listeners,
    async getAccountInfo(pubkey, commitment) {
      calls.push(['getAccountInfo', pubkey.toBase58(), commitment])
      return byAddress.get(pubkey.toBase58()) ?? null
    },
    async getMultipleAccountsInfo(pubkeys, commitment) {
      calls.push(['getMultipleAccountsInfo', pubkeys.length, commitment])
      return pubkeys.map((k) => byAddress.get(k.toBase58()) ?? null)
    },
    onAccountChange(pubkey, cb, config) {
      const id = nextId++
      listeners.set(id, { pubkey: pubkey.toBase58(), cb, config })
      calls.push(['onAccountChange', pubkey.toBase58(), config])
      return id
    },
    async removeAccountChangeListener(id) {
      calls.push(['removeAccountChangeListener', id])
      listeners.delete(id)
    },
  }
}

test('readFeed decodes an account the program owns, and answers null for one that does not exist', async () => {
  const c = fakeConnection({ H100: account('H100') })
  const feed = await readFeed(c, 'H100')
  assert.equal(feed.indexId, 'H100')
  assert.equal(feed.px, 2.5)
  assert.equal(await readFeed(c, 'B200'), null)
  assert.equal(c.calls[0][1], feedAddress('H100').toBase58())
})

test('readFeed refuses an account at the right address owned by another program', async () => {
  const c = fakeConnection({ H100: account('H100', OTHER) })
  await assert.rejects(readFeed(c, 'H100'), (e) => e.code === 'WRONG_OWNER' && /11111111/.test(e.message))
})

test('readFeed passes the commitment through and defaults to the connection\'s own', async () => {
  const c = fakeConnection({ H100: account('H100') })
  await readFeed(c, 'H100')
  assert.equal(c.calls[0][2], undefined)
  await readFeed(c, 'H100', { commitment: 'finalized' })
  assert.equal(c.calls[1][2], 'finalized')
})

test('readFeeds keeps the shape of the request: every model present, missing ones null, keys as passed', async () => {
  const c = fakeConnection({ H100: account('H100'), A100: account('A100') })
  const out = await readFeeds(c, ['h100', 'B200', 'A100'])
  assert.deepEqual(Object.keys(out), ['h100', 'B200', 'A100'])
  assert.equal(out.h100.indexId, 'H100', 'a lowercase id reads the uppercase account')
  assert.equal(out.B200, null)
  assert.equal(out.A100.indexId, 'A100')
  assert.equal(c.calls.length, 1, 'one round trip for a handful of models')
})

test('readFeeds splits more than a hundred addresses across requests', async () => {
  const c = fakeConnection({})
  const many = Array.from({ length: 205 }, (_, i) => `M${i}`)
  const out = await readFeeds(c, many)
  assert.deepEqual(c.calls.map((x) => x[1]), [100, 100, 5])
  assert.equal(Object.keys(out).length, 205)
})

test('readFeeds surfaces a wrong owner rather than returning the rest silently', async () => {
  const c = fakeConnection({ H100: account('H100'), A100: account('A100', OTHER) })
  await assert.rejects(readFeeds(c, MODELS), (e) => e.code === 'WRONG_OWNER')
})

test('watchFeed subscribes at the feed address, decodes updates, and routes bad ones to onError', async () => {
  const c = fakeConnection({})
  const updates = []
  const errors = []
  const stop = watchFeed(c, 'h200', (f) => updates.push(f), { onError: (e) => errors.push(e) })
  const [id, sub] = [...c.listeners.entries()][0]
  assert.equal(sub.pubkey, feedAddress('H200').toBase58())
  assert.deepEqual(sub.config, { commitment: 'confirmed' })

  sub.cb(account('H200'))
  assert.equal(updates.length, 1)
  assert.equal(updates[0].indexId, 'H200')

  sub.cb(account('H200', OTHER))
  sub.cb({ owner: PROGRAM, data: Buffer.alloc(10) })
  assert.equal(updates.length, 1, 'neither a foreign account nor a short one reaches the caller')
  assert.deepEqual(errors.map((e) => e.code), ['WRONG_OWNER', 'FEED_TOO_SHORT'])

  await stop()
  await stop()
  assert.equal(c.calls.filter((x) => x[0] === 'removeAccountChangeListener').length, 1, 'unsubscribing twice removes once')
  assert.equal(c.listeners.has(id), false)
})

test('watchFeed honours a commitment and lets a throw in the caller\'s own callback propagate', () => {
  const c = fakeConnection({})
  watchFeed(c, 'H100', () => { throw new Error('mine') }, { commitment: 'finalized', onError: () => assert.fail('a bug in the callback is not a decode error') })
  const sub = [...c.listeners.values()][0]
  assert.deepEqual(sub.config, { commitment: 'finalized' })
  assert.throws(() => sub.cb(account('H100')), /mine/)
})
