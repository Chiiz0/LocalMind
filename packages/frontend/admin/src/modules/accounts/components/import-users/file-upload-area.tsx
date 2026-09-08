import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { useI18n } from '@affine/i18n';
import { UploadIcon } from '@blocksuite/icons/rc';
import {
  type ChangeEvent,
  type DragEvent,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

interface FileUploadAreaProps {
  onFileSelected: (file: File) => Promise<void>;
}

export interface FileUploadAreaRef {
  triggerFileUpload: () => void;
}

/**
 * Component for CSV file upload with drag and drop support
 */
export const FileUploadArea = forwardRef<
  FileUploadAreaRef,
  FileUploadAreaProps
>(({ onFileSelected }, ref) => {
  const i18n = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useAsyncCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await onFileSelected(file);
    },
    [onFileSelected]
  );

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  useImperativeHandle(ref, () => ({
    triggerFileUpload: triggerFileInput,
  }));

  const validateAndProcessFile = useAsyncCallback(
    async (file: File) => {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error(i18n['com.affine.admin.please-upload-a-csv-file']());
        return;
      }
      await onFileSelected(file);
    },
    [onFileSelected, i18n]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      validateAndProcessFile(files[0]);
    },
    [validateAndProcessFile]
  );

  return (
    <div
      className={`flex justify-center rounded-[6px] border-2 border-dashed p-8 transition-colors ${
        isDragging
          ? 'border-ring bg-accent/40'
          : 'border-border hover:border-ring/50'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
    >
      <div className="text-center">
        <UploadIcon
          fontSize={24}
          className="mx-auto mb-3 text-muted-foreground"
        />
        <div className="text-xs font-medium text-muted-foreground">
          {isDragging
            ? i18n['com.affine.admin.release-mouse-to-upload-file']()
            : i18n['com.affine.admin.upload-your-csv-file-or-drag-it-here']()}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isDragging ? i18n['com.affine.admin.preparing-to-upload']() : ''}
        </p>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv"
        className="hidden"
      />
    </div>
  );
});

FileUploadArea.displayName = 'FileUploadArea';
