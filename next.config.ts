import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The proving/circuit-stats routes read circuits-build/*.zkey|.wasm|.r1cs via a
   * runtime-joined fs path (see src/server/atrum/{prove,circuits}.ts), not a static
   * import -- Next's build-time file tracer can't see those reads, so without this the
   * binaries get dropped from the deployed serverless functions and every proof 500s.
   */
  outputFileTracingIncludes: {
    "/api/atrum/**": ["./circuits-build/**"],
  },
};

export default nextConfig;
