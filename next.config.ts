import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Without this Turbopack walks up to the parent Projects/ directory (it has a lockfile of
    // its own) and infers the wrong workspace root.
    root: path.resolve(__dirname),
  },
  /**
   * The proving/circuit-stats routes read circuits-build/*.zkey|.wasm|.r1cs via a
   * runtime-joined fs path (see src/server/atrum/{prove,circuits}.ts), not a static
   * import -- Next's build-time file tracer can't see those reads, so without this the
   * binaries get dropped from the deployed serverless functions and every proof 500s.
   */
  outputFileTracingIncludes: {
    "/api/atrum/**": ["./circuits-build/**"],
  },
  async redirects() {
    return [
      { source: "/notes", destination: "/portfolio", permanent: false },
      { source: "/boundary", destination: "/wallet", permanent: false },
    ];
  },
};

export default nextConfig;
