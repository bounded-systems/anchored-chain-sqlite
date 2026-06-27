import { test } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertSeam } from "@bounded-systems/seam-check";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The SQLite/Drizzle store: the one place bun:sqlite + drizzle-orm are allowed.
// It builds on the pure @bounded-systems/anchored-chain core (the store
// interfaces it implements) and @bounded-systems/cas — nothing from the
// pr-state monolith. Prod also materializes embedded migrations to a temp dir
// (node:fs/os/path). `__examples__` count as test files alongside `__tests__`.
test("@bounded-systems/anchored-chain-sqlite upholds its seam claim", () => {
  assertSeam({
    root: SRC,
    prod: [
      "bun:sqlite",
      "drizzle-orm",
      "drizzle-orm/sqlite-core",
      "drizzle-orm/bun-sqlite",
      "drizzle-orm/bun-sqlite/migrator",
      "node:url",
      "node:fs",
      "node:os",
      "node:path",
      "@bounded-systems/anchored-chain",
      "@bounded-systems/cas",
    ],
    test: ["@bounded-systems/anchored-chain-sqlite", "@bounded-systems/seam-check"],
    isTestFile: (f) =>
      f.includes("/__tests__/") || f.endsWith(".test.ts") || f.includes("/__examples__/"),
  });
});
