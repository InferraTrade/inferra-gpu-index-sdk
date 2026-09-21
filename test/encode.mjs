import { FEED_ACCOUNT_BYTES, FEED_DISCRIMINATOR, PX_SCALE, indexIdBytes } from '../dist/esm/codec.js'

/** Build an account body exactly as the Anchor program lays it out. Shared by the test files. */
export function encodeFeed({ indexId, px, ts, blockTs, pxRaw, discriminator = FEED_DISCRIMINATOR }) {
  const b = Buffer.alloc(FEED_ACCOUNT_BYTES)
  Buffer.from(discriminator).copy(b, 0)
  Buffer.from(indexIdBytes(indexId)).copy(b, 8)
  b.writeBigUInt64LE(pxRaw ?? BigInt(Math.round(px * PX_SCALE)), 24)
  b.writeBigUInt64LE(BigInt(ts), 32)
  b.writeBigInt64LE(BigInt(blockTs), 40)
  return new Uint8Array(b)
}
