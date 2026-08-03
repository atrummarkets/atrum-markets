/**
 * Types for the copy of atrum-core's `circuits/scripts/lib/elgamal.mjs`.
 *
 * Declared here rather than annotated in the .mjs itself: that file is a VERBATIM copy of
 * atrum-core's, and it must stay byte-identical -- its own header explains that a second
 * implementation of these rules is how the three that must agree (circuit, contract, JS)
 * drift apart. Typing it from outside keeps the copy pristine.
 */
export type Point = unknown;
export interface Cipher { c1: Point; c2: Point }

export interface ElGamal {
  babyJub: {
    Base8: Point;
    addPoint(a: Point, b: Point): Point;
    mulPointEscalar(p: Point, s: bigint): Point;
  };
  F: { e(v: bigint): unknown };
  IDENTITY: Point;
  negate(p: Point): Point;
  asPair(p: Point): [bigint, bigint];
  samePoint(a: Point, b: Point): boolean;
  randomScalar(): bigint;
  encrypt(m: bigint, r: bigint): Cipher;
  decrypt(c1: Point, c2: Point, bound: bigint): bigint;
  addCiphertext(a: Cipher, b: Cipher): Cipher;
}

export declare function buildElGamal(
  pubKey: readonly [string, string] | readonly [bigint, bigint],
  secret?: string | bigint | null,
): Promise<ElGamal>;

export declare const SUBGROUP_ORDER: bigint;
