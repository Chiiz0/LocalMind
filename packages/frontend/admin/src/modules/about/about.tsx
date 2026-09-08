import { buttonVariants } from '@affine/admin/components/ui/button';
import { Separator } from '@affine/admin/components/ui/separator';
import { cn } from '@affine/admin/utils';
import { I18n, useI18n } from '@affine/i18n';
import {
  AlbumIcon,
  ChevronRightIcon,
  GithubIcon,
  MailWarningIcon,
  UploadCloudIcon,
} from 'lucide-react';

type Channel = 'stable' | 'canary' | 'beta' | 'internal';

const appNames = {
  stable: 'LocalMind',
  canary: 'LocalMind Canary',
  beta: 'LocalMind Beta',
  internal: 'LocalMind Internal',
} satisfies Record<Channel, string>;
const appName = appNames[BUILD_CONFIG.appBuildType];

const links = [
  {
    href: BUILD_CONFIG.githubUrl,
    icon: <GithubIcon size={20} />,
    get label() {
      return I18n['com.affine.admin.star-localmind-on-github']();
    },
  },
  {
    href: BUILD_CONFIG.githubUrl,
    icon: <MailWarningIcon size={20} />,
    get label() {
      return I18n['com.affine.admin.report-an-issue']();
    },
  },
  {
    href: 'https://github.com/Infinimesh-ai/LocalMind/blob/main/docs/localmind-deployment.zh-CN.md',
    icon: <AlbumIcon size={20} />,
    get label() {
      return I18n['com.affine.admin.self-host-document']();
    },
  },
  {
    href: 'https://github.com/Infinimesh-ai/LocalMind',
    icon: <UploadCloudIcon size={20} />,
    get label() {
      return I18n['com.affine.admin.upgrade-to-team']();
    },
  },
];

export function AboutAFFiNE() {
  const i18n = useI18n();
  return (
    <div className="flex flex-col h-full gap-3 py-5 px-6 w-full">
      <div className="flex items-center">
        <span className="text-xl font-semibold">
          {i18n['com.affine.aboutAFFiNE.title']()}
        </span>
      </div>
      <div className="overflow-y-auto space-y-[10px]">
        <div className="flex flex-col rounded-md border">
          {links.map(({ href, icon, label }, index) => (
            <div key={label + index}>
              <a
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'justify-between cursor-pointer w-full'
                )}
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                <div className="flex items-center gap-3">
                  {icon}
                  <span>{label}</span>
                </div>
                <div>
                  <ChevronRightIcon size={20} />
                </div>
              </a>
              {index < links.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 text-sm font-normal text-muted-foreground">
        <div>{`App Version: ${appName} ${BUILD_CONFIG.appVersion}`}</div>
        <div>{`Editor Version: ${BUILD_CONFIG.editorVersion}`}</div>
      </div>
    </div>
  );
}
