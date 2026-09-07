import { Module } from '@nestjs/common';

import { DocStorageModule } from '../doc';
import { OfficeModule } from '../office';
import { PermissionModule } from '../permission';
import { ProjectModule } from '../project';
import { QuotaModule } from '../quota';
import { StorageModule } from '../storage';
import { ProjectDestinationFolderService } from './destination-folder-service';
import { ProjectDestinationResolver } from './destination-resolver';
import { ProjectImportService } from './import-service';
import { ProjectLegacyResolver } from './legacy-resolver';
import { ProjectResourceMigrationResolver } from './migration-resolver';
import { ProjectResourceMigrationService } from './migration-service';
import { ProjectPublicationResolver } from './publication-resolver';
import { ProjectPublicationService } from './publication-service';
import { ProjectImportResolver } from './resolver';
import { ProjectResourceSourceResolver } from './source-resolver';

@Module({
  imports: [
    DocStorageModule,
    OfficeModule,
    PermissionModule,
    ProjectModule,
    StorageModule,
    QuotaModule,
  ],
  providers: [
    ProjectLegacyResolver,
    ProjectResourceSourceResolver,
    ProjectResourceMigrationService,
    ProjectResourceMigrationResolver,
    ProjectImportService,
    ProjectImportResolver,
    ProjectDestinationResolver,
    ProjectPublicationService,
    ProjectPublicationResolver,
    ProjectDestinationFolderService,
  ],
  exports: [
    ProjectResourceMigrationService,
    ProjectImportService,
    ProjectPublicationService,
    ProjectDestinationFolderService,
  ],
})
export class ProjectTransferModule {}

export { ProjectImportService, ProjectPublicationService };
export {
  PROJECT_DESTINATION_FOLDER_WORKFLOW,
  ProjectDestinationFolderService,
} from './destination-folder-service';
export { ProjectPublicationConflict } from './publication-service';
