import type { Database } from "better-sqlite3";

/**
 * Fork-owned database migrations.
 *
 * Why a separate table instead of appending to `src/main/db/migrations.ts`:
 * upstream tracks its migrations as `PRAGMA user_version = <count>`, so a row
 * appended here would (a) conflict with upstream's own append on every sync and
 * (b) corrupt the bookkeeping — a database touched by the fork would report a
 * `user_version` the official build considers current and would then *skip* its
 * own next migration.
 *
 * Instead every fork migration has a stable string id and is recorded in
 * `fork_migrations`, which the official build never reads. Rules:
 * - never rename or reorder an id once it has run anywhere;
 * - prefix fork tables/columns with `fork_`;
 * - prefer *not* changing the schema at all (see fork/RUNBOOK.md).
 */
export interface ForkMigration {
  /** Stable, human-readable id, e.g. `"0001-fork-notes"`. */
  readonly id: string;
  readonly up: (db: Database) => void;
}

/**
 * All fork migrations, in application order. Empty by default — an empty list
 * means `applyForkMigrations` does nothing at all (it does not even create its
 * bookkeeping table), so a fork build that needs no schema change leaves the
 * upstream database byte-for-byte untouched.
 */
export const FORK_MIGRATIONS: readonly ForkMigration[] = [];

/** Apply pending fork migrations. Idempotent; safe to call on every startup. */
export function applyForkMigrations(db: Database): void {
  if (FORK_MIGRATIONS.length === 0) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS fork_migrations (
      id         TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const done = new Set(
    (
      db.prepare("SELECT id FROM fork_migrations").all() as Array<{ id: string }>
    ).map((row) => row.id),
  );

  for (const migration of FORK_MIGRATIONS) {
    if (done.has(migration.id)) continue;
    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare(
        "INSERT INTO fork_migrations (id, applied_at) VALUES (?, ?)",
      ).run(migration.id, Date.now());
    });
    apply();
  }
}
