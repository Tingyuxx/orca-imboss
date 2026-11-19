import type { ForkInfo } from "@shared/fork/types";
import { ipcRenderer } from "electron";

/**
 * The fork's slice of the `window.imb` API object.
 *
 * Mounted once in `src/preload/index.ts` as `fork: forkApi` (`// FORK-MOUNT:M2`),
 * so the renderer reaches it as `window.imb.fork.*`. Keeping the whole surface
 * in this file means upstream's preload changes never touch our channels (and
 * vice versa): the mount point is a single property.
 */
export const forkApi = {
  /** Fork identity: build version, upstream base, update-feed self-check. */
  info: () => ipcRenderer.invoke("fork:info") as Promise<ForkInfo>,
};
