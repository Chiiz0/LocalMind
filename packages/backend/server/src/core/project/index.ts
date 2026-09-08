import { Module } from '@nestjs/common';

import { StorageRuntimeModule } from '../storage-runtime';
import { ProjectResourceController } from './controller';
import { ProjectEditLeaseResolver } from './edit-lease-resolver';
import {
  ProjectFileRequestController,
  ProjectFileRequestResolver,
  ProjectFileRequestService,
} from './file-requests';
import { ProjectResourceGateway } from './gateway';
import { ProjectRealtimeProvider } from './realtime';
import { ProjectResourceResolver } from './resolver';
import { ProjectBlobStorage, ProjectResourceService } from './resources';

@Module({
  imports: [StorageRuntimeModule],
  providers: [
    ProjectBlobStorage,
    ProjectResourceService,
    ProjectResourceResolver,
    ProjectEditLeaseResolver,
    ProjectResourceGateway,
    ProjectRealtimeProvider,
    ProjectFileRequestResolver,
    ProjectFileRequestService,
  ],
  controllers: [ProjectResourceController, ProjectFileRequestController],
  exports: [ProjectBlobStorage, ProjectResourceService],
})
export class ProjectModule {}

export { ProjectBlobStorage, ProjectResourceService };
