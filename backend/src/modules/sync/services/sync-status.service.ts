import { SyncService } from "@/modules/sync/services/sync.service.js";
import type { SyncRuntimeStatus } from "@/modules/sync/services/shared/sync.types.js";

export const getSyncRuntimeStatus = async (): Promise<SyncRuntimeStatus> => {
  return SyncService.getLastSyncStatus();
};
