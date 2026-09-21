# @inferra-trade/gpu-index

[![CI](https://github.com/InferraTrade/inferra-gpu-index-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/InferraTrade/inferra-gpu-index-sdk/actions/workflows/ci.yml)

Read the Inferra GPU-hour price index from Solana.

The index publishes what an hour of a given datacenter GPU rents for, as one account per model,
owned by an on-chain program and written by a Chainlink DON every five minutes. Reading it needs no
API key, no transaction, no signature and no account with Inferra. This package derives the
address, fetches the account, decodes the 49 bytes and checks that the value is fresh.

```bash
npm install @inferra-trade/gpu-index @solana/web3.js
```

Node 20 or newer. ES module and CommonJS builds, with types for both.

## Quick start

```ts
import { Connection } from '@solana/web3.js'
import { readFeeds, checkFreshness, MODELS } from '@inferra-trade/gpu-index'

const connection = new Connection('https://api.mainnet-beta.solana.com')
const feeds = await readFeeds(connection, MODELS)

for (const [model, feed] of Object.entries(feeds)) {
  if (!feed) continue
  const { ok, reason, ageSeconds } = checkFreshness(feed, 1200)
  console.log(ok
    ? `${model}: $${feed.px.toFixed(4)}/GPU-h, written ${ageSeconds}s ago`
    : `${model}: unusable (${reason})`)
}
```

## Check freshness

A feed can go quiet: its sources disagreed, a circuit breaker fired, the publisher stopped. When
that happens the account keeps its last value rather than dropping to zero, so a plain read returns
a plausible number that is no longer current. Only its age tells you.

```ts
const feed = await readFeed(connection, 'H100')
if (!feed) throw new Error('no feed on this cluster')

const { ok, reason } = checkFreshness(feed, 1200)
if (!ok) {
  // Freeze. Do not fall back to a price of your own, and do not reuse the last one you cached.
  throw new Error(`H100 feed unusable: ${reason}`)
}
```

Pass the window your own contract or business rule enforces. `INFERRA_ESCROW_MAX_AGE_SECONDS`
(1200) is what the Inferra escrow enforces on chain today, exported as a reference point; it is one
contract's setting and can be changed by an authority transaction.

The check uses `blockTs`, the chain time of the last write, not `ts`, the index tick the value
represents: a publisher can attest an old tick, and only `blockTs` says when the chain last heard
from it.

## Models

| Model | SKU priced |
|---|---|
| `A100` | A100 80GB SXM |
| `H100` | H100 80GB SXM |
| `H200` | H200 141GB SXM |
| `B200` | B200 180GB |

Every model in `MODELS` is attested on Solana mainnet. Prices are aggregated from public rental
markets, filtered for outliers and reduced to a volume-weighted quantile; a model whose sources
fall below three, or whose price leaves its sanity band, halts instead of publishing. Method:
<https://index.inferra.trade/methodology>. Uptime and incidents: <https://index.inferra.trade/status>.

`MODELS` is autocomplete, not truth: a model can be retired, and a new one can appear on chain
before it appears in a release of this package. Every read accepts any string and answers `null`
for an account that does not exist. Ids are case-insensitive (`'h100'` reads the `H100` account).

## Without a Solana client

`@solana/web3.js` is an optional peer dependency, used only for address derivation and RPC. If you
have your own client, or a bundle that must not carry a Solana library, import the codec subpath
and depend on nothing:

```ts
import { decodeFeed, checkFreshness } from '@inferra-trade/gpu-index/codec'

const feed = decodeFeed(accountBytesFromYourOwnClient)
```

## API

Exported from `@inferra-trade/gpu-index`. The first group is also exported from
`@inferra-trade/gpu-index/codec`, which pulls in no dependencies.

| | |
|---|---|
| `decodeFeed(bytes)` | decode an account body into a `Feed`. Throws on a short account, on bytes that are not a Feed account, or on an unrepresentable price |
| `checkFreshness(feed, maxAgeSeconds, nowSeconds?)` | `{ ok, reason, ageSeconds }`. Throws if the window is missing or not positive |
| `indexIdBytes(model)` | the right-zero-padded 16 bytes the program keys feeds on |
| `MODELS`, `INDEX_PROGRAM_ID`, `PX_SCALE`, `FEED_SEED`, `FEED_DISCRIMINATOR`, `FEED_ACCOUNT_BYTES`, `INDEX_ID_BYTES`, `INFERRA_ESCROW_MAX_AGE_SECONDS` | constants |
| `InferraIndexError` | every throw from this package, with a `code` that is safe to branch on |
| `feedAddress(model, programId?)` | derive the account address. Same on devnet and mainnet |
| `readFeed(connection, model, options?)` | one feed, or `null` if the account does not exist on this cluster |
| `readFeeds(connection, models, options?)` | many feeds in as few requests as the node allows, missing ones as `null` |
| `watchFeed(connection, model, onUpdate, options?)` | subscribe over the websocket; returns an unsubscribe function |

`options` on the reads: `programId` (defaults to the Inferra index program) and `commitment`
(defaults to the connection's own; `watchFeed` defaults to `confirmed`). `watchFeed` also takes
`onError`, called with an update that failed to decode or is owned by another program; without it
such updates are dropped.

A `Feed` carries `indexId`, `px` (USD per GPU-hour), `pxRaw` (the scaled integer as the chain
stores it), `ts` (the index tick) and `blockTs` (when the write landed on chain).

Every read checks that the account is owned by the index program, and every decode checks the
Anchor discriminator, so neither a look-alike account nor another account type of the same program
can be read as a price. Error codes: `FEED_TOO_SHORT`, `NOT_A_FEED`, `PRICE_UNREPRESENTABLE`,
`MODEL_ID_TOO_LONG`, `WRONG_OWNER`, `BAD_ARGUMENT`.

## Verifying without this package

```bash
# The H100 feed account, on any explorer or RPC node
solana account 7QhvJpzt6vHFoNsFVFH4kXeXPmEhnoL6QCbPaDVd91sq --url mainnet-beta
```

Program `2bCR8fciYe6M4xogru1kNQb6fC4zdn9moUXEXdNxciNX`; feed address
`PDA(["feed", index_id])` with `index_id` the uppercase model name right-padded with zeros to 16
bytes. Account data: discriminator at 0..8, `index_id` at 8..24, `px` at 24..32 (little-endian u64,
USD per GPU-hour times 1e6), `ts` at 32..40, `block_ts` at 40..48, `bump` at 48.

There is also an HTTP API with a free tier, if you would rather not touch Solana:
<https://api.inferra.trade>. The on-chain path needs no key and no account, and stays that way.

## Licence

MIT. If you publish a number from this index, attribute it to the Inferra GPU Index and link
<https://index.inferra.trade> so a reader can check it.
