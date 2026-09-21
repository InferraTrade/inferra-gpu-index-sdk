import type { AccountInfo, Commitment, Connection, PublicKey } from '@solana/web3.js'
import { feedAddress, toPublicKey, type ProgramIdLike } from './address.js'
import { INDEX_PROGRAM_ID, type Model } from './constants.js'
import { InferraIndexError } from './errors.js'
import { decodeFeed, type Feed } from './feed.js'

/** `getMultipleAccountsInfo` is capped at 100 addresses per request by the JSON-RPC node. */
const MAX_ACCOUNTS_PER_REQUEST = 100

/** Options shared by every read. */
export interface ReadOptions {
  /** Which program owns the feed. Defaults to the Inferra index program. */
  programId?: ProgramIdLike
  /** Commitment level for the RPC call. Defaults to the connection's own. */
  commitment?: Commitment
}

/** An account at the right address but owned by something else is not this feed. */
function assertOwnedByProgram(owner: PublicKey, programId: PublicKey, model: Model): void {
  if (!owner.equals(programId)) {
    throw new InferraIndexError(
      'WRONG_OWNER',
      `feed for ${model} is owned by ${owner.toBase58()}, not ${programId.toBase58()}`,
    )
  }
}

function decodeOwned(info: AccountInfo<Buffer> | null, programId: PublicKey, model: Model): Feed | null {
  if (!info) return null
  assertOwnedByProgram(info.owner, programId, model)
  return decodeFeed(info.data)
}

/**
 * Read one feed.
 *
 * Needs no key, no signature and no transaction: the account is public and reading it is free.
 * Returns `null` when the account does not exist on the cluster this connection points at, which
 * is the normal answer for a model that is published on mainnet but not on devnet, or the other
 * way round.
 */
export async function readFeed(
  connection: Connection,
  model: Model,
  options: ReadOptions = {},
): Promise<Feed | null> {
  const program = toPublicKey(options.programId ?? INDEX_PROGRAM_ID)
  const info = await connection.getAccountInfo(feedAddress(model, program), options.commitment)
  return decodeOwned(info, program, model)
}

/**
 * Read many feeds, batching into as few round trips as the node allows.
 *
 * Missing accounts come back as `null` rather than being dropped, so the shape of the result always
 * matches the models you asked for and a loop over it cannot silently skip one. Keys are the model
 * ids exactly as you passed them.
 */
export async function readFeeds(
  connection: Connection,
  models: readonly Model[],
  options: ReadOptions = {},
): Promise<Record<string, Feed | null>> {
  const program = toPublicKey(options.programId ?? INDEX_PROGRAM_ID)
  const out: Record<string, Feed | null> = {}

  for (let i = 0; i < models.length; i += MAX_ACCOUNTS_PER_REQUEST) {
    const chunk = models.slice(i, i + MAX_ACCOUNTS_PER_REQUEST)
    const infos = await connection.getMultipleAccountsInfo(
      chunk.map((m) => feedAddress(m, program)),
      options.commitment,
    )
    chunk.forEach((model, j) => {
      out[model] = decodeOwned(infos[j] ?? null, program, model)
    })
  }

  return out
}

/** Stop a subscription opened by {@link watchFeed}. Safe to call more than once. */
export type Unsubscribe = () => Promise<void>

/** Options for {@link watchFeed}. */
export interface WatchFeedOptions extends ReadOptions {
  /**
   * Called when an update arrives that cannot be used: the account failed to decode, or it is not
   * owned by the program. Without this the subscription can only drop such an update, and a
   * subscriber that silently drops updates looks the same as a market that stopped moving.
   */
  onError?: (error: unknown) => void
}

/**
 * Subscribe to a feed over the connection's websocket. The callback fires on every write, so there
 * is nothing to poll.
 *
 * Returns the unsubscribe function. Call it when you are done: an abandoned account subscription
 * keeps a websocket open and keeps your RPC provider billing for it.
 */
export function watchFeed(
  connection: Connection,
  model: Model,
  onUpdate: (feed: Feed) => void,
  options: WatchFeedOptions = {},
): Unsubscribe {
  const program = toPublicKey(options.programId ?? INDEX_PROGRAM_ID)

  const id = connection.onAccountChange(
    feedAddress(model, program),
    (account) => {
      let feed: Feed
      try {
        assertOwnedByProgram(account.owner, program, model)
        feed = decodeFeed(account.data)
      } catch (error) {
        options.onError?.(error)
        return
      }
      onUpdate(feed)
    },
    { commitment: options.commitment ?? 'confirmed' },
  )

  let closed = false
  return async () => {
    if (closed) return
    closed = true
    await connection.removeAccountChangeListener(id)
  }
}
