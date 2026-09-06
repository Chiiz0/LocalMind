import { Entity, LiveData } from '@toeverything/infra';
import { map } from 'rxjs';

import type { FolderStore } from '../stores/folder';
import { FolderNode } from './folder-node';

export class FolderTree extends Entity {
  constructor(private readonly folderStore: FolderStore) {
    super();
  }

  readonly rootFolder = this.framework.createEntity(FolderNode, {
    id: null,
  });

  isLoading$ = LiveData.from(this.folderStore.watchIsLoading(), true);
  error$ = LiveData.from(this.folderStore.watchError(), null);
  canMutate$ = LiveData.from(this.folderStore.watchCanMutate(), false);

  refresh() {
    return this.folderStore.refresh();
  }

  // get folder by id
  folderNode$(id: string) {
    return LiveData.from(
      this.folderStore.watchNodeInfo(id).pipe(
        map(info => {
          if (!info) {
            return null;
          }
          return this.framework.createEntity(FolderNode, {
            id,
          });
        })
      ),
      null
    );
  }
}
