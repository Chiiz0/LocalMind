import { Button, Loading, Modal, notify } from '@affine/component';
import {
  NoPermissionOrNotFound,
  NotFoundPage,
} from '@affine/component/not-found-page';
import { useSignOut } from '@affine/core/components/hooks/affine/use-sign-out';
import { GraphQLService } from '@affine/core/modules/cloud';
import { DesktopApiService } from '@affine/core/modules/desktop-api';
import { UserFriendlyError } from '@affine/error';
import {
  copilotWorkbenchProjectsGetQuery,
  requestCopilotDocumentAccessMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  FrameworkScope,
  useLiveData,
  useService,
  useServiceOptional,
} from '@toeverything/infra';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';
import { ServersService } from '../../../modules/cloud';
import { SignIn } from '../auth/sign-in';

/**
 * only for web, should not be used in electron
 */
export const PageNotFound = ({
  noPermission,
  accessRequest,
}: {
  noPermission?: boolean;
  accessRequest?: {
    workspaceId: string;
    docId: string;
    requestedTitle?: string;
  };
}): ReactElement => {
  const t = useI18n();
  const serversService = useService(ServersService);
  const serversWithAccount = useLiveData(serversService.serversWithAccount$);

  const desktopApi = useServiceOptional(DesktopApiService);
  const graphqlService = useServiceOptional(GraphQLService);
  const [requestPending, setRequestPending] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);
  const [choosingProject, setChoosingProject] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState('');

  // Check all servers for any logged in accounts to avoid showing sign-in page if user has an active session on any server
  const firstLogged = serversWithAccount.find(
    ({ account }) => account !== null
  );
  const { jumpToIndex } = useNavigateHelper();
  const openSignOutModal = useSignOut();

  const handleBackButtonClick = useCallback(
    () => jumpToIndex(RouteLogic.REPLACE),
    [jumpToIndex]
  );

  useEffect(() => {
    desktopApi?.handler.ui.pingAppLayoutReady().catch(console.error);
  }, [desktopApi]);

  // not using workbench location or router location deliberately
  // strip the origin
  const currentUrl = window.location.href.replace(window.location.origin, '');

  const requestAccess = useCallback(async () => {
    if (!accessRequest || !graphqlService || requestPending || !projectId)
      return;
    setRequestPending(true);
    try {
      await graphqlService.gql({
        query: requestCopilotDocumentAccessMutation,
        variables: {
          input: {
            workspaceId: accessRequest.workspaceId,
            docId: accessRequest.docId,
            projectId,
            requestedTitle: accessRequest.requestedTitle,
          },
        },
      });
      setAccessRequested(true);
      setChoosingProject(false);
      notify.success({
        title: t['com.affine.localmind.accessRequest.requested'](),
      });
    } catch (caught) {
      notify.error({
        title: t['com.affine.localmind.accessRequest.failed'](),
        message: UserFriendlyError.fromAny(caught).message,
      });
    } finally {
      setRequestPending(false);
    }
  }, [accessRequest, graphqlService, requestPending, projectId, t]);

  const chooseProject = useCallback(async () => {
    if (!graphqlService || projectsLoading) return;
    setChoosingProject(true);
    setProjectsLoading(true);
    setProjectId('');
    try {
      const result = await graphqlService.gql({
        query: copilotWorkbenchProjectsGetQuery,
        variables: { includeArchived: false },
      });
      setProjects(result.currentUser?.copilot.contextProjects ?? []);
    } catch (caught) {
      setChoosingProject(false);
      notify.error({
        title: t['com.affine.localmind.accessRequest.failed'](),
        message: UserFriendlyError.fromAny(caught).message,
      });
    } finally {
      setProjectsLoading(false);
    }
  }, [graphqlService, projectsLoading, t]);

  return (
    <FrameworkScope scope={firstLogged?.server.scope}>
      {choosingProject ? (
        <Modal
          open
          title={t['com.affine.localmind.accessRequest.request']()}
          onOpenChange={open => {
            if (!requestPending) setChoosingProject(open);
          }}
        >
          {projectsLoading ? (
            <Loading />
          ) : projects.length ? (
            <label>
              {t['com.affine.localmind.aiContext.selectProject']()}
              <select
                aria-label={t['com.affine.localmind.aiContext.selectProject']()}
                value={projectId}
                onChange={event => setProjectId(event.target.value)}
                disabled={requestPending}
              >
                <option value="" disabled>
                  {t['com.affine.localmind.aiContext.selectProject']()}
                </option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>{t['com.affine.localmind.workbench.projects.empty']()}</p>
          )}
          <Button
            variant="primary"
            disabled={!projectId || requestPending || projectsLoading}
            loading={requestPending}
            onClick={() => void requestAccess()}
          >
            {t['com.affine.localmind.accessRequest.request']()}
          </Button>
          <Button
            disabled={requestPending}
            onClick={() => setChoosingProject(false)}
          >
            {t['Cancel']()}
          </Button>
        </Modal>
      ) : null}
      {noPermission ? (
        <NoPermissionOrNotFound
          user={firstLogged?.account}
          onBack={handleBackButtonClick}
          onSignOut={openSignOutModal}
          signInComponent={<SignIn redirectUrl={currentUrl} />}
          requestAccess={
            firstLogged && accessRequest && graphqlService
              ? {
                  pending: requestPending,
                  requested: accessRequested,
                  onRequest: () => void chooseProject(),
                }
              : undefined
          }
        />
      ) : (
        <NotFoundPage
          user={firstLogged?.account}
          onBack={handleBackButtonClick}
          onSignOut={openSignOutModal}
        />
      )}
    </FrameworkScope>
  );
};

export const Component = () => {
  return <PageNotFound />;
};
