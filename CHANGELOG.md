# Changelog

This package follows [semantic versioning](https://semver.org/). The account layout it decodes is
fixed by a deployed Solana program, so a breaking change here means a change to this API, not to
the chain.

## 1.0.0

First public release.

- `readFeed`, `readFeeds`, `watchFeed`: read the GPU-hour price index from Solana, no key needed.
- `feedAddress`: feed accounts are derived, not looked up in a table.
- `checkFreshness`: refuses a feed that has gone quiet, the check a price consumer must not skip.
- `decodeFeed` verifies the Anchor discriminator and every read verifies the account owner, so
  neither another account type nor a look-alike account can be read as a price.
- Model ids are case-insensitive; the chain keys feeds on the uppercase name.
- `@inferra-trade/gpu-index/codec`: constants, decoding and the freshness check with no
  dependency at all, for callers who already hold the account bytes or cannot take a Solana client
  into their bundle. `@solana/web3.js` is an optional peer dependency.
- Failures throw `InferraIndexError` with a stable `code`.
- ES module and CommonJS builds, with types for both.
