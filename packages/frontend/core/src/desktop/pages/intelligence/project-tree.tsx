import {
  Button,
  IconButton,
  Input,
  Loading,
  Menu,
  MenuItem,
} from '@affine/component';
import { useI18n } from '@affine/i18n';
import {
  DeleteTemporarilyIcon,
  EditIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from '@blocksuite/icons/rc';
import { useEffect, useMemo, useState } from 'react';

import * as styles from './project-tree.css';
import type { WorkbenchProject } from './types';

type ProjectTreeProps = {
  projects: WorkbenchProject[];
  selectedProjectId: string | null;
  loading: boolean;
  error?: string;
  mutationsPending: boolean;
  onRefresh: () => void;
  onSelectProject: (projectId: string | null) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (project: WorkbenchProject, name: string) => Promise<void>;
  onArchive: (project: WorkbenchProject) => Promise<void>;
  onManageCollaboration: (project: WorkbenchProject) => void;
};

export const ProjectTree = ({
  projects,
  selectedProjectId,
  loading,
  error,
  mutationsPending,
  onRefresh,
  onSelectProject,
  onCreate,
  onRename,
  onArchive,
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
                    </button>
                  )}

                  {renamingProjectId !== project.id ? (
                    <Menu
                      contentOptions={{ align: 'end' }}
                      items={
                        <>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
};
