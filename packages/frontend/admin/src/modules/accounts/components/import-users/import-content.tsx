import { useI18n } from '@affine/i18n';
import type { FC, RefObject } from 'react';

import type { ParsedUser } from '../../utils/csv-utils';
import { UserTable } from '../user-table';
import { CsvFormatGuidance } from './csv-format-guidance';
import { FileUploadArea, type FileUploadAreaRef } from './file-upload-area';

interface ImportPreviewContentProps {
  parsedUsers: ParsedUser[];
  isImported: boolean;
}

/**
 * Component for the preview mode content
 */
export const ImportPreviewContent: FC<ImportPreviewContentProps> = ({
  parsedUsers,
  isImported,
}) => {
  const t = useI18n();
  return (
    <div className="grid gap-3">
      {!isImported && (
        <p className="text-sm text-muted-foreground">
          {t.t('com.affine.admin.import-preview-count', {
            count: parsedUsers.length,
          })}
        </p>
      )}
      <UserTable users={parsedUsers} />
    </div>
  );
};

interface ImportInitialContentProps {
  passwordLimits: {
    minLength: number;
    maxLength: number;
  };
  fileUploadRef: RefObject<FileUploadAreaRef | null>;
  onFileSelected: (file: File) => Promise<void>;
}

/**
 * Component for the initial import screen
 */
export const ImportInitialContent: FC<ImportInitialContentProps> = ({
  passwordLimits,
  fileUploadRef,
  onFileSelected,
}) => {
  const i18n = useI18n();
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {i18n[
          'com.affine.admin.you-need-to-import-the-accounts-by-importing-a-csv-file-in-the-correct-format-please-download-the-cs'
        ]()}{' '}
      </p>
      <CsvFormatGuidance passwordLimits={passwordLimits} />
      <FileUploadArea ref={fileUploadRef} onFileSelected={onFileSelected} />
    </div>
  );
};

interface ImportErrorContentProps {
  message?: string;
}

/**
 * Component for displaying import errors
 */
export const ImportErrorContent: FC<ImportErrorContentProps> = ({
  message,
}) => {
  const i18n = useI18n();
  if (message === undefined)
    message =
      i18n[
        'com.affine.admin.you-need-to-import-the-accounts-by-importing-a-csv-file-in-the-correct-format-please-download-the-cs'
      ]();
  return message;
};
