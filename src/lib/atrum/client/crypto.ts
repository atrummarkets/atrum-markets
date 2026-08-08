/**
 * The one place client code reaches into `server/atrum/` for the shared note primitives.
 *
 * `atrum.mjs` and `elgamal.mjs` are VERBATIM copies of atrum-core's, deliberately kept
 * runtime-neutral -- no `Buffer`, no `node:*`, `crypto.getRandomValues` rather than
 * `node:crypto` -- precisely so the browser can bundle them. `atrum.mjs`'s own header names
 * the browser client as an intended consumer. They live under `server/` only because that is
 * where they landed when the server was their sole caller; the directory is a historical
 * accident, not a boundary, and copying them to a second location is exactly how the three
 * implementations that must agree bit-for-bit (circuit, contract, JS) come apart.
 *
 * Re-exported through this module rather than imported directly all over the client so the
 * crossing is greppable and happens once. If these files ever move, one file changes.
 */
export {
  init,
  hash2,
  noteCommitment,
  nullifierHash,
  packMarketMeta,
  packRedeemMeta,
  packWithdrawData,
  isValidDenomination,
  snapToDenomination,
  FIELD_SIZE,
  DENOMINATIONS,
  OUTCOME_UNBET,
  OUTCOME_YES,
  OUTCOME_NO,
} from "@/server/atrum/atrum.mjs";

export { buildElGamal, SUBGROUP_ORDER } from "@/server/atrum/elgamal.mjs";
export type { ElGamal, Cipher, Point } from "@/server/atrum/elgamal.mjs";
