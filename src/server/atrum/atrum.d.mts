/**
 * Types for the copy of atrum-core's `circuits/scripts/lib/atrum.mjs`.
 *
 * Declared here rather than annotated in the .mjs itself, for the reason `elgamal.d.mts`
 * gives: that file is a VERBATIM copy and must stay byte-identical, because a second
 * implementation of these hashing rules is exactly how the three that must agree (circuit,
 * contract, JS) drift apart.
 *
 * Written when proving moved into the browser. The module was always runtime-neutral by
 * design -- its own header says it is bundled by the browser client -- but it was only ever
 * imported from server code, where the untyped `declare module "./atrum.mjs"` shim was
 * enough. Client code needs the real signatures.
 */
export declare const FIELD_SIZE: bigint;
export declare const DEPTH: number;
export declare const UNIT_BITS: bigint;
export declare const AMOUNT_BITS: bigint;
export declare const NULLIFIER_DOMAIN: bigint;
export declare const ZERO_VALUE: bigint;

export declare const OUTCOME_UNBET: bigint;
export declare const OUTCOME_YES: bigint;
export declare const OUTCOME_NO: bigint;

export declare const MAX_DENOMINATION_EXPONENT: number;
export declare const DENOMINATIONS: bigint[];

/** Builds Poseidon. Must be awaited before any hashing call below. */
export declare function init(): Promise<unknown>;

export declare function hash2(a: bigint, b: bigint): bigint;

export interface NoteFields {
  nullifier: bigint;
  secret: bigint;
  marketId: bigint;
  outcome: bigint;
  units: bigint;
}
export declare function noteCommitment(note: NoteFields): bigint;
export declare function nullifierHash(nullifier: bigint): bigint;

export declare function packBetData(marketId: bigint, outcome: bigint, units: bigint): bigint;
export declare function packPayoutData(recipient: bigint | string, units: bigint): bigint;
export declare function packMarketMeta(marketId: bigint, outcome: bigint): bigint;
export declare function packRedeemMeta(
  marketId: bigint,
  outcome: bigint,
  totalPool: bigint,
  winningPool: bigint,
): bigint;
export declare function packWithdrawData(
  unbetExit: boolean,
  recipient: bigint | string,
  amount: bigint,
): bigint;

export declare function isValidDenomination(units: bigint | number): boolean;
export declare function snapToDenomination(units: bigint | number): bigint | null;

export declare function derivedFiller(treeStart: bigint | number, slot: bigint | number): bigint;
export declare const PAD_DOMAIN_HEX: string;

export declare class MerkleTree {
  constructor(depth?: number, zeroValue?: bigint);
  readonly leaves: bigint[];
  insert(leaf: bigint): void;
  root(): bigint;
  path(index: number): { pathElements: bigint[]; pathIndices: number[] };
}
