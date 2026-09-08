import { Button, Checkbox, Input, Modal, notify } from '@affine/component';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import type { McpCredential } from '@affine/core/modules/cloud/services/mcp-credential';
import { copyTextToClipboard } from '@affine/core/utils/clipboard';
import { useI18n } from '@affine/i18n';
import { useEffect, useState } from 'react';

import {
  DEFAULT_MCP_CAPABILITIES,
  MCP_CAPABILITY_OPTIONS,
  updateMcpCapabilities,
} from './capabilities';
import * as styles from './setting-panel.css';

type RevealedCredential = {
  credential: McpCredential;
  token: string;
  callbackSecret: string | null;
};

export const McpCredentialModal = ({
  mode,
  revealed,
  config,
  workspaceName,
  onCreate,
  onClose,
}: {
  mode: 'create' | 'reveal' | null;
  revealed: RevealedCredential | null;
  config: string;
  workspaceName?: string;
  onCreate: (
    name: string,
    capabilities: string[],
    expirationDays: number,
    callbackUrl: string | null
  ) => void | Promise<void>;
  onClose: () => void;
}) => {
  const t = useI18n();
  const [name, setName] = useState('');
  const [expirationDays, setExpirationDays] = useState(90);
  const [capabilities, setCapabilities] = useState<Set<string>>(
    () => new Set(DEFAULT_MCP_CAPABILITIES)
  );
  const [callbackUrl, setCallbackUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!mode) {
      setName('');
      setExpirationDays(90);
      setCapabilities(new Set(DEFAULT_MCP_CAPABILITIES));
      setCallbackUrl('');
      setSubmitting(false);
    }
  }, [mode]);

  const copy = useAsyncCallback(
    async (value: string) => {
      const copied = await copyTextToClipboard(value);
      if (copied) {
        notify.success({ title: t['Copied to clipboard']() });
      } else {
        notify.error({
          title: t['com.affine.ui.copy-failed-please-try-again-later'](),
        });
      }
    },
    [t]
  );

  const submit = useAsyncCallback(async () => {
    setSubmitting(true);
    try {
      await onCreate(
        name.trim(),
        [...capabilities],
        expirationDays,
        callbackUrl.trim() || null
      );
    } finally {
      setSubmitting(false);
    }
  }, [callbackUrl, capabilities, expirationDays, name, onCreate]);

  const callbackUrlValid = (() => {
    if (!callbackUrl.trim()) return true;
    try {
      return ['http:', 'https:'].includes(new URL(callbackUrl.trim()).protocol);
    } catch {
      return false;
    }
  })();
  const callbackSecret = revealed?.callbackSecret ?? null;

  const toggleCapability = (capability: string, checked: boolean) => {
    setCapabilities(current =>
      updateMcpCapabilities(current, capability, checked)
    );
  };

  return (
    <Modal
      open={mode !== null}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      contentOptions={{ className: styles.modal }}
    >
      {mode === 'create' ? (
        <>
          <div className={styles.modalTitle}>
            {t['com.affine.integration.mcp-server.create.title']()}
          </div>
          <div className={styles.description}>
            {t['com.affine.integration.mcp-server.create.description']()}
          </div>
          <div className={styles.form}>
            <label className={styles.field}>
              <span>
                {t['com.affine.integration.mcp-server.field.label']()}
              </span>
              <Input
                value={name}
                maxLength={64}
                placeholder="Claude Desktop"
                onChange={setName}
                autoFocus
              />
            </label>
            <div className={styles.field}>
              <span>
                {t['com.affine.integration.mcp-server.field.access']()}
              </span>
              <div className={styles.capabilitySelector}>
                {MCP_CAPABILITY_OPTIONS.map(option => (
                  <div
                    className={styles.capabilitySelectorRow}
                    key={option.key}
                  >
                    <span className={styles.capabilitySelectorName}>
                      {t[
                        `com.affine.integration.mcp-server.capability.${option.key}`
                      ]()}
                    </span>
                    <div className={styles.capabilitySelectorChecks}>
                      <Checkbox
                        checked={capabilities.has(option.capability)}
                        label={t[
                          'com.affine.integration.mcp-server.capability.allow'
                        ]()}
                        onChange={(_, checked) =>
                          toggleCapability(option.capability, checked)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <label className={styles.field}>
              <span>
                {t['com.affine.integration.mcp-server.field.expiry']()}
              </span>
              <select
                className={styles.select}
                value={expirationDays}
                onChange={event =>
                  setExpirationDays(Number(event.currentTarget.value))
                }
              >
                {[30, 90, 365].map(days => (
                  <option value={days} key={days}>
                    {t['com.affine.integration.mcp-server.expiry.days']({
                      days: days.toString(),
                    })}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>
                {t['com.affine.integration.mcp-server.field.callback-url']()}
              </span>
              <Input
                type="url"
                value={callbackUrl}
                maxLength={2048}
                placeholder="https://sparkclaw.example/localmind/results"
                status={callbackUrlValid ? 'default' : 'error'}
                onChange={setCallbackUrl}
              />
            </label>
          </div>
          <div className={styles.modalActions}>
            <Button onClick={onClose}>{t['Cancel']()}</Button>
            <Button
              variant="primary"
              disabled={
                !name.trim() ||
                !capabilities.size ||
                !callbackUrlValid ||
                submitting
              }
              loading={submitting}
              onClick={submit}
            >
              {t['com.affine.integration.mcp-server.action.create']()}
            </Button>
          </div>
        </>
      ) : revealed ? (
        <>
          <div className={styles.modalTitle}>
            {t['com.affine.integration.mcp-server.reveal.title']()}
          </div>
          <div className={styles.warning}>
            {t['com.affine.integration.mcp-server.reveal.warning']()}
          </div>
          <div className={styles.summary}>
            {revealed.credential.name} · {workspaceName} ·{' '}
            {revealed.credential.capabilities.join(', ')} ·{' '}
            {new Date(revealed.credential.expiresAt).toLocaleString()}
          </div>
          {revealed.credential.graceEndsAt ? (
            <div className={styles.warning}>
              {t['com.affine.integration.mcp-server.reveal.old-valid-until']({
                date: new Date(
                  revealed.credential.graceEndsAt
                ).toLocaleString(),
              })}
            </div>
          ) : null}
          <div className={styles.codeHeader}>
            <span>{t['com.affine.integration.mcp-server.reveal.token']()}</span>
            <Button onClick={() => copy(revealed.token)}>
              {t['com.affine.integration.mcp-server.action.copy-token']()}
            </Button>
          </div>
          <pre className={styles.preArea}>{revealed.token}</pre>
          {callbackSecret ? (
            <>
              <div className={styles.codeHeader}>
                <span>
                  {t[
                    'com.affine.integration.mcp-server.reveal.callback-secret'
                  ]()}
                </span>
                <Button onClick={() => copy(callbackSecret)}>
                  {t[
                    'com.affine.integration.mcp-server.action.copy-callback-secret'
                  ]()}
                </Button>
              </div>
              <pre className={styles.preArea}>{callbackSecret}</pre>
            </>
          ) : null}
          <div className={styles.codeHeader}>
            <span>
              {t['com.affine.integration.mcp-server.reveal.config']()}
            </span>
            <Button variant="primary" onClick={() => copy(config)}>
              {t['com.affine.integration.mcp-server.action.copy-json']()}
            </Button>
          </div>
          <pre className={styles.preArea}>{config}</pre>
          <div className={styles.modalActions}>
            <Button variant="primary" onClick={onClose}>
              {t['com.affine.integration.mcp-server.action.done']()}
            </Button>
          </div>
        </>
      ) : null}
    </Modal>
  );
};
