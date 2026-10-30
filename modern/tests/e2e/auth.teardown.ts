import { rmSync } from "node:fs";

/** Session cookies are temporary test artifacts, not repository content. */
export default async function teardown(): Promise<void> {
  if (!process.env.INVENTORY_QA_SECRET_FILE) return;
  rmSync("test-results/.auth", { recursive: true, force: true });
}