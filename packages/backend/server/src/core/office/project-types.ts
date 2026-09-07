import { Field, ID, InputType, ObjectType, OmitType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';

import {
  ImportOfficeArtifactRequestInput,
  OfficeArtifactType,
  OfficeCommandInput,
  OfficeRevisionCompareType,
  OfficeRevisionType,
} from './types';

@ObjectType()
export class ProjectOfficeRevisionType extends OmitType(OfficeRevisionType, [
  'workspaceId',
] as const) {
  @Field(() => ID) projectId!: string;
}

@ObjectType()
export class ProjectOfficeArtifactType extends OmitType(OfficeArtifactType, [
  'workspaceId',
  'currentRevision',
] as const) {
  @Field(() => ID) projectId!: string;
  @Field(() => ProjectOfficeRevisionType)
  currentRevision!: ProjectOfficeRevisionType;
}

@ObjectType()
export class ProjectOfficeResultType {
  @Field() created!: boolean;
  @Field(() => ProjectOfficeArtifactType) artifact!: ProjectOfficeArtifactType;
  @Field(() => ProjectOfficeRevisionType) revision!: ProjectOfficeRevisionType;
  @Field(() => GraphQLJSONObject) summary!: Record<string, unknown>;
}

@ObjectType()
export class ProjectOfficeCompareType extends OmitType(
  OfficeRevisionCompareType,
  ['beforeRevision', 'afterRevision'] as const
) {
  @Field(() => ProjectOfficeRevisionType)
  beforeRevision!: ProjectOfficeRevisionType;
  @Field(() => ProjectOfficeRevisionType)
  afterRevision!: ProjectOfficeRevisionType;
}

@InputType()
export class ImportProjectOfficeInput extends OmitType(
  ImportOfficeArtifactRequestInput,
  ['workspaceId'] as const
) {
  @Field(() => ID) projectId!: string;
  @Field(() => ID, { nullable: true }) parentId?: string | null;
}

@InputType()
export class ProjectOfficeCommandInput extends OmitType(OfficeCommandInput, [
  'workspaceId',
] as const) {
  @Field(() => ID) projectId!: string;
}
