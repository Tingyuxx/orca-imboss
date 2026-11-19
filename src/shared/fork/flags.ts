/**
 * Master switches for everything this fork (imboss-fork) adds.
 *
 * The upstream convention this file follows: a feature is a self-contained
 * module plus **one** constant that is its only integration point (see
 * `src/shared/constants/spend.ts`, `SPEND_STATS_ENABLED`). Copy that shape for
 * every new fork feature instead of editing upstream logic:
 *
 * ```ts
 * // 1. a new flag here, defaulting to false until the feature is finished
 * export const FORK_NOTES_ENABLED = false;
 * // 2. the feature lives in its own files (src/main/fork/…, src/renderer/fork/…)
 * // 3. it is mounted through a FORK-MOUNT line (see fork/integration-points.md)
 * ```
 *
 * Because these are plain constants, `FORK_ENABLED = false` removes every fork
 * channel and UI at once — useful for bisecting an upstream regression without
 * touching any upstream code.
 */
export const FORK_ENABLED = true;
