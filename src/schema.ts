import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Drizzle table storing the current digest for each ref name (compare-and-swap store).
 */
export const refs = sqliteTable("refs", {
  name: text("name").primaryKey(),
  digest: text("digest").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Drizzle table storing the audit log of all ref changes (digest transitions with reason and timestamp).
 */
export const refLog = sqliteTable(
  "ref_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    prevDigest: text("prev_digest"),
    newDigest: text("new_digest").notNull(),
    reason: text("reason").notNull(),
    ts: integer("ts").notNull(),
  },
  (t) => ({
    refLogNameTs: index("ref_log_name_ts").on(t.name, t.ts),
  }),
);

/**
 * Drizzle table storing derivation records with reproducible manifest digests and optional DSSE envelopes for signature provenance.
 */
export const derivations = sqliteTable("derivations", {
  derivationId: text("derivation_id").primaryKey(),
  producer: text("producer").notNull(),
  manifestJson: text("manifest_json").notNull(),
  // Nullable DSSE envelope (in-toto Statement, base64 payload + signatures).
  // Null = unsigned derivation; present = signed provenance. See
  // docs/anchored-chain/in-toto-alignment-plan.md (Phase 1).
  envelopeJson: text("envelope_json"),
  ts: integer("ts").notNull(),
});

/**
 * Drizzle table mapping derivations to their input references (name-to-digest bindings indexed for lineage traversal).
 */
export const derivationInputs = sqliteTable(
  "derivation_inputs",
  {
    derivationId: text("derivation_id")
      .notNull()
      .references(() => derivations.derivationId),
    inputName: text("input_name").notNull(),
    inputDigest: text("input_digest").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.derivationId, t.inputName] }),
    inputDigestIdx: index("derivation_inputs_digest").on(t.inputDigest),
  }),
);

/**
 * Drizzle table mapping derivations to their output references (name-to-digest bindings indexed for descendant invalidation).
 */
export const derivationOutputs = sqliteTable(
  "derivation_outputs",
  {
    derivationId: text("derivation_id")
      .notNull()
      .references(() => derivations.derivationId),
    outputName: text("output_name").notNull(),
    outputDigest: text("output_digest").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.derivationId, t.outputName] }),
    outputDigestIdx: index("derivation_outputs_digest").on(t.outputDigest),
  }),
);

/**
 * Aggregated Drizzle schema object containing all tables for the anchored-chain store.
 */
export const schema = {
  refs,
  refLog,
  derivations,
  derivationInputs,
  derivationOutputs,
};
