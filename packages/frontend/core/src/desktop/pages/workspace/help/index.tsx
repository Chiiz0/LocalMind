import { Button, IconButton } from '@affine/component';
import { Header } from '@affine/core/components/pure/header';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';
import {
  AiOutlineIcon,
  CloseIcon,
  HelpIcon,
  LockIcon,
  SearchIcon,
  SettingsIcon,
  WarningIcon,
} from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import {
  isValidElement,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import * as styles from './index.css';

type GuideSection = {
  id: string;
  index: string;
  title: string;
  summary: string;
  searchText: string;
  content: ReactNode;
};
type I18n = ReturnType<typeof useI18n>;

const collectNodeText = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectNodeText).join(' ');
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return collectNodeText(node.props.children);
  }
  return '';
};

const QuickStart = (t: I18n) => (
  <>
    <div className={styles.stepGrid}>
      {[
        [
          '01',
          t['com.affine.localmind.help.quickStart.prepare.title'](),
          t['com.affine.localmind.help.quickStart.prepare.description'](),
        ],
        [
          '02',
          t['com.affine.localmind.help.quickStart.context.title'](),
          t['com.affine.localmind.help.quickStart.context.description'](),
        ],
        [
          '03',
          t['com.affine.localmind.help.quickStart.task.title'](),
          t['com.affine.localmind.help.quickStart.task.description'](),
        ],
        [
          '04',
          t['com.affine.localmind.help.quickStart.memory.title'](),
          t['com.affine.localmind.help.quickStart.memory.description'](),
        ],
      ].map(([number, title, description]) => (
        <div className={styles.step} key={number}>
          <span className={styles.stepNumber}>{number}</span>
          <div>
            <div className={styles.stepTitle}>{title}</div>
            <p className={styles.stepDescription}>{description}</p>
          </div>
        </div>
      ))}
    </div>
    <div className={styles.promptExample}>
      <div className={styles.exampleLabel}>
        {t['com.affine.localmind.help.quickStart.promptLabel']()}
      </div>
      <p>{t['com.affine.localmind.help.quickStart.promptExample']()}</p>
    </div>
  </>
);

const DocumentSnapshots = (t: I18n) => (
  <div className={styles.twoColumn}>
    <div>
      <h3>{t['com.affine.localmind.help.snapshots.why.title']()}</h3>
      <p>{t['com.affine.localmind.help.snapshots.why.description']()}</p>
    </div>
    <div>
      <h3>{t['com.affine.localmind.help.snapshots.latest.title']()}</h3>
      <ol className={styles.orderedList}>
        <li>{t['com.affine.localmind.help.snapshots.latest.step1']()}</li>
        <li>{t['com.affine.localmind.help.snapshots.latest.step2']()}</li>
        <li>{t['com.affine.localmind.help.snapshots.latest.step3']()}</li>
        <li>{t['com.affine.localmind.help.snapshots.latest.step4']()}</li>
        <li>{t['com.affine.localmind.help.snapshots.latest.step5']()}</li>
      </ol>
      <p>{t['com.affine.localmind.help.snapshots.latest.note']()}</p>
    </div>
  </div>
);

const ChatGuide = (t: I18n) => (
  <>
    <div className={styles.featureRows}>
      <div>
        <h3>{t['com.affine.localmind.help.chat.add.title']()}</h3>
        <p>{t['com.affine.localmind.help.chat.add.description']()}</p>
      </div>
      <div>
        <h3>{t['com.affine.localmind.help.chat.sessions.title']()}</h3>
        <p>{t['com.affine.localmind.help.chat.sessions.description']()}</p>
      </div>
      <div>
        <h3>{t['com.affine.localmind.help.chat.long.title']()}</h3>
        <p>{t['com.affine.localmind.help.chat.long.description']()}</p>
      </div>
    </div>
    <div className={styles.tipLine}>
      <strong>{t['com.affine.localmind.help.chat.check.label']()}</strong>{' '}
      {t['com.affine.localmind.help.chat.check.description']()}
    </div>
  </>
);

