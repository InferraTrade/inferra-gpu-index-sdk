import { InferraIndexError } from './errors.js'
import type { Feed } from './feed.js'

/** The verdict from {@link checkFreshness}. */
export interface Freshness {
  /** Whether the price may be used. */
  readonly ok: boolean
  /** Why it may not be, in words meant for a log line. `null` when `ok`. */
  readonly reason: string | null
  /** How old the on-chain write is, in seconds. Negative if the chain clock ran ahead of yours. */
  readonly ageSeconds: number
}

/**
 * The check that must not be skipped.
 *
 * A feed can go quiet: sources disagreed, a circuit breaker fired, the publisher stopped. When
 * that happens the account keeps its last value rather than dropping to zero, so a plain read
 * returns a plausible number that is no longer current. Only its age tells you.
 *
 * So: freeze on stale. Do not trade, settle, quote or bill on a feed that fails this check, and do
 * not substitute a fallback price of your own.
 *
 * @param maxAgeSeconds the window your own contract or business rule enforces. See
 *   {@link INFERRA_ESCROW_MAX_AGE_SECONDS} for what Inferra's escrow uses, as a reference point.
 * @param nowSeconds unix seconds, defaults to this machine's clock.
 */
export function checkFreshness(
  feed: Feed,
  maxAgeSeconds: number,
  nowSeconds: number = Date.now() / 1000,
): Freshness {
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
    throw new InferraIndexError(
      'BAD_ARGUMENT',
      `maxAgeSeconds must be a positive number of seconds, got ${maxAgeSeconds}`,
    )
  }

  const ageSeconds = Math.round(nowSeconds - feed.blockTs)

  if (feed.pxRaw <= 0n || feed.blockTs <= 0) {
    return { ok: false, reason: 'feed has never been written', ageSeconds }
  }
  if (ageSeconds > maxAgeSeconds) {
    return { ok: false, reason: `stale by ${ageSeconds - maxAgeSeconds}s`, ageSeconds }
  }
  return { ok: true, reason: null, ageSeconds }
}
