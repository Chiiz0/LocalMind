import { createHash } from 'node:crypto';

import {
  Args,
  Field,
  ID,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';

import { BadRequest, Throttle } from '../../base';
import { Models } from '../../models';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { DocReader } from '../doc';
import { ProjectResourceType } from '../project/types';
import { ProjectImportService } from './import-service';

@ObjectType()
class ProjectResourceSourceType {
  @Field(() => ID) workspaceId!: string;
  @Field(() => ID) sourceResourceId!: string;
  @Field() title!: string;
  @Field() workspaceName!: string;
  @Field() sourceVersion!: string;
  @Field(() => Int) projectVersion!: number;
}

@Resolver()
export class ProjectResourceSourceResolver {
  constructor(
    private readonly models: Models,
    private readonly imports: ProjectImportService,
    private readonly reader: DocReader
  ) {}

  @Query(() => [ProjectResourceSourceType])
  async projectResourceSources(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('resourceId') resourceId: string
  ) {
    const actor = { projectId, actorId: user.id };
    const resource = await this.models.projectResource.get({
      ...actor,
      resourceId,
    });
    const revision = resource.officeArtifactId
      ? await this.models.officeArtifact.getCurrentRevision(
          { projectId },
          resourceId
        )
      : null;
    const sources = await this.models.projectResource.linkedSources({
      ...actor,
      resourceId,
    });
    const result: ProjectResourceSourceType[] = [];
    for (const source of sources) {
      try {
        await this.imports.authorizeSource({ ...actor, ...source });
      } catch {
        continue;
      }
      const native = await this.models.officeArtifact.get(
        source.workspaceId,
        source.sourceResourceId
      );
      const document = native
        ? null
        : await this.reader.getDoc(source.workspaceId, source.sourceResourceId);
      const sourceRevision = native
        ? await this.models.officeArtifact.getCurrentRevision(
            source.workspaceId,
            native.id
          )
        : null;
      if (!document && !sourceRevision) continue;
      if (native && native.kind !== resource.kind) continue;
      const metadata = await this.models.doc.getMeta(
        source.workspaceId,
        source.sourceResourceId
      );
      const workspace = await this.models.workspace.get(source.workspaceId);
      const sourceVersion =
        sourceRevision?.id ??
        (document
          ? createHash('sha256').update(document.bin).digest('hex')
          : null);
      if (!sourceVersion) continue;
      result.push({
        ...source,
        title: native?.title ?? metadata?.title ?? resource.title,
        workspaceName: workspace?.name ?? '',
        sourceVersion,
        projectVersion: revision?.sequence ?? resource.contentVersion,
      });
    }
    await this.models.projectResource.assertMember(actor);
    return result;
  }

  @Mutation(() => ProjectResourceType)
  @Throttle('strict')
  async refreshProjectResourceSource(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('resourceId') resourceId: string,
    @Args('workspaceId') workspaceId: string,
    @Args('sourceResourceId') sourceResourceId: string,
    @Args('expectedContentVersion', { type: () => Int })
    expectedContentVersion: number,
    @Args('expectedSourceVersion') expectedSourceVersion: string,
    @Args('requestKey') requestKey: string
  ) {
    const actor = { projectId, actorId: user.id };
    const resource = await this.models.projectResource.get({
      ...actor,
      resourceId,
    });
    if (resource.kind === 'folder')
      throw new BadRequest('Folders cannot refresh source content');
    const links = await this.models.projectResource.linkedSources({
      ...actor,
      resourceId,
    });
    if (
      !links.some(
        source =>
          source.workspaceId === workspaceId &&
          source.sourceResourceId === sourceResourceId
      )
    )
      throw new BadRequest('Choose a source linked to this Project resource');
    return this.imports.import({
      ...actor,
      workspaceId,
      sourceResourceId,
      kind: resource.kind,
      requestKey,
      replace: { resourceId, expectedContentVersion, expectedSourceVersion },
    });
  }
}