const MemoryGuide = (t: I18n) => (
  <>
    <div className={styles.definitionTable} role="table">
      <div className={styles.definitionHeader} role="row">
        <span role="columnheader">
          {t['com.affine.localmind.help.memory.table.type']()}
        </span>
        <span role="columnheader">
          {t['com.affine.localmind.help.memory.table.purpose']()}
        </span>
        <span role="columnheader">
          {t['com.affine.localmind.help.memory.table.management']()}
        </span>
      </div>
      {[
        [
          t['com.affine.localmind.help.memory.rule.name'](),
          t['com.affine.localmind.help.memory.rule.purpose'](),
          t['com.affine.localmind.help.memory.rule.management'](),
        ],
        [
          t['com.affine.localmind.help.memory.automatic.name'](),
          t['com.affine.localmind.help.memory.automatic.purpose'](),
          t['com.affine.localmind.help.memory.automatic.management'](),
        ],
        [
          t['com.affine.localmind.help.memory.project.name'](),
          t['com.affine.localmind.help.memory.project.purpose'](),
          t['com.affine.localmind.help.memory.project.management'](),
        ],
        [
          t['com.affine.localmind.help.memory.rolling.name'](),
          t['com.affine.localmind.help.memory.rolling.purpose'](),
          t['com.affine.localmind.help.memory.rolling.management'](),
        ],
      ].map(row => (
        <div className={styles.definitionRow} role="row" key={row[0]}>
          {row.map(cell => (
            <span role="cell" key={cell}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
    <div className={styles.exampleColumns}>
      <div>
        <div className={styles.exampleLabel}>
          {t['com.affine.localmind.help.memory.save.label']()}
        </div>
        <p>{t['com.affine.localmind.help.memory.save.example1']()}</p>
        <p>{t['com.affine.localmind.help.memory.save.example2']()}</p>
      </div>
      <div>
        <div className={styles.exampleLabel}>
          {t['com.affine.localmind.help.memory.skip.label']()}
        </div>
        <p>{t['com.affine.localmind.help.memory.skip.description']()}</p>
      </div>
    </div>
  </>
);

const ProjectGuide = (t: I18n) => (
  <div className={styles.featureRows}>
    <div>
      <h3>{t['com.affine.localmind.help.projects.create.title']()}</h3>
      <p>{t['com.affine.localmind.help.projects.create.description']()}</p>
    </div>
    <div>
      <h3>{t['com.affine.localmind.help.projects.memory.title']()}</h3>
      <p>{t['com.affine.localmind.help.projects.memory.description']()}</p>
    </div>
    <div>
      <h3>{t['com.affine.localmind.help.projects.archive.title']()}</h3>
      <p>{t['com.affine.localmind.help.projects.archive.description']()}</p>
    </div>
  </div>
);

const PermissionGuide = (t: I18n) => (
  <>
    <div className={styles.securityLead}>
      <LockIcon />
      <div>
        <strong>{t['com.affine.localmind.help.permissions.lead']()}</strong>
        <p>{t['com.affine.localmind.help.permissions.description']()}</p>
      </div>
    </div>
    <ul className={styles.bulletList}>
      <li>{t['com.affine.localmind.help.permissions.item1']()}</li>
      <li>{t['com.affine.localmind.help.permissions.item2']()}</li>
      <li>{t['com.affine.localmind.help.permissions.item3']()}</li>
      <li>{t['com.affine.localmind.help.permissions.item4']()}</li>
    </ul>
  </>
);

const SearchGuide = (t: I18n) => (
  <div className={styles.twoColumn}>
    <div>
      <h3>{t['com.affine.localmind.help.search.index.title']()}</h3>
      <p>{t['com.affine.localmind.help.search.index.description']()}</p>
    </div>
    <div>
      <h3>{t['com.affine.localmind.help.search.empty.title']()}</h3>
      <p>{t['com.affine.localmind.help.search.empty.description']()}</p>
    </div>
  </div>
);

const Troubleshooting = (t: I18n) => (
  <div className={styles.faqList}>
    {[
      [
        t['com.affine.localmind.help.faq.autoMemory.question'](),
        t['com.affine.localmind.help.faq.autoMemory.answer'](),
      ],
      [
        t['com.affine.localmind.help.faq.snapshot.question'](),
        t['com.affine.localmind.help.faq.snapshot.answer'](),
      ],
      [
        t['com.affine.localmind.help.faq.oldMemory.question'](),
        t['com.affine.localmind.help.faq.oldMemory.answer'](),
      ],
      [
        t['com.affine.localmind.help.faq.projectAccess.question'](),
        t['com.affine.localmind.help.faq.projectAccess.answer'](),
      ],
      [
        t['com.affine.localmind.help.faq.projectDelete.question'](),
        t['com.affine.localmind.help.faq.projectDelete.answer'](),
      ],
      [
        t['com.affine.localmind.help.faq.search.question'](),
        t['com.affine.localmind.help.faq.search.answer'](),
      ],
    ].map(([question, answer]) => (
      <details className={styles.faqItem} key={question}>
        <summary>{question}</summary>
        <p>{answer}</p>
      </details>
    ))}
  </div>
);

const createGuideSection = (
  id: string,
  index: string,
  title: string,
  summary: string,
  content: ReactNode
): GuideSection => ({
  id,
  index,
  title,
  summary,
  searchText: collectNodeText(content),
  content,
});

const createGuideSections = (t: I18n): GuideSection[] => [
  createGuideSection(
    'start',
    '01',
    t['com.affine.localmind.help.section.start.title'](),
    t['com.affine.localmind.help.section.start.summary'](),
    QuickStart(t)
  ),
  createGuideSection(
    'snapshots',
    '02',
    t['com.affine.localmind.help.section.snapshots.title'](),
    t['com.affine.localmind.help.section.snapshots.summary'](),
    DocumentSnapshots(t)
  ),
  createGuideSection(
    'chat',
    '03',
    t['com.affine.localmind.help.section.chat.title'](),
    t['com.affine.localmind.help.section.chat.summary'](),
    ChatGuide(t)
  ),
  createGuideSection(
    'memory',
    '04',
    t['com.affine.localmind.help.section.memory.title'](),
    t['com.affine.localmind.help.section.memory.summary'](),
    MemoryGuide(t)
  ),
  createGuideSection(
    'projects',
    '05',
    t['com.affine.localmind.help.section.projects.title'](),
    t['com.affine.localmind.help.section.projects.summary'](),
    ProjectGuide(t)
  ),
  createGuideSection(
    'permissions',
    '06',
    t['com.affine.localmind.help.section.permissions.title'](),
    t['com.affine.localmind.help.section.permissions.summary'](),
    PermissionGuide(t)
  ),
  createGuideSection(
    'search',
    '07',
    t['com.affine.localmind.help.section.search.title'](),
    t['com.affine.localmind.help.section.search.summary'](),
    SearchGuide(t)
  ),
  createGuideSection(
    'troubleshooting',
    '08',
    t['com.affine.localmind.help.section.troubleshooting.title'](),
    t['com.affine.localmind.help.section.troubleshooting.summary'](),
    Troubleshooting(t)
  ),
];

export const filterGuideSections = (
  sections: GuideSection[],
  query: string
) => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return sections;
  return sections.filter(section =>
    `${section.title} ${section.summary} ${section.searchText}`
      .toLocaleLowerCase()
      .includes(normalized)
  );
};

export const HelpCenterPage = () => {
  const t = useI18n();
  const navigate = useNavigate();
  const workspaceDialogService = useService(WorkspaceDialogService);
  const sectionIdPrefix = useId().replace(/:/g, '');
  const [query, setQuery] = useState('');
  const allSections = useMemo(() => createGuideSections(t), [t]);
  const sections = useMemo(
    () => filterGuideSections(allSections, query),
    [allSections, query]
  );

  const openAIChat = useCallback(() => {
    navigate('/project');
  }, [navigate]);

  const openAIContext = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'workspace:ai-context',
    });
  }, [workspaceDialogService]);

  const openEmbedding = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'workspace:embedding',
    });
  }, [workspaceDialogService]);

  return (
    <>
      <ViewTitle title={t['com.affine.localmind.help.pageTitle']()} />
      <ViewIcon icon="ai" />
      <ViewHeader>
        <Header
          left={
            <div className={styles.headerTitle}>
              <HelpIcon />
              <span>{t['com.affine.localmind.help.title']()}</span>
            </div>
          }
          right={
            <label className={styles.headerSearch}>
              <SearchIcon />
              <span className={styles.visuallyHidden}>
                {t['com.affine.localmind.help.search.placeholder']()}
              </span>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t[
                  'com.affine.localmind.help.search.placeholder'
                ]()}
              />
              {query ? (
                <IconButton
                  size="20"
                  title={t['com.affine.localmind.help.search.clear']()}
                  icon={<CloseIcon />}
                  onClick={() => setQuery('')}
                />
              ) : null}
            </label>
          }
        />
      </ViewHeader>
      <ViewBody>
        <div className={styles.root}>
          <main className={styles.page}>
            <div className={styles.intro}>
              <div>
                <div className={styles.eyebrow}>
                  {t['com.affine.localmind.help.eyebrow']()}
                </div>
                <h1>{t['com.affine.localmind.help.pageTitle']()}</h1>
                <p>{t['com.affine.localmind.help.intro']()}</p>
              </div>
              <div className={styles.actions}>
                <Button
                  variant="primary"
                  prefix={<AiOutlineIcon />}
                  onClick={openAIChat}
                >
                  {t['com.affine.localmind.help.openChat']()}
                </Button>
                <Button prefix={<SettingsIcon />} onClick={openAIContext}>
                  {t['com.affine.localmind.help.manageContext']()}
                </Button>
              </div>
            </div>

            <div className={styles.snapshotAlert} role="note">
              <WarningIcon />
              <div>
                <strong>{t['com.affine.localmind.help.alert.title']()}</strong>
                <p>{t['com.affine.localmind.help.alert.description']()}</p>
              </div>
            </div>

            <div className={styles.layout}>
              <aside
                className={styles.toc}
                aria-label={t['com.affine.localmind.help.toc.label']()}
              >
                <div className={styles.tocLabel}>
                  {t['com.affine.localmind.help.toc.title']()}
                </div>
                {sections.map(section => (
                  <a
                    href={`#${sectionIdPrefix}-${section.id}`}
                    key={section.id}
                  >
                    <span>{section.index}</span>
                    {section.title}
                  </a>
                ))}
                <button
                  type="button"
                  className={styles.embeddingButton}
                  onClick={openEmbedding}
                >
                  <SettingsIcon />
                  <span>{t['com.affine.localmind.help.openEmbedding']()}</span>
                </button>
              </aside>

              <div className={styles.content}>
                {sections.length ? (
                  sections.map(section => (
                    <section
                      id={`${sectionIdPrefix}-${section.id}`}
                      className={styles.section}
                      data-testid={`guide-section-${section.id}`}
                      key={section.id}
                    >
                      <div className={styles.sectionHeading}>
                        <span>{section.index}</span>
                        <div>
                          <h2>{section.title}</h2>
                          <p>{section.summary}</p>
                        </div>
                      </div>
                      <div className={styles.sectionContent}>
                        {section.content}
                      </div>
                    </section>
                  ))
                ) : (
                  <div className={styles.empty} role="status">
                    <SearchIcon />
                    <h2>{t['com.affine.localmind.help.empty.title']()}</h2>
                    <p>{t['com.affine.localmind.help.empty.description']()}</p>
                    <Button onClick={() => setQuery('')}>
                      {t['com.affine.localmind.help.search.clear']()}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </ViewBody>
    </>
  );
};

export const Component = () => {
  return <HelpCenterPage />;
};
