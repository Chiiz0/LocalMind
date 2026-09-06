import { type Framework } from '@toeverything/infra';

import { WorkspaceServerService } from '../cloud';
import { WorkspaceDBService } from '../db';
import { DocsService } from '../doc';
import { NbstoreService } from '../storage';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { FolderNode } from './entities/folder-node';
import { FolderTree } from './entities/folder-tree';
import { OrganizeService } from './services/organize';
import { DirectoryAccessStore } from './stores/directory-access';
import { FolderStore } from './stores/folder';

export type { FolderNode } from './entities/folder-node';
export { OrganizeService } from './services/organize';

export function configureOrganizeModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(OrganizeService)
    .entity(FolderTree, [FolderStore])
    .entity(FolderNode, [FolderStore])
    .store(DirectoryAccessStore, [
      WorkspaceService,
      WorkspaceServerService,
      NbstoreService,
    ])
    .store(FolderStore, [
      WorkspaceDBService,
      DocsService,
      DirectoryAccessStore,
    ]);
}
