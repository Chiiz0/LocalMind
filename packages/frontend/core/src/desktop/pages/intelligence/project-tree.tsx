import {
  Button,
  IconButton,
  Input,
  Loading,
  Menu,
  MenuItem,
} from '@affine/component';
import type { Workspace } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import {
  DeleteTemporarilyIcon,
  EditIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PageIcon,
  PlusIcon,
} from '@blocksuite/icons/rc';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { ProjectDocumentTitle } from './project-document-title';
import * as styles from './project-tree.css';
import {
  isWorkbenchDocumentOpenable,
  type WorkbenchDocument,
  type WorkbenchProject,
} from './types';

type ProjectTreeProps = {
  workspace?: Workspace;
  projects: WorkbenchProject[];
  selectedProjectId: string | null;
  loading: boolean;
  error?: string;
  mutationsPending: boolean;
  canAddDocuments: boolean;
  onRefresh: () => void;
  onSelectProject: (projectId: string | null) => void;
  onSelectDocument: (projectId: string, document: WorkbenchDocument) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (project: WorkbenchProject, name: string) => Promise<void>;
  onArchive: (project: WorkbenchProject) => Promise<void>;
  onAddDocuments: (
    project: WorkbenchProject,
    requestedLevel: 'read' | 'write'
  ) => void;
  onRemoveDocument: (
    project: WorkbenchProject,
    document: WorkbenchDocument
  ) => void;
  onManageCollaboration: (project: WorkbenchProject) => void;
};

const groupDocuments = (documents: WorkbenchDocument[]) => {
  const groups = new Map<string | null, WorkbenchDocument[]>();
  [...documents]
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        (left.docId ?? '').localeCompare(right.docId ?? '')
    )
    .forEach(document => {
      const group = groups.get(document.groupId) ?? [];
      group.push(document);
      groups.set(document.groupId, group);
    });
  return [...groups.entries()];
};

