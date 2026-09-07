import { Module } from '@nestjs/common';

import { PermissionModule } from '../permission';
import { ProjectModule } from '../project';
import { RealtimeModule } from '../realtime';
import { StorageModule } from '../storage';
import { OfficeArtifactService } from './artifact-service';
import { OfficeCommandService } from './command-service';
import { OfficeCommentResolver } from './comment-resolver';
import { OfficeCommentService } from './comment-service';
import { OfficeController } from './controller';
import { OfficeDocxCommandService } from './docx-command';
import { OfficeDocxImportService } from './docx-import';
import { OfficeImportService } from './import-service';
import { ProjectOfficeController } from './project-controller';
import { ProjectResourceIndexer } from './project-indexer';
import { ProjectOfficeResolver } from './project-resolver';
import { OfficeResolver } from './resolver';
import { OfficeResourceStorage } from './resource-storage';

@Module({
  imports: [PermissionModule, ProjectModule, RealtimeModule, StorageModule],
  controllers: [OfficeController, ProjectOfficeController],
  providers: [
    OfficeArtifactService,
    OfficeResourceStorage,
    OfficeCommentResolver,
    OfficeCommentService,
    OfficeCommandService,
    OfficeDocxCommandService,
    OfficeDocxImportService,
    OfficeImportService,
    OfficeResolver,
    ProjectOfficeResolver,
    ProjectResourceIndexer,
  ],
  exports: [
    OfficeArtifactService,
    OfficeCommentService,
    OfficeCommandService,
    OfficeDocxCommandService,
    OfficeDocxImportService,
    OfficeImportService,
    ProjectResourceIndexer,
  ],
})
export class OfficeModule {}

export * from './artifact-service';
export * from './command-service';
export * from './comment-resolver';
export * from './comment-service';
export * from './comment-types';
export * from './controller';
export * from './docx-command';
export * from './docx-import';
export * from './evidence';
export * from './formats';
export * from './import-service';
export * from './resolver';
export * from './types';
