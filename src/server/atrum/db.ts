import { Pool } from "pg";

/**
 * Shared connection pool. One per server process (Next.js reuses the module across requests
 * within a warm serverless instance), so this must not be re-created per call -- that's how
 * a serverless deployment exhausts a database's connection limit under load.
 */
let pool: Pool | null = null;

export function db(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("missing required env var DATABASE_URL");
  pool = new Pool({ connectionString });
  return pool;
}