export const ProjectTree = ({
  workspace,
  projects,
  selectedProjectId,
  loading,
  error,
  mutationsPending,
  canAddDocuments,
  onRefresh,
  onSelectProject,
  onSelectDocument,
  onCreate,
  onRename,
  onArchive,
  onAddDocuments,
  onRemoveDocument,
  onManageCollaboration,
}: ProjectTreeProps) => {
  const t = useI18n();
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(
    null
  );
  const [renamedProjectName, setRenamedProjectName] = useState('');

  useEffect(() => {
    if (
      renamingProjectId &&
      !projects.some(project => project.id === renamingProjectId)
    ) {
      setRenamingProjectId(null);
      setRenamedProjectName('');
    }
  }, [projects, renamingProjectId]);

  const activeProjects = useMemo(
    () => projects.filter(project => project.status === 'active'),
    [projects]
  );

  const submitCreate = async () => {
    const name = newProjectName.trim();
    if (!name || mutationsPending) return;
    await onCreate(name);
    setNewProjectName('');
    setCreating(false);
  };

  const submitRename = async (project: WorkbenchProject) => {
    const name = renamedProjectName.trim();
    if (!name || name === project.name || mutationsPending) {
      setRenamingProjectId(null);
      setRenamedProjectName('');
      return;
    }
    await onRename(project, name);
    setRenamingProjectId(null);
    setRenamedProjectName('');
  };

  return (
    <nav
      className={styles.root}
      aria-label={t['com.affine.localmind.workbench.projects']()}
    >
      <div className={styles.headingRow}>
        <h2 className={styles.heading}>
          {t['com.affine.localmind.workbench.projects']()}
        </h2>
        <IconButton
          size="16"
          tooltip={t['com.affine.localmind.workbench.project.create']()}
          aria-label={t['com.affine.localmind.workbench.project.create']()}
          icon={<PlusIcon />}
          disabled={mutationsPending}
          onClick={() => setCreating(true)}
        />
      </div>

      {creating ? (
        <div className={styles.inlineEditor}>
          <Input
            autoFocus
            autoSelect
            value={newProjectName}
            placeholder={t[
              'com.affine.localmind.workbench.project.namePlaceholder'
            ]()}
            disabled={mutationsPending}
            onChange={setNewProjectName}
            onEnter={() => void submitCreate()}
          />
          <div className={styles.inlineEditorActions}>
            <Button
              variant="primary"
              disabled={!newProjectName.trim() || mutationsPending}
              loading={mutationsPending}
              onClick={() => void submitCreate()}
            >
              {t['Create']()}
            </Button>
            <Button
              disabled={mutationsPending}
              onClick={() => {
                setCreating(false);
                setNewProjectName('');
              }}
            >
              {t['Cancel']()}
            </Button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={styles.allProjects}
        data-selected={selectedProjectId === null}
        onClick={() => onSelectProject(null)}
      >
        <FolderIcon />
        <span>{t['com.affine.localmind.workbench.projects.all']()}</span>
        <span className={styles.projectCount}>{activeProjects.length}</span>
      </button>

      <div className={styles.treeScroll}>
        {loading ? (
          <div className={styles.centerState}>
            <Loading size={20} />
          </div>
        ) : error ? (
          <div className={styles.centerState} role="alert">
            <span>{error}</span>
            <Button onClick={onRefresh}>
              {t['com.affine.localmind.workbench.retry']()}
            </Button>
          </div>
        ) : activeProjects.length === 0 ? (
          <div className={styles.emptyState}>
            {t['com.affine.localmind.workbench.projects.empty']()}
          </div>
        ) : (
          <ul className={styles.projectList}>
            {activeProjects.map(project => (
              <li key={project.id} className={styles.projectItem}>
                <div
                  className={styles.projectRow}
                  data-selected={selectedProjectId === project.id}
                >
                  {renamingProjectId === project.id ? (
                    <Input
                      className={styles.renameInput}
                      autoFocus
                      autoSelect
                      value={renamedProjectName}
                      disabled={mutationsPending}
                      onChange={setRenamedProjectName}
                      onEnter={() => void submitRename(project)}
                      onKeyDown={event => {
                        if (event.key === 'Escape') {
                          setRenamingProjectId(null);
                          setRenamedProjectName('');
                        }
                      }}
                      onBlur={() => void submitRename(project)}
                    />
                  ) : (
                    <button
                      type="button"
                      className={styles.projectButton}
                      onClick={() => onSelectProject(project.id)}
                    >
                      <FolderIcon />
                      <span className={styles.projectName} title={project.name}>
                        {project.name}
                      </span>
                      <span className={styles.projectCount}>
                        {project.documentCount}
                      </span>
                    </button>
                  )}

                  {renamingProjectId !== project.id ? (
                    <Menu
                      contentOptions={{ align: 'end' }}
                      items={
                        <>
                          <MenuItem
                            prefixIcon={<PlusIcon />}
                            disabled={!canAddDocuments || mutationsPending}
                            onClick={() => onAddDocuments(project, 'read')}
                          >
                            {t[
                              'com.affine.localmind.workbench.project.addDocument.read'
                            ]()}
                          </MenuItem>
                          <MenuItem
                            prefixIcon={<PlusIcon />}
                            disabled={!canAddDocuments || mutationsPending}
                            onClick={() => onAddDocuments(project, 'write')}
                          >
                            {t[
                              'com.affine.localmind.workbench.project.addDocument.write'
                            ]()}
                          </MenuItem>
                          <MenuItem
                            disabled={mutationsPending}
                            onClick={() => onManageCollaboration(project)}
                          >
                            {t[
                              'com.affine.localmind.workbench.project.collaboration'
                            ]()}
                          </MenuItem>
                          {project.canManage ? (
                            <>
                              <MenuItem
                                prefixIcon={<EditIcon />}
                                disabled={mutationsPending}
                                onClick={() => {
                                  setRenamingProjectId(project.id);
                                  setRenamedProjectName(project.name);
                                }}
                              >
                                {t['Rename']()}
                              </MenuItem>
                              <MenuItem
                                type="warning"
                                prefixIcon={<DeleteTemporarilyIcon />}
                                disabled={mutationsPending}
                                onClick={() => void onArchive(project)}
                              >
                                {t[
                                  'com.affine.localmind.workbench.project.archive'
                                ]()}
                              </MenuItem>
                            </>
                          ) : null}
                        </>
                      }
                    >
                      <IconButton
                        className={styles.projectMenuButton}
                        size="16"
                        tooltip={t[
                          'com.affine.localmind.workbench.project.actions'
                        ]()}
                        aria-label={t[
                          'com.affine.localmind.workbench.project.actions'
                        ]()}
                        icon={<MoreHorizontalIcon />}
                      />
                    </Menu>
                  ) : null}
                </div>

                <div className={styles.documents}>
                  {groupDocuments(project.documents).map(
                    ([groupId, documents]) => (
                      <Fragment key={groupId ?? 'ungrouped'}>
                        {groupId ? (
                          <div className={styles.groupLabel}>{groupId}</div>
                        ) : null}
                        {documents.map((document, index) => {
                          const openable =
                            isWorkbenchDocumentOpenable(document);
                          const placeholderLabel =
                            document.status === 'pending'
                              ? t[
                                  'com.affine.localmind.workbench.document.pending'
                                ]()
                              : t[
                                  'com.affine.localmind.workbench.document.revoked'
                                ]();
                          return (
                            <div
                              key={`${document.workspaceId}:${document.docId ?? `redacted-${index}`}`}
                              className={styles.documentRow}
                            >
                              <button
                                type="button"
                                className={styles.documentButton}
                                data-placeholder={!openable || undefined}
                                disabled={!openable}
                                onClick={() => {
                                  if (openable) {
                                    onSelectDocument(project.id, document);
                                  }
                                }}
                              >
                                <PageIcon />
                                <ProjectDocumentTitle
                                  document={document}
                                  workspace={workspace}
                                  untitled={t[
                                    'com.affine.localmind.workbench.document.untitled'
                                  ]()}
                                  fallback={
                                    openable
                                      ? document.title ||
                                        t[
                                          'com.affine.localmind.workbench.document.untitled'
                                        ]()
                                      : document.title
                                        ? `${document.title} - ${placeholderLabel}`
                                        : placeholderLabel
                                  }
                                />
                              </button>
                              {project.canManage && document.docId ? (
                                <IconButton
                                  className={styles.documentRemoveButton}
                                  size="16"
                                  tooltip={t[
                                    'com.affine.localmind.workbench.document.remove'
                                  ]()}
                                  aria-label={t[
                                    'com.affine.localmind.workbench.document.remove'
                                  ]()}
                                  icon={<DeleteTemporarilyIcon />}
                                  disabled={mutationsPending}
                                  onClick={() =>
                                    onRemoveDocument(project, document)
                                  }
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </Fragment>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
};
