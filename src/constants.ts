/**
 * Facts about the on-chain feed, and nothing else.
 *
 * No import in this file reaches for a Solana library. Version conflicts on `@solana/web3.js` are
 * the usual reason an integration stalls, and decoding a feed does not need a client. Everything
 * re-exported through `@inferra-trade/gpu-index/codec` inherits that property, so it drops into a
 * browser bundle, an edge worker, or a service that already pins its own Solana version.
 */

/**
 * The index program, base58.
 *
 * Identical on devnet and mainnet: the same program keypair is deployed to both, and a PDA derives
 * from (seeds, program id) alone, so every feed address matches across clusters too. What differs
 * between clusters is which feeds exist, not where they live.
 *
 * A string rather than a `PublicKey` so this module stays dependency-free. `feedAddress` accepts
 * either form.
 */
export const INDEX_PROGRAM_ID = '2bCR8fciYe6M4xogru1kNQb6fC4zdn9moUXEXdNxciNX'

/** First PDA seed for every feed account. */
export const FEED_SEED = 'feed'

/** Width of the `index_id` field on chain: a right-zero-padded `[u8; 16]`. */
export const INDEX_ID_BYTES = 16

/** Prices are USD per GPU-hour, scaled by 1e6 on chain. */
export const PX_SCALE = 1_000_000

/** Exact size of a Feed account: 8 discriminator + 16 index_id + 8 px + 8 ts + 8 block_ts + 1 bump. */
export const FEED_ACCOUNT_BYTES = 49

/**
 * The first 8 bytes of every Feed account: `sha256("account:Feed")[0..8]`, the Anchor account
 * discriminator. The program's other account type (its config) starts with different bytes, so
 * this is what tells a feed apart from another account owned by the same program.
 */
export const FEED_DISCRIMINATOR: Uint8Array = /* @__PURE__ */ Uint8Array.of(69, 191, 16, 227, 132, 187, 84, 227)

/**
 * The staleness window the Inferra escrow enforces on chain today, in seconds.
 *
 * A reference point, not a recommendation and not a promise: it is one contract's setting, and an
 * authority transaction can change it. Pass `checkFreshness` the window your own contract or
 * business rule enforces; if you do not have one, decide it before using the price.
 */
export const INFERRA_ESCROW_MAX_AGE_SECONDS = 1200

/**
 * The models the index publishes and attests on Solana mainnet.
 *
 * Four, and the list is short on purpose: everything named here has an on-chain feed, so any
 * number the index quotes can be checked by someone who does not trust us.
 *
 * Treat it as autocomplete rather than as truth. A model can be retired, and a new one can appear
 * on chain before it appears in a release of this package, so `readFeeds` accepts any string and
 * answers `null` for an account that does not exist.
 */
export const MODELS = ['A100', 'H100', 'H200', 'B200'] as const

/**
 * A known model, or any other string the chain might carry.
 *
 * Ids are matched case-insensitively: the chain keys feeds on the uppercase name, and this package
 * uppercases before deriving an address, so `'h100'` and `'H100'` read the same account.
 */
export type Model = (typeof MODELS)[number] | (string & {})
