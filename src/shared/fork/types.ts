/**
 * Types for the data this fork exposes to the renderer.
 *
 * Kept in `src/shared/` (not `src/fork/`) on purpose: `tsconfig.node.json` and
 * `tsconfig.web.json` both list `src/shared/**`, so no tsconfig file has to be
 * edited for a fork type to compile in main, preload and renderer.
 */

/** Where a build came from, for the "which upstream am I based on?" question. */
export interface ForkInfo {
  /** Version compiled into this build (`APP_VERSION`). */
  appVersion: string;
  /** Upstream tag this fork was last rebased onto, e.g. `v1.24.0`. */
  baseTag: string;
  /** Commit of {@link ForkInfo.baseTag}. */
  baseCommit: string;
  /** ISO timestamp of the last upstream sync (see `fork/upstream-base.json`). */
  syncedAt: string;
  /**
   * Update feed actually compiled into the packaged app (read from
   * `resources/app-update.yml`). `null` when the file is missing — either a
   * non-packaged build or a build made without `publish` configured.
   */
  updateFeed: { owner: string; repo: string } | null;
  /**
   * `true` when the update feed points at *our* fork repo, `false` when it
   * points somewhere else (e.g. the official release channel, which would
   * silently replace this build with an official one), `null` before the check
   * could run (dev runs, or missing feed).
   */
  updateFeedOk: boolean | null;
}
