import { PublicKey } from '@solana/web3.js'
import { FEED_SEED, INDEX_PROGRAM_ID, type Model } from './constants.js'
import { indexIdBytes } from './feed.js'

/** A program id in either form. Strings are base58, as an explorer prints them. */
export type ProgramIdLike = PublicKey | string

const encoder = /* @__PURE__ */ new TextEncoder()

/** Accept either form at the boundary so callers never have to construct a `PublicKey` to pass one. */
export function toPublicKey(value: ProgramIdLike): PublicKey {
  return typeof value === 'string' ? new PublicKey(value) : value
}

/**
 * The feed account address for a model.
 *
 * Derived rather than looked up in a table. Seeds go in as `Uint8Array` rather than `Buffer` so
 * this runs in a browser as well as in Node.
 *
 * The same address on every cluster: a PDA depends on (seeds, program id) and nothing else, and the
 * program id is the same on devnet and mainnet. The model id is uppercased first (see
 * `indexIdBytes`).
 */
export function feedAddress(model: Model, programId: ProgramIdLike = INDEX_PROGRAM_ID): PublicKey {
  const seeds = [encoder.encode(FEED_SEED), indexIdBytes(model)]
  return PublicKey.findProgramAddressSync(seeds, toPublicKey(programId))[0]
}
