import { Button } from '@affine/admin/components/ui/button';
import { Input } from '@affine/admin/components/ui/input';
import { AdminWorkspaceSort } from '@affine/graphql';
import { I18n, useI18n } from '@affine/i18n';
import type { Table } from '@tanstack/react-table';
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover';
import { useDebouncedValue } from '../../../hooks/use-debounced-value';
import type { WorkspaceFlagFilter } from '../schema';

interface DataTableToolbarProps<TData> {
  table?: Table<TData>;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  flags: WorkspaceFlagFilter;
  onFlagsChange: (flags: WorkspaceFlagFilter) => void;
  sort: AdminWorkspaceSort | undefined;
  onSortChange: (sort: AdminWorkspaceSort | undefined) => void;
  disabled?: boolean;
}

const sortOptions: { value: AdminWorkspaceSort; label: string }[] = [
  {
    value: AdminWorkspaceSort.CreatedAt,
    get label() {
      return I18n['com.affine.admin.created-time']();
    },
  },
  {
    value: AdminWorkspaceSort.BlobCount,
    get label() {
      return I18n['com.affine.admin.blob-count']();
    },
  },
  {
    value: AdminWorkspaceSort.BlobSize,
    get label() {
      return I18n['com.affine.admin.blob-size']();
    },
  },
  {
    value: AdminWorkspaceSort.SnapshotCount,
    get label() {
      return I18n['com.affine.admin.snapshot-count']();
    },
  },
  {
    value: AdminWorkspaceSort.SnapshotSize,
    get label() {
      return I18n['com.affine.admin.snapshot-size']();
    },
  },
  {
    value: AdminWorkspaceSort.MemberCount,
    get label() {
      return I18n['com.affine.admin.member-count']();
    },
  },
  {
    value: AdminWorkspaceSort.PublicPageCount,
    get label() {
      return I18n['com.affine.admin.public-pages']();
    },
  },
];

export function DataTableToolbar<TData>({
  keyword,
  onKeywordChange,
  flags,
  onFlagsChange,
  sort,
  onSortChange,
  disabled = false,
}: DataTableToolbarProps<TData>) {
  const i18n = useI18n();
  const [value, setValue] = useState(keyword);
  const debouncedValue = useDebouncedValue(value, 400);

  useEffect(() => {
    setValue(keyword);
  }, [keyword]);

  useEffect(() => {
    onKeywordChange(debouncedValue.trim());
  }, [debouncedValue, onKeywordChange]);

  const onValueChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.currentTarget.value);
  }, []);

  const handleSortChange = useCallback(
    (value: AdminWorkspaceSort) => {
      onSortChange(value);
    },
    [onSortChange]
  );

  const selectedSortLabel = useMemo(
    () =>
      sortOptions.find(option => option.value === sort)?.label ??
      i18n['com.affine.admin.created-time'](),
    [sort, i18n]
  );

  const flagOptions: { key: keyof WorkspaceFlagFilter; label: string }[] = [
    { key: 'public', label: i18n['com.affine.admin.public']() },
    { key: 'enableSharing', label: i18n['com.affine.admin.enable-sharing']() },
    {
      key: 'enableAi',
      label:
        i18n[
          'com.affine.settings.workspace.experimental-features.enable-ai.name'
        ](),
    },
    {
      key: 'enableUrlPreview',
      label: i18n['com.affine.admin.enable-url-preview'](),
    },
    {
      key: 'enableDocEmbedding',
      label: i18n['com.affine.admin.enable-doc-embedding'](),
    },
  ];

  const flagLabel = (value: boolean | undefined) => {
    if (value === true) return 'On';
    if (value === false) return 'Off';
    return 'Any';
  };

  const handleFlagToggle = useCallback(
    (key: keyof WorkspaceFlagFilter) => {
      const current = flags[key];
      const next =
        current === undefined ? true : current === true ? false : undefined;
      onFlagsChange({ ...flags, [key]: next });
    },
    [flags, onFlagsChange]
  );

  const hasFlagFilter = useMemo(
    () => Object.values(flags).some(v => v !== undefined),
    [flags]
  );

  return (
    <div className="flex items-center justify-end gap-y-2 gap-x-4 flex-wrap">
      <div className="flex items-center gap-y-2 flex-wrap justify-end gap-2">
        <Popover open={disabled ? false : undefined}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 lg:px-3"
              disabled={disabled}
            >
              {i18n['com.affine.admin.sort']()} {selectedSortLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-2">
            <div className="flex flex-col gap-1">
              {sortOptions.map(option => (
                <Button
                  key={option.value}
                  variant="ghost"
                  className="justify-start"
                  size="sm"
                  disabled={disabled}
                  onClick={() => handleSortChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Popover open={disabled ? false : undefined}>
          <PopoverTrigger asChild>
            <Button
              variant={hasFlagFilter ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 px-2 lg:px-3"
              disabled={disabled}
            >
              {i18n['com.affine.admin.flags']()}{' '}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-2">
            <div className="flex flex-col gap-1">
              {flagOptions.map(option => (
                <Button
                  key={option.key}
                  variant="ghost"
                  className="justify-between"
                  size="sm"
                  disabled={disabled}
                  onClick={() => handleFlagToggle(option.key)}
                >
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {flagLabel(flags[option.key])}
                  </span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex">
          <Input
            placeholder={i18n['com.affine.admin.search-workspace-owner']()}
            value={value}
            onChange={onValueChange}
            className="h-8 w-[150px] lg:w-[250px]"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
