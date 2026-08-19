# @bounded-systems/anchored-chain-sqlite

The SQLite/Drizzle-backed implementation of the
[`@bounded-systems/anchored-chain`](https://github.com/bounded-systems/anchored-chain)
stores.

The pure core defines the ports (`RefStore`, `DerivationStore`,
`AnchoredChainStore`) but binds to no database. This package is where
`bun:sqlite` + `drizzle-orm` live: it implements those ports over a real
database, runs the bundled migrations, and offers lineage/invalidation queries
against persisted state. Consumers that only need the algorithms or contracts
import the core directly and never pull a database dependency.

> **Bun-only.** This package uses `bun:sqlite` and `drizzle-orm/bun-sqlite`, so it
> runs on [Bun](https://bun.sh), not Node.
>
> It publishes to [JSR](https://jsr.io/@bounded-systems/anchored-chain-sqlite), and
> JSR generates the npm-mirror manifest — which carries no `engines` and no `bun`
> export condition. So under npm/Node the install **succeeds silently** and the
> failure lands at import, as `ERR_UNSUPPORTED_ESM_URL_SCHEME: Received protocol
> 'bun:'`. That cannot be made to fail closed from this repo, and a runtime
> `typeof Bun` guard would not help either: ESM linking resolves `bun:sqlite`
> before any module body runs. Install it with Bun.

## Install

```sh
bun add @bounded-systems/anchored-chain-sqlite
```

`@bounded-systems/anchored-chain`, `@bounded-systems/cas`, and `drizzle-orm` come
along as dependencies.

## Usage

```ts
import { openAnchoredChain, sha256Hex } from "@bounded-systems/anchored-chain-sqlite";

// Open (and migrate) a store. The path is a string; ":memory:" for ephemeral.
// The whole core surface is re-exported here, so a store consumer needs only
// this one import.
const chain = openAnchoredChain("./provenance.db");

const sourceDigest = await sha256Hex(new TextEncoder().encode("source.tar"));
const bundleDigest = await sha256Hex(new TextEncoder().encode("bundle.tar"));

// Move a named ref forward under compare-and-swap.
await chain.refs.cas({
  name: "refs/artifacts/source",
  prevDigest: null,
  newDigest: sourceDigest,
  reason: "initial import",
  ts: Date.now(),
});

// Record an immutable production event: inputs -> outputs.
await chain.derivations.append({
  derivationId: bundleDigest,
  manifest: {
    producer: "builder@v1",
    inputs: { source: sourceDigest },
    outputs: { bundle: bundleDigest },
    contracts: [],
    params: {},
  },
  ts: Date.now(),
});

// Stale relative to the input digests currently in play (keyed by input name).
const stale = await chain.lineage.isStale(bundleDigest, { source: sourceDigest });

chain.close();
```

The store surface is `refs` (`get`, `cas`, `asOf`, `log`), `derivations`
(`append`, `get`, `listInputs`, `listOutputs`, `derivationsByOutput`), `lineage`
(`ancestors`, `descendants`, `isStale`), `invalidate` (`descendants`), and
`close`.

The migrations under `src/migrations/` are bundled with the package and applied
on open, so a fresh database is brought to the current schema automatically. In a
`bun build --compile` binary, where that folder is absent, the same schema is
materialized from SQL embedded at build time.

## Design

- **Database lives here, not in the core.** Keeping `bun:sqlite` + `drizzle-orm`
  in this package lets the pure `anchored-chain` core stay dependency-light and
  database-free.
- **Migrations travel with the code.** The drizzle journal + `.sql` files ship in
  the package and run on open, so the schema is self-describing.
- **Self-contained.** An extractability test enforces that the only outbound
  imports are the core, the CAS substrate, drizzle, and Bun/node builtins.

## License

[MIT](./LICENSE) © Bounded Systems
