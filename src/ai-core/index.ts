/* AI Core Engine — public entrypoint.
 * Phase 1 ships Layer 1 (Universal Upload Engine) only.
 * Subsequent phases will add: classify/, extract/, verify/, connector/, memory/. */
export { UploadEngine } from "./upload/UploadEngine";
export { useUploadEngine } from "./upload/hooks";
export type { UploadItem, UploadEngineProps, UploadEngineAccept, UploadStatus } from "./upload/types";