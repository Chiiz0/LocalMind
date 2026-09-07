import { Module } from '@nestjs/common';

import { StorageRuntimeModule } from '../storage-runtime';
import { ProjectResourceController } from './controller';
import {
  ProjectFileRequestController,
  ProjectFileRequestResolver,
  ProjectFileRequestService,
} from './file-requests';
import { ProjectResourceGateway } from './gateway';
import { ProjectResourceResolver } from './resolver';
import { ProjectBlobStorage, ProjectResourceService } from './resources';

@Module({
  imports: [StorageRuntimeModule],
  providers: [
    ProjectBlobStorage,
    ProjectResourceService,
    ProjectResourceResolver,
    ProjectResourceGateway,
    ProjectFileRequestResolver,
    ProjectFileRequestService,
  ],
  controllers: [ProjectResourceController, ProjectFileRequestController],
  exports: [ProjectBlobStorage, ProjectResourceService],
})
export class ProjectModule {}

export { ProjectBlobStorage, ProjectResourceService };
