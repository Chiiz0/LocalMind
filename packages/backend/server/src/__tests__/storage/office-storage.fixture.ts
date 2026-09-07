import { OfficeResourceStorage } from '../../core/office/resource-storage';
import type { ProjectBlobStorage } from '../../core/project';
import type { WorkspaceBlobStorage } from '../../core/storage';

export function workspaceOfficeStorage(storage: WorkspaceBlobStorage) {
  return new OfficeResourceStorage(storage, {} as ProjectBlobStorage);
}
