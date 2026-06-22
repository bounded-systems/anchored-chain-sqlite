// Drift guard for src/migrations.generated.ts — the embedded migration SQL must
// match the .sql files (drizzle's source of truth). Run `bun run migrations` to
// regenerate. Moved here from bounded-systems/prx on extraction.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../../scripts/gen-migrations.ts";

const GENERATED = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations.generated.ts",
);

describe("src/migrations.generated.ts", () => {
  test("is up to date with `bun run migrations`", () => {
    const onDisk = readFileSync(GENERATED, "utf8");
    expect(onDisk).toEqual(render());
  });
});
