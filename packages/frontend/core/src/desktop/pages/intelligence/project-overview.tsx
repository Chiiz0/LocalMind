import { Button, Loading } from '@affine/component';
import { getProjectPath } from '@affine/core/desktop/route-paths';
import { useI18n } from '@affine/i18n';
import { ArrowRightSmallIcon, FolderIcon } from '@blocksuite/icons/rc';
import { Link } from 'react-router-dom';

import * as styles from './project-overview.css';
import type { WorkbenchProject } from './types';

type ProjectOverviewProps = {
  projects: WorkbenchProject[];
  loading: boolean;
  error?: string;
  onRefresh: () => void;
};

export const ProjectOverview = ({
  projects,
  loading,
  error,
  onRefresh,
}: ProjectOverviewProps) => {
  const t = useI18n();
  const activeProjects = projects.filter(
    project => project.status === 'active'
  );

  return (
    <section
      className={styles.root}
      aria-label={t['com.affine.localmind.workbench.projects.all']()}
      data-testid="project-overview"
    >
      {loading ? (
        <div className={styles.state} role="status">
          <Loading size={20} />
          <span>{t['com.affine.loading']()}</span>
        </div>
      ) : error ? (
        <div className={styles.state} role="alert">
          <span>{error}</span>
          <Button onClick={onRefresh}>
            {t['com.affine.localmind.workbench.retry']()}
          </Button>
        </div>
      ) : activeProjects.length === 0 ? (
        <div className={styles.state}>
          {t['com.affine.localmind.workbench.projects.emptyTitle']()}
        </div>
      ) : (
        <ul className={styles.list}>
          {activeProjects.map(project => (
            <li key={project.id}>
              <Link
                className={styles.project}
                to={getProjectPath(project.id)}
                aria-label={project.name}
              >
                <FolderIcon className={styles.icon} aria-hidden />
                <span className={styles.details}>
                  <span className={styles.name}>{project.name}</span>
                  {project.description ? (
                    <span className={styles.description}>
                      {project.description}
                    </span>
                  ) : null}
                </span>
                <span className={styles.role}>
                  {project.role === 'owner'
                    ? t['com.affine.localmind.workbench.project.role.owner']()
                    : t['com.affine.localmind.workbench.project.role.member']()}
                </span>
                <ArrowRightSmallIcon className={styles.arrow} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
