/**
 * The half of this package that needs no Solana library at all.
 *
 * Import from `@inferra-trade/gpu-index/codec` when you already have the account bytes, or when you
 * want the price in a bundle that must not carry a Solana client. Constants, decoding and the
 * freshness check, and no dependency to conflict with whatever version you already pin.
 *
 * ```ts
 * import { decodeFeed, checkFreshness } from '@inferra-trade/gpu-index/codec'
 *
 * const feed = decodeFeed(bytesYouAlreadyHave)
 * if (checkFreshness(feed, 1200).ok) console.log(feed.indexId, feed.px)
 * ```
 */

export {
  FEED_ACCOUNT_BYTES,
  FEED_DISCRIMINATOR,
  FEED_SEED,
  INDEX_ID_BYTES,
  INDEX_PROGRAM_ID,
  INFERRA_ESCROW_MAX_AGE_SECONDS,
  MODELS,
  PX_SCALE,
  type Model,
} from './constants.js'
export { InferraIndexError, type IndexErrorCode } from './errors.js'
export { decodeFeed, indexIdBytes, type Feed } from './feed.js'
export { checkFreshness, type Freshness } from './freshness.js'
