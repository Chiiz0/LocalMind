import {
  Avatar,
  Button,
  Input,
  Modal,
  RadioGroup,
  useConfirmModal,
} from '@affine/component';
import { reportProjectError } from '@affine/core/modules/project-resources/error';
import { useI18n } from '@affine/i18n';
import { useEffect, useState } from 'react';

import * as styles from './project-collaboration.css';
import type { WorkbenchProject, WorkbenchProjectMember } from './types';

export type ProjectCollaborationPendingKey =
  | 'invite'
  | 'policy'
  | 'leave'
  | `remove:${string}`
  | `transfer:${string}`;

type ProjectCollaborationProps = {
  open: boolean;
  project: WorkbenchProject;
  pendingKey: ProjectCollaborationPendingKey | null;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: string) => Promise<boolean>;
  onPolicyChange: (policy: 'read_only' | 'read_write') => Promise<boolean>;
  onRemoveMember: (member: WorkbenchProjectMember) => Promise<boolean>;
  onTransferOwnership: (member: WorkbenchProjectMember) => Promise<boolean>;
  onLeave: () => Promise<boolean>;
};

export const ProjectCollaboration = ({
  open,
  project,
  pendingKey,
  onOpenChange,
  onInvite,
  onPolicyChange,
  onRemoveMember,
  onTransferOwnership,
  onLeave,
}: ProjectCollaborationProps) => {
  const t = useI18n();
  const { openConfirmModal } = useConfirmModal();
  const [email, setEmail] = useState('');
  const isOwner = project.role === 'owner';

  useEffect(() => {
    if (!open) setEmail('');
  }, [open]);

  const submitInvite = async () => {
    const normalized = email.trim();
    if (!normalized || pendingKey) return;
    if (await onInvite(normalized)) setEmail('');
  };

  const confirmTransfer = (member: WorkbenchProjectMember) => {
    openConfirmModal({
      title:
        t['com.affine.localmind.workbench.project.transferOwnershipConfirm'](),
      description: t[
        'com.affine.localmind.workbench.project.transferOwnershipDescription'
      ]({ name: member.name || member.email }),
      confirmText:
        t['com.affine.localmind.workbench.project.transferOwnership'](),
      cancelText: t['Cancel'](),
      confirmButtonOptions: { variant: 'error' },
      onConfirm: () => void onTransferOwnership(member),
    });
  };

  const confirmRemove = (member: WorkbenchProjectMember) => {
    openConfirmModal({
      title: t['com.affine.localmind.workbench.project.removeMemberConfirm'](),
      description: t[
        'com.affine.localmind.workbench.project.removeMemberDescription'
      ]({ name: member.name || member.email }),
      confirmText: t['com.affine.localmind.workbench.project.removeMember'](),
      cancelText: t['Cancel'](),
      confirmButtonOptions: { variant: 'error' },
      onConfirm: () => void onRemoveMember(member),
    });
  };

  const confirmLeave = () => {
    openConfirmModal({
      title: t['com.affine.localmind.workbench.project.leaveConfirm'](),
      description:
        t['com.affine.localmind.workbench.project.leaveDescription'](),
      confirmText: t['com.affine.localmind.workbench.project.leave'](),
      cancelText: t['Cancel'](),
      confirmButtonOptions: { variant: 'error' },
      onConfirm: () => void onLeave(),
    });
  };

  return (
    <Modal
      open={open}
      title={t['com.affine.localmind.workbench.project.collaboration']()}
      width={520}
      onOpenChange={onOpenChange}
    >
      <div className={styles.root}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>{t['com.affine.localmind.workbench.project.members']()}</h3>
            <span>{project.members.length}</span>
          </div>
          <div className={styles.memberList}>
            {project.members.map(member => (
              <div className={styles.memberRow} key={member.userId}>
                <Avatar
                  size={28}
                  name={member.name || member.email}
                  url={member.avatarUrl ?? undefined}
                />
                <div className={styles.memberIdentity}>
                  <strong title={member.name || member.email}>
                    {member.name || member.email}
                  </strong>
                  <span title={member.email}>{member.email}</span>
                </div>
                <span className={styles.role} data-role={member.role}>
                  {member.role === 'owner'
                    ? t['com.affine.localmind.workbench.project.role.owner']()
                    : t['com.affine.localmind.workbench.project.role.member']()}
                </span>
                {isOwner && member.role === 'member' ? (
                  <div className={styles.memberActions}>
                    <Button
                      size="custom"
                      disabled={pendingKey !== null}
                      loading={pendingKey === `transfer:${member.userId}`}
                      onClick={() => confirmTransfer(member)}
                    >
                      {t[
                        'com.affine.localmind.workbench.project.transferOwnership'
                      ]()}
                    </Button>
                    <Button
                      size="custom"
                      variant="error"
                      disabled={pendingKey !== null}
                      loading={pendingKey === `remove:${member.userId}`}
                      onClick={() => confirmRemove(member)}
                    >
                      {t[
                        'com.affine.localmind.workbench.project.removeMember'
                      ]()}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {isOwner ? (
          <>
            <section className={styles.section}>
              <h3>{t['com.affine.localmind.workbench.project.invite']()}</h3>
              <div className={styles.inviteRow}>
                <Input
                  value={email}
                  type="email"
                  placeholder={t[
                    'com.affine.localmind.workbench.project.invitePlaceholder'
                  ]()}
                  disabled={pendingKey !== null}
                  onChange={setEmail}
                  onEnter={() => void submitInvite()}
                />
                <Button
                  variant="primary"
                  disabled={!email.trim() || pendingKey !== null}
                  loading={pendingKey === 'invite'}
                  onClick={() => void submitInvite()}
                >
                  {t['Invite']()}
                </Button>
              </div>
            </section>

            <section className={styles.section}>
              <h3>{t['com.affine.localmind.workbench.project.aiPolicy']()}</h3>
              <RadioGroup
                width="100%"
                value={project.aiPolicy}
                disabled={pendingKey !== null}
                onChange={(policy: 'read_only' | 'read_write') => {
                  if (policy !== project.aiPolicy) {
                    onPolicyChange(policy).catch(reportProjectError);
                  }
                }}
                items={[
                  {
                    value: 'read_only',
                    label:
                      t[
                        'com.affine.localmind.workbench.project.aiPolicy.readOnly'
                      ](),
                  },
                  {
                    value: 'read_write',
                    label:
                      t[
                        'com.affine.localmind.workbench.project.aiPolicy.readWrite'
                      ](),
                  },
                ]}
              />
            </section>
          </>
        ) : null}

        <div className={styles.footer}>
          <Button
            variant="error"
            disabled={pendingKey !== null}
            loading={pendingKey === 'leave'}
            onClick={confirmLeave}
          >
            {t['com.affine.localmind.workbench.project.leave']()}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
