/**
 * GH-1961 — end-to-end wiring example for the `Fetcher` boundary.
 *
 * This file is the executable form of the spike's exit-criterion-2 demo:
 * given any `Fetcher` (the caller supplies a real PR fetcher, an HTTP
 * fetcher, or a fixture-stubbed one) and a `AnchoredChainStore`, advance
 * `pr/<unit>` via CAS and append a `Derivation` whose manifest digest
 * is reproducible across runs.
 *
 * Imports stay relative to siblings inside the parity-chain module —
 * the extractability test (`__tests__/extractability.test.ts`) forbids
 * outbound deps and treats `__examples__/` as production code. The
 * example never imports a concrete fetcher; it receives one through
 * `args.fetcher` so the module can be lifted into a separate package
 * without rewriting the example.
 */
import { digestManifest, invalidateDescendants } from "@bounded-systems/anchored-chain";
import type {
  AnchoredChainStore,
  Derivation,
  Digest,
  Fetcher,
  SurfaceRef,
} from "@bounded-systems/anchored-chain";
import { sha256Hex } from "@bounded-systems/cas";

/**
 * Arguments for the end-to-end PR workflow.
 */
export interface RunPrEndToEndArgs {
  /**
   * Anchored-chain store for persisting refs and derivations.
   */
  readonly store: AnchoredChainStore;
  /**
   * Fetcher implementation to retrieve PR content and freshness signals.
   */
  readonly fetcher: Fetcher;
  /**
   * Surface reference (e.g. `pr/<unit>`) to advance via CAS.
   */
  readonly surface: SurfaceRef;
  /**
   * Timestamp for the derivation and ref update (milliseconds since epoch).
   */
  readonly now: number;
  /**
   * Optional producer identifier; defaults to `"fetcher:gh-pr"`.
   */
  readonly producer?: string;
}

/**
 * Result of the end-to-end PR workflow.
 */
export interface RunPrEndToEndResult {
  /**
   * Whether a new derivation was appended; `false` if the derivation already existed.
   */
  readonly appended: boolean;
  /**
   * Digest of the ref after the CAS operation.
   */
  readonly refDigest: Digest;
  /**
   * Digest ID of the derivation that was appended or reused.
   */
  readonly derivationId: Digest;
  /**
   * Freshness signal from the fetched content (e.g. commit SHA, ETag).
   */
  readonly freshnessSignal: string;
  /**
   * Digests of descendant derivations that were invalidated by the ref change.
   */
  readonly invalidated: readonly Digest[];
}

const DEFAULT_PRODUCER = "fetcher:gh-pr";

/**
 * Execute an end-to-end PR workflow: fetch content, advance the surface ref via CAS, append a derivation with reproducible manifest digest, and invalidate dependent derivations.
 */
export async function runPrEndToEnd(args: RunPrEndToEndArgs): Promise<RunPrEndToEndResult> {
  const { store, fetcher, surface, now } = args;
  const producer = args.producer ?? DEFAULT_PRODUCER;

  const fetched = await fetcher.fetch(surface);
  const surfaceInputDigest = sha256Hex(surface.name);

  const manifest: Derivation["manifest"] = {
    producer,
    inputs: { surface: surfaceInputDigest },
    outputs: { pr: fetched.digest },
    contracts: [],
    params: {
      freshnessSignal: fetched.freshnessSignal,
      refName: surface.name,
    },
  };
  const derivationId = digestManifest(manifest);

  const existing = await store.derivations.get(derivationId);
  const prior = await store.refs.get(surface.name);

  if (existing) {
    return {
      appended: false,
      refDigest: prior?.digest ?? fetched.digest,
      derivationId,
      freshnessSignal: fetched.freshnessSignal,
      invalidated: [],
    };
  }

  await store.refs.cas({
    name: surface.name,
    prevDigest: prior?.digest ?? null,
    newDigest: fetched.digest,
    reason: producer,
    ts: now,
  });
  await store.derivations.append({ derivationId, manifest, ts: now });

  const invalidated = prior ? await invalidateDescendants(store, prior.digest) : [];

  return {
    appended: true,
    refDigest: fetched.digest,
    derivationId,
    freshnessSignal: fetched.freshnessSignal,
    invalidated,
  };
}
