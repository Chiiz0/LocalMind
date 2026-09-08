import type {
  CopilotWorkbenchProjectsGetQuery,
  CopilotWorkbenchTaskItemFieldsFragment,
  CopilotWorkbenchTaskPanelGetQuery,
} from '@affine/graphql';

type WorkbenchProjects = NonNullable<
  CopilotWorkbenchProjectsGetQuery['currentUser']
>['copilot']['contextProjects'];

export type WorkbenchProject = WorkbenchProjects[number];
export type WorkbenchProjectMember = WorkbenchProject['members'][number];

export type WorkbenchTaskAction =
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'resume'
  | 'abandon'
  | 'approve_access_request'
  | 'reject_access_request'
  | 'withdraw_access_request'
  | 'accept_project_invitation'
  | 'decline_project_invitation'
  | 'withdraw_project_invitation';

export type WorkbenchPanelTaskAction =
  | WorkbenchTaskAction
  | 'resolve_blocker'
  | 'abandon_blocker';

export type WorkbenchBlockerType =
  | 'wait_reply'
  | 'wait_file'
  | 'wait_decision'
  | 'custom';

export type WorkbenchBlockerDraft = {
  title: string;
  type: WorkbenchBlockerType;
  waitingOn: string;
  dueAt: string | null;
};

export type WorkbenchTask = CopilotWorkbenchTaskItemFieldsFragment;
export type WorkbenchRun = NonNullable<WorkbenchTask['run']>;

export type WorkbenchTaskPanelData = NonNullable<
  CopilotWorkbenchTaskPanelGetQuery['currentUser']
>['copilot']['workbenchTaskPanel'];
export type WorkbenchTaskSegment = WorkbenchTaskPanelData['todo'];

export const EMPTY_TASK_PANEL: WorkbenchTaskPanelData = {
  todo: { capped: false, items: [] },
  inProgress: { capped: false, items: [] },
  done: { capped: false, items: [] },
};
