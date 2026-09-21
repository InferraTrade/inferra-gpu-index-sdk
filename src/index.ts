/**
 * Read the Inferra GPU-hour price index from Solana.
 *
 * The index is a plain account per GPU model, owned by the index program and written by a Chainlink
 * DON. Reading one needs no key, no transaction and no permission from us: derive the address,
 * fetch the account, decode 49 bytes. This package does those three steps, and makes the check a
 * consumer must not skip, freshness, hard to skip.
 *
 * ```ts
 * import { Connection } from '@solana/web3.js'
 * import { readFeed, checkFreshness } from '@inferra-trade/gpu-index'
 *
 * const connection = new Connection('https://api.mainnet-beta.solana.com')
 * const feed = await readFeed(connection, 'H100')
 *
 * if (feed && checkFreshness(feed, 1200).ok) {
 *   console.log(`H100 costs $${feed.px.toFixed(4)} per GPU-hour`)
 * }
 * ```
 *
 * `@solana/web3.js` is a peer dependency and is only needed for address derivation and RPC. If you
 * already have the bytes, import `@inferra-trade/gpu-index/codec` and depend on nothing.
 */

export * from './codec.js'
export { feedAddress, toPublicKey, type ProgramIdLike } from './address.js'
export {
  readFeed,
  readFeeds,
  watchFeed,
  type ReadOptions,
  type Unsubscribe,
  type WatchFeedOptions,
} from './rpc.js'
