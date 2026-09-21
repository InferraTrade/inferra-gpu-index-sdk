/** Machine-readable reason a call failed. Stable across releases; new members may be added. */
export type IndexErrorCode =
  /** the account is shorter than a Feed, so there is nothing safe to read out of it */
  | 'FEED_TOO_SHORT'
  /** the bytes do not start with the Feed discriminator: another account type, or not an account at all */
  | 'NOT_A_FEED'
  /** the scaled price does not fit a JavaScript number without losing integer precision */
  | 'PRICE_UNREPRESENTABLE'
  /** a model id longer than the 16 bytes the program keys feeds on */
  | 'MODEL_ID_TOO_LONG'
  /** an account at the right address, owned by the wrong program */
  | 'WRONG_OWNER'
  /** an argument this package refuses to guess a default for */
  | 'BAD_ARGUMENT'

/**
 * Every throw from this package is one of these.
 *
 * A library that throws bare `Error` forces callers to match on message text, which then breaks the
 * day someone improves the wording. `code` is the part that is safe to branch on.
 */
export class InferraIndexError extends Error {
  override readonly name = 'InferraIndexError'
  readonly code: IndexErrorCode

  constructor(code: IndexErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.code = code
  }
}
