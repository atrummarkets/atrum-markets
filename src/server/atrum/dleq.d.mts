/** Types for the copy of atrum-core's `circuits/scripts/lib/dleq.mjs`. See elgamal.d.mts. */
import type { ElGamal, Point } from "./elgamal.mjs";

export interface DLEQProof { D: Point; A: Point; B: Point; z: bigint }
export interface DLEQ {
  H: Point;
  prove(c1: Point): DLEQProof;
}
export declare function buildDLEQ(elgamal: ElGamal, secret: string | bigint): DLEQ;
