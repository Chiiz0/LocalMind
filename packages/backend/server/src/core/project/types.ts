import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { ProjectResourceKind } from '@prisma/client';

import { ProjectEditLeaseProofInput } from './edit-lease-resolver';

registerEnumType(ProjectResourceKind, { name: 'ProjectResourceKind' });

@ObjectType()
export class ProjectResourceType {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field(() => ID, { nullable: true }) parentId!: string | null;
  @Field(() => ProjectResourceKind) kind!: ProjectResourceKind;
  @Field() title!: string;
  @Field() sortKey!: string;
  @Field(() => Int) version!: number;
  @Field(() => Int) contentVersion!: number;
  @Field(() => ID, { nullable: true }) officeArtifactId!: string | null;
  @Field(() => GraphQLISODateTime, { nullable: true }) trashedAt!: Date | null;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
  @Field(() => GraphQLISODateTime) updatedAt!: Date;
}

@ObjectType()
export class ProjectResourcePageType {
  @Field(() => [ProjectResourceType]) items!: ProjectResourceType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}

@ObjectType()
export class ProjectSearchPathType {
  @Field(() => ID) id!: string;
  @Field() title!: string;
}

@ObjectType()
export class ProjectSearchResultType {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field() title!: string;
  @Field(() => ProjectResourceKind) kind!: ProjectResourceKind;
  @Field(() => Int) contentVersion!: number;
  @Field() snippet!: string;
  @Field(() => [ProjectSearchPathType]) path!: ProjectSearchPathType[];
}

@ObjectType()
export class ProjectSearchPageType {
  @Field(() => [ProjectSearchResultType]) items!: ProjectSearchResultType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}

@ObjectType()
export class ProjectResourceRevisionType {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field(() => ID) resourceId!: string;
  @Field(() => Int) sequence!: number;
  @Field(() => ID, { nullable: true }) parentId!: string | null;
  @Field() fingerprint!: string;
  @Field() origin!: string;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
}

@InputType()
export class CreateProjectResourceInput {
  @Field(() => ID) projectId!: string;
  @Field(() => ID, { nullable: true }) parentId?: string | null;
  @Field(() => ProjectResourceKind) kind!: ProjectResourceKind;
  @Field() title!: string;
  @Field(() => String, { defaultValue: '' }) markdown!: string;
  @Field() requestKey!: string;
}

@InputType()
export class CreateProjectFileInput {
  @Field(() => ID) projectId!: string;
  @Field(() => ID, { nullable: true }) parentId?: string | null;
  @Field() title!: string;
  @Field() blobKey!: string;
  @Field() requestKey!: string;
}

@InputType()
export class ChangeProjectResourceInput {
  @Field(() => ProjectEditLeaseProofInput, { nullable: true })
  editLease?: ProjectEditLeaseProofInput;
  @Field() requestKey!: string;
  @Field(() => ID) projectId!: string;
  @Field(() => ID) resourceId!: string;
  @Field(() => Int) expectedVersion!: number;
  @Field(() => String, { nullable: true }) title?: string;
  @Field(() => ID, { nullable: true }) parentId?: string | null;
  @Field(() => ID, { nullable: true }) beforeId?: string | null;
  @Field(() => Boolean, { nullable: true }) trash?: boolean;
}

@InputType()
export class PermanentlyDeleteProjectResourceInput {
  @Field(() => ID) projectId!: string;
  @Field(() => ID) resourceId!: string;
  @Field(() => Int) expectedVersion!: number;
  @Field() requestKey!: string;
}

@InputType()
export class SaveProjectDocumentInput {
  @Field(() => ProjectEditLeaseProofInput)
  editLease!: ProjectEditLeaseProofInput;
  @Field(() => ID) projectId!: string;
  @Field(() => ID) resourceId!: string;
  @Field(() => Int) expectedContentVersion!: number;
  @Field() requestKey!: string;
  @Field() snapshotBase64!: string;
}
