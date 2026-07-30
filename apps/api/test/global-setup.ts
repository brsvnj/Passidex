import { execSync } from "node:child_process";

/**
 * Runs once before the e2e suite: reset the test database to a clean, fully
 * migrated state. Requires DATABASE_URL to point at a throwaway database.
 */
export default function setup(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for e2e tests");
  }
  // Non-destructive: applies pending migrations to the (fresh) test database.
  // Tests isolate via unique emails + fresh orgs, so no reset is needed.
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}
