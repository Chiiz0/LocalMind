import { Badge } from '@affine/admin/components/ui/badge';
import { Button } from '@affine/admin/components/ui/button';
import { Input } from '@affine/admin/components/ui/input';
import { Label } from '@affine/admin/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@affine/admin/components/ui/select';
import { Switch } from '@affine/admin/components/ui/switch';
import { useMutation } from '@affine/admin/use-mutation';
import { useQuery } from '@affine/admin/use-query';
import {
  adminProjectByokSettingsQuery,
  type ByokProvider,
  type QueryResponse,
  saveProjectByokConfigMutation,
  setProjectByokEnabledMutation,
  testProjectByokConfigMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { FlaskConicalIcon, RefreshCwIcon, SaveIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

type Settings = QueryResponse<
  typeof adminProjectByokSettingsQuery
>['adminProjectByokSettings'];

const providerLabels: Record<ByokProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  fal: 'FAL',
};

function ProjectByokForm({
  settings,
  onSaved,
}: {
  settings: Settings;
  onSaved: () => Promise<unknown>;
}) {
  const i18n = useI18n();
  const [provider, setProvider] = useState(settings.provider);
  const [endpoint, setEndpoint] = useState(settings.endpoint ?? '');
  const [modelId, setModelId] = useState(settings.modelId ?? '');
  const [apiKey, setApiKey] = useState('');
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const { trigger: test, isMutating: testing } = useMutation({
    mutation: testProjectByokConfigMutation,
  });
  const { trigger: save, isMutating: saving } = useMutation({
    mutation: saveProjectByokConfigMutation,
  });
  const { trigger: setEnabled, isMutating: toggling } = useMutation({
    mutation: setProjectByokEnabledMutation,
  });
  const busy = testing || saving || toggling;
  const canSubmit = Boolean(
    modelId.trim() &&
    (apiKey.trim() || (settings.configured && provider === settings.provider))
  );
  const input = {
    expectedRevision: settings.revision,
    provider,
    endpoint: endpoint.trim() || null,
    modelId: modelId.trim(),
    apiKey: apiKey.trim() || undefined,
  };

  const handleTest = async () => {
    if (busy || !canSubmit) return;
    setFeedback(null);
    try {
      const { testProjectByokConfig: result } = await test({ input });
      setFeedback({
        ok: result.ok,
        message: result.message ?? i18n['com.affine.admin.provider-verified'](),
      });
    } catch {
      setFeedback({
        ok: false,
        message:
          i18n[
            'com.affine.admin.test-failed-check-the-configuration-or-reload-the-latest-settings'
          ](),
      });
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !canSubmit) return;
    setFeedback(null);
    try {
      await save({ input });
      setApiKey('');
      toast.success(i18n['com.affine.admin.global-project-byok-saved']());
      await onSaved();
    } catch {
      setFeedback({
        ok: false,
        message:
          i18n[
            'com.affine.admin.save-failed-check-the-endpoint-model-and-key-or-reload-if-another-administrator-changed-the-settings'
          ](),
      });
    }
  };

  const handleEnabled = async (enabled: boolean) => {
    if (busy || !settings.configured) return;
    if (
      !enabled &&
      !window.confirm(
        i18n[
          'com.affine.admin.disable-ai-for-all-project-conversations-new-requests-will-stop-until-global-project-byok-is-enabled'
        ]()
      )
    )
      return;
    setFeedback(null);
    try {
      await setEnabled({ expectedRevision: settings.revision, enabled });
      toast.success(
        enabled
          ? i18n['com.affine.admin.project-ai-enabled-2']()
          : i18n['com.affine.admin.project-ai-disabled']()
      );
      await onSaved();
    } catch {
      setFeedback({
        ok: false,
        message:
          i18n[
            'com.affine.admin.update-failed-reload-the-settings-and-check-the-provider-connection'
          ](),
      });
    }
  };

  return (
    <form
      onSubmit={event => {
        handleSave(event).catch(() =>
          toast.error(i18n['com.affine.admin.could-not-save-project-byok']())
        );
      }}
      className="space-y-5"
      onChange={() => setFeedback(null)}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Switch
          id="project-byok-enabled"
          checked={settings.enabled}
          disabled={!settings.configured || busy}
          onCheckedChange={enabled => {
            handleEnabled(enabled).catch(() =>
              toast.error(
                i18n['com.affine.admin.could-not-update-project-byok']()
              )
            );
          }}
        />
        <Label htmlFor="project-byok-enabled">
          {i18n['com.affine.admin.project-ai-enabled']()}
        </Label>
        <Badge variant="secondary">
          {settings.configured
            ? i18n['com.affine.localmind.aiContext.revision']({
                revision: String(settings.revision),
              })
            : i18n['com.affine.admin.not-configured']()}
        </Badge>
      </div>
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="project-byok-provider">
            {i18n['com.affine.integration.calendar.caldav.field.provider']()}
          </Label>
          <Select
            value={provider}
            disabled={busy}
            onValueChange={value => {
              setProvider(value as ByokProvider);
              setFeedback(null);
            }}
          >
            <SelectTrigger id="project-byok-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {settings.allowedProviders.map(value => (
                <SelectItem key={value} value={value}>
                  {providerLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="project-byok-model">
            {i18n['com.affine.admin.model-id']()}
          </Label>
          <Input
            id="project-byok-model"
            value={modelId}
            onChange={event => setModelId(event.target.value)}
            maxLength={255}
            required
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="project-byok-endpoint">
            {i18n['com.affine.integration.external-mcp.field.endpoint']()}
          </Label>
          <Input
            id="project-byok-endpoint"
            type="url"
            value={endpoint}
            onChange={event => setEndpoint(event.target.value)}
            disabled={!settings.customEndpointSupported || busy}
            maxLength={2048}
            placeholder={i18n['com.affine.admin.provider-default']()}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="project-byok-key">
            {i18n['com.affine.admin.api-key']()}
          </Label>
          <Input
            id="project-byok-key"
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
            maxLength={8192}
            placeholder={
              settings.configured && provider === settings.provider
                ? i18n['com.affine.admin.keep-saved-key']()
                : ''
            }
          />
        </div>
      </fieldset>
      {feedback ? (
        <p
          role={feedback.ok ? 'status' : 'alert'}
          className={`text-sm ${feedback.ok ? 'text-foreground' : 'text-destructive'}`}
        >
          {feedback.message}
        </p>
      ) : null}
      {settings.lastError ? (
        <p className="text-sm text-destructive" role="status">
          {settings.lastError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            handleTest().catch(() =>
              toast.error(
                i18n['com.affine.admin.could-not-test-project-byok']()
              )
            );
          }}
          disabled={busy || !canSubmit}
          className="gap-2"
        >
          <FlaskConicalIcon className="h-4 w-4" />
          {testing
            ? i18n['com.affine.admin.testing']()
            : i18n['com.affine.admin.test-connection']()}
        </Button>
        <Button type="submit" disabled={busy || !canSubmit} className="gap-2">
          <SaveIcon className="h-4 w-4" />
          {saving
            ? i18n['com.affine.admin.verifying']()
            : i18n['com.affine.admin.verify-and-save']()}
        </Button>
      </div>
    </form>
  );
}

export function ProjectByokAdmin() {
  const i18n = useI18n();
  const { data, error, isValidating, mutate } = useQuery({
    query: adminProjectByokSettingsQuery,
  });
  const settings = data.adminProjectByokSettings;
  return (
    <section
      aria-labelledby="project-byok-title"
      className="min-w-0 space-y-5 border-b border-border pb-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="project-byok-title" className="text-lg font-semibold">
          {i18n['com.affine.admin.global-project-byok']()}{' '}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          title={i18n['com.affine.admin.reload-project-byok']()}
          aria-label={i18n['com.affine.admin.reload-project-byok']()}
          disabled={isValidating}
          onClick={() => {
            void mutate().catch(() =>
              toast.error(
                i18n['com.affine.admin.could-not-reload-project-byok']()
              )
            );
          }}
        >
          <RefreshCwIcon className="h-4 w-4" />
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex gap-3">
          <dt className="text-muted-foreground">
            {i18n['com.affine.localmind.directoryPermissions.principal']()}
          </dt>
          <dd>{i18n['com.affine.admin.all-project-conversations']()}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-muted-foreground">
            {i18n['com.affine.admin.managed-by']()}
          </dt>
          <dd>{i18n['com.affine.admin.instance-administrators']()}</dd>
        </div>
      </dl>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {i18n[
            'com.affine.admin.could-not-load-the-latest-settings-reload-before-saving'
          ]()}{' '}
        </p>
      ) : (
        <ProjectByokForm
          key={settings.revision}
          settings={settings}
          onSaved={mutate}
        />
      )}
      {settings.auditEvents.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer py-2 font-medium">
            {i18n['com.affine.admin.recent-changes']()}{' '}
          </summary>
          <ul className="divide-y divide-border">
            {settings.auditEvents.map(event => (
              <li
                key={event.revision}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
              >
                <span className="tabular-nums">#{event.revision}</span>
                <span className="min-w-0 break-all">
                  {providerLabels[event.provider]} / {event.modelId}
                </span>
                <span>
                  {event.enabled
                    ? i18n['com.affine.admin.enabled']()
                    : i18n[
                        'com.affine.integration.external-mcp.status.disabled'
                      ]()}
                  {event.credentialChanged ? ' / Key updated' : ''}
                </span>
                <span className="min-w-0 break-all text-muted-foreground">
                  {event.actorId}
                </span>
                <time
                  className="text-muted-foreground"
                  dateTime={event.createdAt}
                >
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
