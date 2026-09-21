import { FEED_ACCOUNT_BYTES, FEED_DISCRIMINATOR, INDEX_ID_BYTES, PX_SCALE, type Model } from './constants.js'
import { InferraIndexError } from './errors.js'

/** One decoded feed account: the price of one GPU model, and when it landed on chain. */
export interface Feed {
  /** The model this account carries, read back from the account rather than assumed. */
  readonly indexId: string
  /** USD per GPU-hour. */
  readonly px: number
  /** The same price as the chain stores it: USD per GPU-hour scaled by {@link PX_SCALE}. */
  readonly pxRaw: bigint
  /** The index tick this price represents, unix seconds. */
  readonly ts: number
  /**
   * When the value landed on chain, unix seconds.
   *
   * This is the freshness anchor, not `ts`. A publisher can attest an old tick; only `blockTs`
   * says when the chain last heard from it.
   */
  readonly blockTs: number
}

const encoder = /* @__PURE__ */ new TextEncoder()
const decoder = /* @__PURE__ */ new TextDecoder()

/**
 * The right-zero-padded 16-byte model id: the exact bytes the program keys feeds on.
 *
 * The chain keys feeds on the uppercase name, so the id is uppercased first; `'h100'` derives the
 * same address as `'H100'`. Throws rather than truncating a long id: a truncated id would derive
 * a valid-looking address for a different model.
 */
export function indexIdBytes(model: Model): Uint8Array {
  const bytes = encoder.encode(model.toUpperCase())
  if (bytes.length > INDEX_ID_BYTES) {
    throw new InferraIndexError(
      'MODEL_ID_TOO_LONG',
      `model id "${model}" is ${bytes.length} bytes; the program keys feeds on ${INDEX_ID_BYTES}`,
    )
  }
  const out = new Uint8Array(INDEX_ID_BYTES)
  out.set(bytes)
  return out
}

/**
 * Decode a Feed account body.
 *
 * Layout: 8 discriminator, `index_id[16]`, `px` u64, `ts` u64, `block_ts` i64, `bump` u8. Takes
 * plain bytes from any client, so an integration that already has its own RPC layer does not have
 * to adopt ours.
 *
 * The discriminator is checked: the program owns other account types, and bytes that are not a
 * feed are refused instead of being read as one. Ownership is checked separately, where the owner
 * is known (`readFeed`, `readFeeds`, `watchFeed`).
 */
export function decodeFeed(data: Uint8Array): Feed {
  if (data.length < FEED_ACCOUNT_BYTES) {
    throw new InferraIndexError(
      'FEED_TOO_SHORT',
      `feed account too short: ${data.length} bytes, expected at least ${FEED_ACCOUNT_BYTES}`,
    )
  }
  for (let i = 0; i < FEED_DISCRIMINATOR.length; i++) {
    if (data[i] !== FEED_DISCRIMINATOR[i]) {
      throw new InferraIndexError('NOT_A_FEED', 'account does not start with the Feed discriminator')
    }
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const idBytes = data.subarray(8, 8 + INDEX_ID_BYTES)
  const terminator = idBytes.indexOf(0)
  const pxRaw = view.getBigUint64(24, true)

  // u64 reaches past what a JavaScript number holds exactly. Real prices are nowhere near it, so a
  // value this large means the bytes are not a price, and rounding it would turn corrupt input
  // into a plausible number.
  if (pxRaw > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InferraIndexError(
      'PRICE_UNREPRESENTABLE',
      `scaled price ${pxRaw} exceeds Number.MAX_SAFE_INTEGER; read pxRaw instead`,
    )
  }

  return {
    indexId: decoder.decode(terminator === -1 ? idBytes : idBytes.subarray(0, terminator)),
    px: Number(pxRaw) / PX_SCALE,
    pxRaw,
    ts: Number(view.getBigUint64(32, true)),
    blockTs: Number(view.getBigInt64(40, true)),
  }
}
