import { useI18n } from '@affine/i18n';
import {
  CloseIcon,
  ExportToHtmlIcon,
  ExportToMarkdownIcon,
  HelpIcon,
  NewIcon,
  NotionIcon,
} from '@blocksuite/icons/rc';

import { IconButton } from '../../ui/button';
import { Tooltip } from '../../ui/tooltip';
import { BlockCard } from '../card/block-card';
import {
  importPageBodyStyle,
  importPageButtonContainerStyle,
  importPageContainerStyle,
} from './index.css';

/**
 * @deprecated Not used
 */
export const ImportPage = ({
  importMarkdown,
  importHtml,
  importNotion,
  onClose,
}: {
  importMarkdown: () => void;
  importHtml: () => void;
  importNotion: () => void;
  onClose: () => void;
}) => {
  const uiI18n = useI18n();
  return (
    <div className={importPageContainerStyle}>
      <IconButton
        style={{
          position: 'absolute',
          right: 6,
          top: 6,
        }}
        onClick={() => {
          onClose();
        }}
      >
        <CloseIcon />
      </IconButton>
      <div className={importPageBodyStyle}>
        <div className="title">
          {uiI18n[
            'com.affine.integration.readwise.setting.start-import-button'
          ]()}
        </div>
        <span>
          {uiI18n[
            'com.affine.ui.localmind-will-gradually-support-more-file-types-for-import-nbsp'
          ]()}{' '}
          <a
            href={`${BUILD_CONFIG.githubUrl}/issues/new/choose`}
            target="_blank"
            rel="noreferrer"
          >
            {uiI18n['com.affine.ui.provide-feedback']()}{' '}
          </a>
        </span>
      </div>
      <div className={importPageButtonContainerStyle}>
        <BlockCard
          left={<ExportToMarkdownIcon width={20} height={20} />}
          title="Markdown"
          onClick={importMarkdown}
        />
        <BlockCard
          left={<ExportToHtmlIcon width={20} height={20} />}
          title="HTML"
          onClick={importHtml}
        />
        <BlockCard
          left={<NotionIcon width={20} height={20} />}
          title="Notion"
          right={
            <Tooltip
              content={'Learn how to import your Notion pages into LocalMind.'}
            >
              <HelpIcon width={20} height={20} />
            </Tooltip>
          }
          onClick={importNotion}
        />
        <BlockCard
          left={<NewIcon width={20} height={20} />}
          title={uiI18n['com.affine.ui.coming-soon']()}
          disabled
          onClick={importHtml}
        />
      </div>
    </div>
  );
};
