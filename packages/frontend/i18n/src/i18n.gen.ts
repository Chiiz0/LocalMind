// @ts-nocheck
/* eslint-disable */
import { createElement, useMemo, type ComponentType, type JSX } from "react";
import { useTranslation, Trans, type TransProps } from "react-i18next";
type TypedTransProps<Value, Components, Context extends string | undefined = undefined> = Omit<TransProps<string, never, never, Context>, "values" | "ns" | "i18nKey"> & ({} extends Value ? {} : {
    values: Value;
}) & {
    components: Components;
};
function createProxy(initValue: (key: string) => any) {
    function define(key: string) {
        const value = initValue(key);
        Object.defineProperty(container, key, { value, configurable: true });
        return value;
    }
    const container = {
        __proto__: new Proxy({ __proto__: null }, {
            get(_, key) {
                if (typeof key === "symbol")
                    return undefined;
                return define(key);
            },
        }),
    };
    return new Proxy(container, {
        getPrototypeOf: () => null,
        setPrototypeOf: (_, v) => v === null,
        getOwnPropertyDescriptor: (_, key) => {
            if (typeof key === "symbol")
                return undefined;
            if (!(key in container))
                define(key);
            return Object.getOwnPropertyDescriptor(container, key);
        },
    });
}
export function useAFFiNEI18N(): {
    /**
      * `Project files found for "{{query}}": {{count}}`
      */
    ["com.affine.localmind.project-search.results"](options: Readonly<{
        query: string;
        count: string;
    }>): string;
    /**
      * `The file could not be read. Reopen it and try again.`
      */
    ["com.affine.localmind.office-tool.readFailed"](): string;
    /**
      * `The change request could not be prepared. Check the file and try again.`
      */
    ["com.affine.localmind.office-tool.requestFailed"](): string;
    /**
      * `Revision {{sequence}}`
      */
    ["com.affine.localmind.office-tool.revision"](options: {
        readonly sequence: string;
    }): string;
    /**
      * `Read revision {{sequence}}`
      */
    ["com.affine.localmind.office-tool.read"](options: {
        readonly sequence: string;
    }): string;
    /**
      * `The file was read successfully.`
      */
    ["com.affine.localmind.office-tool.readComplete"](): string;
    /**
      * `Part of the file was read. Select a smaller section to read more.`
      */
    ["com.affine.localmind.office-tool.readPartial"](): string;
    /**
      * `Office change awaiting approval`
      */
    ["com.affine.localmind.office-tool.waiting"](): string;
    /**
      * `Office change request saved`
      */
    ["com.affine.localmind.office-tool.saved"](): string;
    /**
      * `Approval required`
      */
    ["com.affine.localmind.office-tool.approval"](): string;
    /**
      * `Change request`
      */
    ["com.affine.localmind.office-tool.request"](): string;
    /**
      * `The file has not changed. The request is awaiting approval.`
      */
    ["com.affine.localmind.office-tool.notExecuted"](): string;
    /**
      * `The change request was saved. Execution is not yet confirmed.`
      */
    ["com.affine.localmind.office-tool.pending"](): string;
    /**
      * `Change preview`
      */
    ["com.affine.localmind.office-tool.preview"](): string;
    /**
      * `Local drafts ({{count}})`
      */
    ["com.affine.localmind.project-draft.local"](options: {
        readonly count: string;
    }): string;
    /**
      * `Recover draft`
      */
    ["com.affine.localmind.project-draft.recover"](): string;
    /**
      * `Earlier draft {{number}}`
      */
    ["com.affine.localmind.project-draft.earlier"](options: {
        readonly number: string;
    }): string;
    /**
      * `Open a copy of this device's draft. If the resource has changed, saving remains blocked until the conflict is resolved.`
      */
    ["com.affine.localmind.project-draft.confirm"](): string;
    /**
      * `Version {{version}}`
      */
    ["com.affine.localmind.project-files.version"](options: {
        readonly version: string;
    }): string;
    /**
      * `Connection lost. Your draft is kept on this device. Reconnect and retry.`
      */
    ["com.affine.localmind.project-error.network"](): string;
    /**
      * `You no longer have permission for this action. Contact the project or resource owner.`
      */
    ["com.affine.localmind.project-error.permission"](): string;
    /**
      * `This resource is unavailable. It may have been deleted or your access may have changed.`
      */
    ["com.affine.localmind.project-error.unavailable"](): string;
    /**
      * `The resource changed. Your draft is kept on this device. Review the latest version before retrying.`
      */
    ["com.affine.localmind.project-error.conflict"](): string;
    /**
      * `The action could not be completed. Check your connection, editing permission and the current resource version, then retry.`
      */
    ["com.affine.localmind.project-error.failed"](): string;
    /**
      * `Project AI is not configured or is disabled.`
      */
    ["com.affine.localmind.project-byok.missing"](): string;
    /**
      * `Project AI configuration could not be loaded.`
      */
    ["com.affine.localmind.project-byok.error"](): string;
    /**
      * `Configure Project AI`
      */
    ["com.affine.localmind.project-byok.configure"](): string;
    /**
      * `Contact your administrator`
      */
    ["com.affine.localmind.project-byok.contactAdmin"](): string;
    /**
      * `Reject`
      */
    ["com.affine.localmind.project-tasks.reject"](): string;
    /**
      * `Already handled by {{name}}`
      */
    ["com.affine.localmind.project-tasks.alreadyProcessed"](options: {
        readonly name: string;
    }): string;
    /**
      * `Delete permanently`
      */
    ["com.affine.localmind.project-files.permanentlyDelete"](): string;
    /**
      * `Permanently delete {{title}} and everything inside it? This cannot be undone. Published copies remain available.`
      */
    ["com.affine.localmind.project-files.permanentlyDeleteConfirm"](options: {
        readonly title: string;
    }): string;
    /**
      * `Waiting for editing to finish`
      */
    ["com.affine.localmind.project-tasks.waitingLease"](): string;
    /**
      * `Waiting for editing to finish`
      */
    ["com.affine.localmind.tasks.status.waiting_lease"](): string;
    /**
      * `File request`
      */
    ["com.affine.localmind.fileRequest.title"](): string;
    /**
      * `Request file`
      */
    ["com.affine.localmind.fileRequest.request"](): string;
    /**
      * `Recipient`
      */
    ["com.affine.localmind.fileRequest.recipient"](): string;
    /**
      * `Requested by`
      */
    ["com.affine.localmind.fileRequest.requester"](): string;
    /**
      * `Project`
      */
    ["com.affine.localmind.fileRequest.project"](): string;
    /**
      * `Requested file`
      */
    ["com.affine.localmind.fileRequest.fileName"](): string;
    /**
      * `Find recipient`
      */
    ["com.affine.localmind.fileRequest.search"](): string;
    /**
      * `No matching recipients`
      */
    ["com.affine.localmind.fileRequest.noRecipients"](): string;
    /**
      * `Waiting for file`
      */
    ["com.affine.localmind.fileRequest.pending"](): string;
    /**
      * `Preparing file`
      */
    ["com.affine.localmind.fileRequest.in_progress"](): string;
    /**
      * `File received`
      */
    ["com.affine.localmind.fileRequest.completed"](): string;
    /**
      * `Declined`
      */
    ["com.affine.localmind.fileRequest.declined"](): string;
    /**
      * `Cancelled`
      */
    ["com.affine.localmind.fileRequest.cancelled"](): string;
    /**
      * `File request unavailable`
      */
    ["com.affine.localmind.fileRequest.unavailable"](): string;
    /**
      * `Start preparing`
      */
    ["com.affine.localmind.fileRequest.start"](): string;
    /**
      * `Decline request`
      */
    ["com.affine.localmind.fileRequest.decline"](): string;
    /**
      * `Cancel request`
      */
    ["com.affine.localmind.fileRequest.cancel"](): string;
    /**
      * `Confirm`
      */
    ["com.affine.localmind.fileRequest.confirm"](): string;
    /**
      * `Back`
      */
    ["com.affine.localmind.fileRequest.back"](): string;
    /**
      * `Choose file (up to 32 MB)`
      */
    ["com.affine.localmind.fileRequest.choose"](): string;
    /**
      * `Share this file with all members of {{project}}`
      */
    ["com.affine.localmind.fileRequest.share"](options: {
        readonly project: string;
    }): string;
    /**
      * `Submit file`
      */
    ["com.affine.localmind.fileRequest.submit"](): string;
    /**
      * `Download file`
      */
    ["com.affine.localmind.fileRequest.download"](): string;
    /**
      * `Reload request`
      */
    ["com.affine.localmind.fileRequest.refresh"](): string;
    /**
      * `Loading file request`
      */
    ["com.affine.localmind.fileRequest.loading"](): string;
    /**
      * `Could not update the request. Reload and try again.`
      */
    ["com.affine.localmind.fileRequest.failed"](): string;
    /**
      * `Choose a file no larger than 32 MB.`
      */
    ["com.affine.localmind.fileRequest.tooLarge"](): string;
    /**
      * `Read latest source`
      */
    ["com.affine.localmind.source-refresh.title"](): string;
    /**
      * `No linked source is currently available to copy into this project.`
      */
    ["com.affine.localmind.source-refresh.empty"](): string;
    /**
      * `Replace project version {{version}} with the current content of {{title}}?`
      */
    ["com.affine.localmind.source-refresh.confirm"](options: Readonly<{
        version: string;
        title: string;
    }>): string;
    /**
      * `Update project copy`
      */
    ["com.affine.localmind.source-refresh.apply"](): string;
    /**
      * `Workspace publications`
      */
    ["com.affine.localmind.publications.title"](): string;
    /**
      * `Publish a copy`
      */
    ["com.affine.localmind.publications.publish"](): string;
    /**
      * `Update an existing document`
      */
    ["com.affine.localmind.publications.update"](): string;
    /**
      * `Saved in Project`
      */
    ["com.affine.localmind.publications.saved"](): string;
    /**
      * `Awaiting destination`
      */
    ["com.affine.localmind.publications.waiting_for_location"](): string;
    /**
      * `Awaiting confirmation`
      */
    ["com.affine.localmind.publications.waiting_for_confirmation"](): string;
    /**
      * `Published`
      */
    ["com.affine.localmind.publications.complete"](): string;
    /**
      * `Changed since preview`
      */
    ["com.affine.localmind.publications.conflict"](): string;
    /**
      * `Expired`
      */
    ["com.affine.localmind.publications.expired"](): string;
    /**
      * `Choose destination again`
      */
    ["com.affine.localmind.publications.reopen"](): string;
    /**
      * `Workspace`
      */
    ["com.affine.localmind.publications.workspace"](): string;
    /**
      * `Root directory`
      */
    ["com.affine.localmind.publications.root"](): string;
    /**
      * `Use current directory`
      */
    ["com.affine.localmind.publications.current"](): string;
    /**
      * `Review changes`
      */
    ["com.affine.localmind.publications.preview"](): string;
    /**
      * `Confirm publication`
      */
    ["com.affine.localmind.publications.confirm"](): string;
    /**
      * `Current target`
      */
    ["com.affine.localmind.publications.before"](): string;
    /**
      * `Project version`
      */
    ["com.affine.localmind.publications.after"](): string;
    /**
      * `No publication requests`
      */
    ["com.affine.localmind.publications.empty"](): string;
    /**
      * `No available Workspaces`
      */
    ["com.affine.localmind.publications.noWorkspaces"](): string;
    /**
      * `No matching documents`
      */
    ["com.affine.localmind.publications.noTargets"](): string;
    /**
      * `No permission at this destination`
      */
    ["com.affine.localmind.publications.noPermission"](): string;
    /**
      * `Preview unavailable. Reload the request and review access.`
      */
    ["com.affine.localmind.publications.previewUnavailable"](): string;
    /**
      * `Search destinations`
      */
    ["com.affine.localmind.publications.search"](): string;
    /**
      * `Target document`
      */
    ["com.affine.localmind.publications.target"](): string;
    /**
      * `Workspace members: {{count}}`
      */
    ["com.affine.localmind.publications.audience"](options: {
        readonly count: string;
    }): string;
    /**
      * `Partial preview`
      */
    ["com.affine.localmind.publications.truncated"](): string;
    /**
      * `Open published document`
      */
    ["com.affine.localmind.publications.external"](): string;
    /**
      * `Project tasks`
      */
    ["com.affine.localmind.project-tasks.title"](): string;
    /**
      * `No tasks`
      */
    ["com.affine.localmind.project-tasks.empty"](): string;
    /**
      * `Approve changes`
      */
    ["com.affine.localmind.project-tasks.approve"](): string;
    /**
      * `Awaiting approval`
      */
    ["com.affine.localmind.project-tasks.waitingApproval"](): string;
    /**
      * `Awaiting destination`
      */
    ["com.affine.localmind.project-tasks.waitingLocation"](): string;
    /**
      * `Queued`
      */
    ["com.affine.localmind.project-tasks.queued"](): string;
    /**
      * `Running`
      */
    ["com.affine.localmind.project-tasks.running"](): string;
    /**
      * `Completed`
      */
    ["com.affine.localmind.project-tasks.completed"](): string;
    /**
      * `Cancelled`
      */
    ["com.affine.localmind.project-tasks.cancelled"](): string;
    /**
      * `Failed`
      */
    ["com.affine.localmind.project-tasks.failed"](): string;
    /**
      * `{{count}} changes`
      */
    ["com.affine.localmind.project-tasks.commands"](options: {
        readonly count: string;
    }): string;
    /**
      * `Latest tasks`
      */
    ["com.affine.localmind.project-tasks.latest"](): string;
    /**
      * `AI chat`
      */
    ["com.affine.localmind.project-files.chat"](): string;
    /**
      * `Clear selection`
      */
    ["com.affine.localmind.project-files.clearSelection"](): string;
    /**
      * `Project files`
      */
    ["com.affine.localmind.project-files.title"](): string;
    /**
      * `New document`
      */
    ["com.affine.localmind.project-files.newDocument"](): string;
    /**
      * `New canvas`
      */
    ["com.affine.localmind.project-files.newCanvas"](): string;
    /**
      * `New folder`
      */
    ["com.affine.localmind.project-files.newFolder"](): string;
    /**
      * `Upload file`
      */
    ["com.affine.localmind.project-files.upload"](): string;
    /**
      * `This action could not be completed. Check your access and connection, then try again.`
      */
    ["com.affine.localmind.project-files.operationFailed"](): string;
    /**
      * `Queued`
      */
    ["com.affine.localmind.project-files.upload.queued"](): string;
    /**
      * `Uploading`
      */
    ["com.affine.localmind.project-files.upload.uploading"](): string;
    /**
      * `Processing`
      */
    ["com.affine.localmind.project-files.upload.processing"](): string;
    /**
      * `Uploaded`
      */
    ["com.affine.localmind.project-files.upload.completed"](): string;
    /**
      * `Upload failed`
      */
    ["com.affine.localmind.project-files.upload.failed"](): string;
    /**
      * `Expand resource`
      */
    ["com.affine.localmind.project-files.fullscreen"](): string;
    /**
      * `Show chat alongside`
      */
    ["com.affine.localmind.project-files.exitFullscreen"](): string;
    /**
      * `Discard changes`
      */
    ["com.affine.localmind.project-files.discard"](): string;
    /**
      * `Save changes before closing?`
      */
    ["com.affine.localmind.project-files.unsavedConfirm"](): string;
    /**
      * `There are changes that have not been saved to this project.`
      */
    ["com.affine.localmind.project-files.unsavedDescription"](): string;
    /**
      * `Trash`
      */
    ["com.affine.localmind.project-files.trash"](): string;
    /**
      * `Project root`
      */
    ["com.affine.localmind.project-files.root"](): string;
    /**
      * `Name`
      */
    ["com.affine.localmind.project-files.name"](): string;
    /**
      * `Rename`
      */
    ["com.affine.localmind.project-files.rename"](): string;
    /**
      * `Move`
      */
    ["com.affine.localmind.project-files.move"](): string;
    /**
      * `Move here`
      */
    ["com.affine.localmind.project-files.moveHere"](): string;
    /**
      * `Move up`
      */
    ["com.affine.localmind.project-files.moveUp"](): string;
    /**
      * `Move down`
      */
    ["com.affine.localmind.project-files.moveDown"](): string;
    /**
      * `Restore`
      */
    ["com.affine.localmind.project-files.restore"](): string;
    /**
      * `Move to trash`
      */
    ["com.affine.localmind.project-files.delete"](): string;
    /**
      * `File actions`
      */
    ["com.affine.localmind.project-files.actions"](): string;
    /**
      * `No files`
      */
    ["com.affine.localmind.project-files.empty"](): string;
    /**
      * `Load more`
      */
    ["com.affine.localmind.project-files.more"](): string;
    /**
      * `Retry`
      */
    ["com.affine.localmind.project-files.retry"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.localmind.project-files.cancel"](): string;
    /**
      * `Create`
      */
    ["com.affine.localmind.project-files.create"](): string;
    /**
      * `Save`
      */
    ["com.affine.localmind.project-files.save"](): string;
    /**
      * `Saved in project`
      */
    ["com.affine.localmind.project-files.saved"](): string;
    /**
      * `Saving`
      */
    ["com.affine.localmind.project-files.saving"](): string;
    /**
      * `Unsaved changes`
      */
    ["com.affine.localmind.project-files.unsaved"](): string;
    /**
      * `Reload`
      */
    ["com.affine.localmind.project-files.reload"](): string;
    /**
      * `Close file`
      */
    ["com.affine.localmind.project-files.close"](): string;
    /**
      * `Download`
      */
    ["com.affine.localmind.project-files.download"](): string;
    /**
      * `Version history`
      */
    ["com.affine.localmind.project-files.history"](): string;
    /**
      * `Current version`
      */
    ["com.affine.localmind.project-files.current"](): string;
    /**
      * `Compare versions`
      */
    ["com.affine.localmind.project-files.compare"](): string;
    /**
      * `Search this folder`
      */
    ["com.affine.localmind.project-files.search"](): string;
    /**
      * `Folder`
      */
    ["com.affine.localmind.workspace-import.kind.folder"](): string;
    /**
      * `Document`
      */
    ["com.affine.localmind.workspace-import.kind.page"](): string;
    /**
      * `Canvas`
      */
    ["com.affine.localmind.workspace-import.kind.edgeless"](): string;
    /**
      * `File`
      */
    ["com.affine.localmind.workspace-import.kind.file"](): string;
    /**
      * `Word document`
      */
    ["com.affine.localmind.workspace-import.kind.document"](): string;
    /**
      * `Spreadsheet`
      */
    ["com.affine.localmind.workspace-import.kind.workbook"](): string;
    /**
      * `Presentation`
      */
    ["com.affine.localmind.workspace-import.kind.presentation"](): string;
    /**
      * `PDF`
      */
    ["com.affine.localmind.workspace-import.kind.pdf"](): string;
    /**
      * `Import from workspace`
      */
    ["com.affine.localmind.workspace-import.title"](): string;
    /**
      * `Import steps`
      */
    ["com.affine.localmind.workspace-import.steps"](): string;
    /**
      * `Choose workspace`
      */
    ["com.affine.localmind.workspace-import.workspace"](): string;
    /**
      * `Choose file`
      */
    ["com.affine.localmind.workspace-import.file"](): string;
    /**
      * `Only workspaces and files you can view are shown. A copy will be saved in the current Project folder.`
      */
    ["com.affine.localmind.workspace-import.scope"](): string;
    /**
      * `Search workspace files`
      */
    ["com.affine.localmind.workspace-import.search"](): string;
    /**
      * `Could not load this list. Retry to check your current access.`
      */
    ["com.affine.localmind.workspace-import.loadFailed"](): string;
    /**
      * `No selectable files on this page. Try another search or continue to the next page.`
      */
    ["com.affine.localmind.workspace-import.noFiles"](): string;
    /**
      * `No accessible workspaces on this page. Check that you have joined the workspace.`
      */
    ["com.affine.localmind.workspace-import.noWorkspaces"](): string;
    /**
      * `Ready to import`
      */
    ["com.affine.localmind.workspace-import.direct"](): string;
    /**
      * `Sharing approval required`
      */
    ["com.affine.localmind.workspace-import.approval"](): string;
    /**
      * `Copying is disabled by source policy`
      */
    ["com.affine.localmind.workspace-import.blocked"](): string;
    /**
      * `The Project will own an independent copy that members can edit. Changes will not update the source file.`
      */
    ["com.affine.localmind.workspace-import.copyHint"](): string;
    /**
      * `A notification will ask an authorized approver for permission. The Project Todo will wait for approval, then import an independent copy automatically. Approval cannot be withdrawn.`
      */
    ["com.affine.localmind.workspace-import.approvalHint"](): string;
    /**
      * `Request approval to import`
      */
    ["com.affine.localmind.workspace-import.request"](): string;
    /**
      * `Import file`
      */
    ["com.affine.localmind.workspace-import.import"](): string;
    /**
      * `Next page`
      */
    ["com.affine.localmind.workspace-import.next"](): string;
    /**
      * `Could not submit. Retry, or reselect the file if permissions changed. Retrying will not create duplicate copies.`
      */
    ["com.affine.localmind.workspace-import.submitFailed"](): string;
    /**
      * `Approval requested. The file will import automatically after approval.`
      */
    ["com.affine.localmind.workspace-import.requested"](): string;
    /**
      * `Import queued. You can continue working in the Project.`
      */
    ["com.affine.localmind.workspace-import.queued"](): string;
    /**
      * `Waiting for sharing approval`
      */
    ["com.affine.localmind.workspace-import.waiting"](): string;
    /**
      * `Importing`
      */
    ["com.affine.localmind.workspace-import.processing"](): string;
    /**
      * `Imported`
      */
    ["com.affine.localmind.workspace-import.completed"](): string;
    /**
      * `Import failed`
      */
    ["com.affine.localmind.workspace-import.failed"](): string;
    /**
      * `Not imported`
      */
    ["com.affine.localmind.workspace-import.cancelled"](): string;
    /**
      * `Cannot retry yet. Check source read and sharing permissions, and the destination folder.`
      */
    ["com.affine.localmind.workspace-import.retryFailed"](): string;
    /**
      * `Could not load import status. Refreshing will not repeat the import.`
      */
    ["com.affine.localmind.workspace-import.statusFailed"](): string;
    /**
      * `Import history`
      */
    ["com.affine.localmind.workspace-import.history"](): string;
    /**
      * `Open file`
      */
    ["com.affine.localmind.workspace-import.open"](): string;
    /**
      * `If an import fails, check source permissions, file availability and the destination folder, then retry the task. Retries will not duplicate the copy.`
      */
    ["com.affine.localmind.workspace-import.failureHint"](): string;
    /**
      * `{{count}} of {{limit}} files selected`
      */
    ["com.affine.localmind.project-files.selectionCount"](options: Readonly<{
        count: string;
        limit: string;
    }>): string;
    /**
      * `Opening in read-only mode while checking edit access...`
      */
    ["com.affine.localmind.project-lease.acquiring"](): string;
    /**
      * `{{name}} is editing. This resource is read-only.`
      */
    ["com.affine.localmind.project-lease.heldBy"](options: {
        readonly name: string;
    }): string;
    /**
      * `An AI task is writing. This resource is read-only.`
      */
    ["com.affine.localmind.project-lease.aiWriting"](): string;
    /**
      * `Notify me when editing ends`
      */
    ["com.affine.localmind.project-lease.notify"](): string;
    /**
      * `Editing has ended. You can now request edit access.`
      */
    ["com.affine.localmind.project-lease.available"](): string;
    /**
      * `Start editing`
      */
    ["com.affine.localmind.project-lease.edit"](): string;
    /**
      * `Could not confirm edit access. Check your connection and retry.`
      */
    ["com.affine.localmind.project-lease.failed"](): string;
    /**
      * `Edit access has ended. Your unsaved changes are retained.`
      */
    ["com.affine.localmind.project-lease.lost"](): string;
    /**
      * `Project access has changed. Contact a project member.`
      */
    ["com.affine.localmind.project-lease.accessLost"](): string;
    /**
      * `Parent folder`
      */
    ["com.affine.localmind.project-files.back"](): string;
    /**
      * `Historical version`
      */
    ["com.affine.localmind.project-files.readOnly"](): string;
    /**
      * `Import failed. Retry to continue.`
      */
    ["com.affine.localmind.project-files.importFailed"](): string;
    /**
      * `The file changed. Reload and compare before saving.`
      */
    ["com.affine.localmind.project-files.conflict"](): string;
    /**
      * `Open`
      */
    ["com.affine.localmind.project-files.open"](): string;
    /**
      * `Source references`
      */
    ["com.affine.localmind.project-files.source"](): string;
    /**
      * `Storage workspace`
      */
    ["com.affine.localmind.documentCreation.workspace"](): string;
    /**
      * `Location`
      */
    ["com.affine.localmind.documentCreation.location"](): string;
    /**
      * `Select workspace`
      */
    ["com.affine.localmind.documentCreation.chooseWorkspace"](): string;
    /**
      * `Select location`
      */
    ["com.affine.localmind.documentCreation.chooseLocation"](): string;
    /**
      * `Workspace root`
      */
    ["com.affine.localmind.documentCreation.root"](): string;
    /**
      * `Create document here`
      */
    ["com.affine.localmind.documentCreation.confirm"](): string;
    /**
      * `Confirm location and continue`
      */
    ["com.affine.localmind.documentCreation.reconfirm"](): string;
    /**
      * `Retry`
      */
    ["com.affine.localmind.documentCreation.retry"](): string;
    /**
      * `Document created`
      */
    ["com.affine.localmind.documentCreation.created"](): string;
    /**
      * `Awaiting location selection`
      */
    ["com.affine.localmind.documentCreation.waiting"](): string;
    /**
      * `Creating document`
      */
    ["com.affine.localmind.documentCreation.running"](): string;
    /**
      * `Creation needs attention`
      */
    ["com.affine.localmind.documentCreation.failed"](): string;
    /**
      * `Directory placement pending`
      */
    ["com.affine.localmind.documentCreation.placementPending"](): string;
    /**
      * `Added to project`
      */
    ["com.affine.localmind.documentCreation.added"](): string;
    /**
      * `Project access awaiting approval`
      */
    ["com.affine.localmind.documentCreation.accessPending"](): string;
    /**
      * `Project addition needs attention`
      */
    ["com.affine.localmind.documentCreation.addFailed"](): string;
    /**
      * `Document copy`
      */
    ["com.affine.localmind.documentCreation.copy"](): string;
    /**
      * `Source document`
      */
    ["com.affine.localmind.documentCreation.source"](): string;
    /**
      * `Previous page`
      */
    ["com.affine.localmind.documentCreation.previous"](): string;
    /**
      * `Project access revoked`
      */
    ["com.affine.localmind.documentCreation.revoked"](): string;
    /**
      * `Project access request rejected`
      */
    ["com.affine.localmind.documentCreation.rejected"](): string;
    /**
      * `Project access request withdrawn`
      */
    ["com.affine.localmind.documentCreation.withdrawn"](): string;
    /**
      * `Project access request expired`
      */
    ["com.affine.localmind.documentCreation.expired"](): string;
    /**
      * `Project addition requested`
      */
    ["com.affine.localmind.documentCreation.addRequested"](): string;
    /**
      * `Could not load document creation requests`
      */
    ["com.affine.localmind.documentCreation.loadFailed"](): string;
    /**
      * `No workspace permits document creation`
      */
    ["com.affine.localmind.documentCreation.noWorkspaces"](): string;
    /**
      * `Loading locations`
      */
    ["com.affine.localmind.documentCreation.loading"](): string;
    /**
      * `More directories`
      */
    ["com.affine.localmind.documentCreation.more"](): string;
    /**
      * `Loading document`
      */
    ["com.affine.doc-save.loading"](): string;
    /**
      * `Saving to this device`
      */
    ["com.affine.doc-save.saving"](): string;
    /**
      * `Saved in this browser or device`
      */
    ["com.affine.doc-save.local"](): string;
    /**
      * `Saved locally, waiting to sync`
      */
    ["com.affine.doc-save.pending"](): string;
    /**
      * `Saved locally, sync interrupted and retrying`
      */
    ["com.affine.doc-save.retrying"](): string;
    /**
      * `Saved locally and synced`
      */
    ["com.affine.doc-save.synced"](): string;
    /**
      * `Back to my Content`
      */
    ["404.back"](): string;
    /**
      * `Sorry, you do not have access or this content does not exist...`
      */
    ["404.hint"](): string;
    /**
      * `Sign in to another account`
      */
    ["404.signOut"](): string;
    /**
      * `LocalMind Cloud`
      */
    ["AFFiNE Cloud"](): string;
    /**
      * `All docs`
      */
    ["All pages"](): string;
    /**
      * `App version`
      */
    ["App Version"](): string;
    /**
      * `Available offline`
      */
    ["Available Offline"](): string;
    /**
      * `Bold`
      */
    Bold(): string;
    /**
      * `Cancel`
      */
    Cancel(): string;
    /**
      * `Click to replace photo`
      */
    ["Click to replace photo"](): string;
    /**
      * `Collections`
      */
    Collections(): string;
    /**
      * `Complete`
      */
    Complete(): string;
    /**
      * `Confirm`
      */
    Confirm(): string;
    /**
      * `Continue`
      */
    Continue(): string;
    /**
      * `Convert to `
      */
    ["Convert to "](): string;
    /**
      * `Copied link to clipboard`
      */
    ["Copied link to clipboard"](): string;
    /**
      * `Copied to clipboard`
      */
    ["Copied to clipboard"](): string;
    /**
      * `Copy`
      */
    Copy(): string;
    /**
      * `Create`
      */
    Create(): string;
    /**
      * `Created`
      */
    Created(): string;
    /**
      * `Customise`
      */
    Customize(): string;
    /**
      * `Colors`
      */
    Colors(): string;
    /**
      * `Database file already loaded`
      */
    DB_FILE_ALREADY_LOADED(): string;
    /**
      * `Invalid database file`
      */
    DB_FILE_INVALID(): string;
    /**
      * `Database file migration failed`
      */
    DB_FILE_MIGRATION_FAILED(): string;
    /**
      * `Database file path invalid`
      */
    DB_FILE_PATH_INVALID(): string;
    /**
      * `Date`
      */
    Date(): string;
    /**
      * `Delete`
      */
    Delete(): string;
    /**
      * `Deleted`
      */
    Deleted(): string;
    /**
      * `Disable`
      */
    Disable(): string;
    /**
      * `Disable public sharing`
      */
    ["Disable Public Sharing"](): string;
    /**
      * `Disable snapshot`
      */
    ["Disable Snapshot"](): string;
    /**
      * `Divider`
      */
    Divider(): string;
    /**
      * `Edgeless`
      */
    Edgeless(): string;
    /**
      * `Edit`
      */
    Edit(): string;
    /**
      * `Editor version`
      */
    ["Editor Version"](): string;
    /**
      * `Enable`
      */
    Enable(): string;
    /**
      * `Enable LocalMind Sync`
      */
    ["Enable AFFiNE Cloud"](): string;
    /**
      * `Your workspace will be synced and backed up with LocalMind Sync.`
      */
    ["Enable AFFiNE Cloud Description"](): string;
    /**
      * `Some features need LocalMind Sync. Web workspaces are saved in this browser and may be removed automatically when disk space is low. Enable LocalMind Sync to keep this workspace safer and available across devices.`
      */
    ["Enable cloud hint"](): string;
    /**
      * `Full Backup`
      */
    ["Full Backup"](): string;
    /**
      * `Export a complete workspace backup`
      */
    ["Full Backup Description"](): string;
    /**
      * `Sync all cloud data and export a complete workspace backup`
      */
    ["Full Backup Hint"](): string;
    /**
      * `Quick Export`
      */
    ["Quick Export"](): string;
    /**
      * `Skip cloud synchronization and quickly export current data(some attachments or docs may be missing)`
      */
    ["Quick Export Description"](): string;
    /**
      * `Export failed`
      */
    ["Export failed"](): string;
    /**
      * `Export success`
      */
    ["Export success"](): string;
    /**
      * `Export to HTML`
      */
    ["Export to HTML"](): string;
    /**
      * `Export to Markdown`
      */
    ["Export to Markdown"](): string;
    /**
      * `Export to PNG`
      */
    ["Export to PNG"](): string;
    /**
      * `File already exists`
      */
    FILE_ALREADY_EXISTS(): string;
    /**
      * `Favourite`
      */
    Favorite(): string;
    /**
      * `Favourited`
      */
    Favorited(): string;
    /**
      * `Favourites`
      */
    Favorites(): string;
    /**
      * `Feedback`
      */
    Feedback(): string;
    /**
      * `Found 0 results`
      */
    ["Find 0 result"](): string;
    /**
      * `Go back`
      */
    ["Go Back"](): string;
    /**
      * `Go forward`
      */
    ["Go Forward"](): string;
    /**
      * `Got it`
      */
    ["Got it"](): string;
    /**
      * `Heading {{number}}`
      */
    Heading(options: {
        readonly number: string;
    }): string;
    /**
      * `Image`
      */
    Image(): string;
    /**
      * `Import`
      */
    Import(): string;
    /**
      * `Info`
      */
    Info(): string;
    /**
      * `Invitation sent`
      */
    ["Invitation sent"](): string;
    /**
      * `Invited members have been notified with email to join this Workspace.`
      */
    ["Invitation sent hint"](): string;
    /**
      * `Invite`
      */
    Invite(): string;
    /**
      * `Invite members`
      */
    ["Invite Members"](): string;
    /**
      * `Invited members will collaborate with you in current workspace`
      */
    ["Invite Members Message"](): string;
    /**
      * `Insufficient team seat`
      */
    ["insufficient-team-seat"](): string;
    /**
      * `Joined workspace`
      */
    ["Joined Workspace"](): string;
    /**
      * `Leave`
      */
    Leave(): string;
    /**
      * `Hyperlink (with selected text)`
      */
    Link(): string;
    /**
      * `Loading...`
      */
    Loading(): string;
    /**
      * `Local`
      */
    Local(): string;
    /**
      * `Member`
      */
    Member(): string;
    /**
      * `Members`
      */
    Members(): string;
    /**
      * `Manage members here, invite new member by email.`
      */
    ["Members hint"](): string;
    /**
      * `New doc`
      */
    ["New Page"](): string;
    /**
      * `Owner`
      */
    Owner(): string;
    /**
      * `Page`
      */
    Page(): string;
    /**
      * `Pen`
      */
    Pen(): string;
    /**
      * `Pending`
      */
    Pending(): string;
    /**
      * `Collaborator`
      */
    Collaborator(): string;
    /**
      * `Under Review`
      */
    ["Under-Review"](): string;
    /**
      * `Need More Seats`
      */
    ["Need-More-Seats"](): string;
    /**
      * `Allocating Seat`
      */
    ["Allocating Seat"](): string;
    /**
      * `Admin`
      */
    Admin(): string;
    /**
      * `Publish`
      */
    Publish(): string;
    /**
      * `Published to web`
      */
    ["Published to Web"](): string;
    /**
      * `Quick search`
      */
    ["Quick Search"](): string;
    /**
      * `Search`
      */
    ["Quick search"](): string;
    /**
      * `Recent`
      */
    Recent(): string;
    /**
      * `Remove from workspace`
      */
    ["Remove from workspace"](): string;
    /**
      * `Remove photo`
      */
    ["Remove photo"](): string;
    /**
      * `Remove special filter`
      */
    ["Remove special filter"](): string;
    /**
      * `Removed successfully`
      */
    ["Removed successfully"](): string;
    /**
      * `Rename`
      */
    Rename(): string;
    /**
      * `Retry`
      */
    Retry(): string;
    /**
      * `Save`
      */
    Save(): string;
    /**
      * `Select`
      */
    Select(): string;
    /**
      * `Sign in to LocalMind`
      */
    ["Sign in"](): string;
    /**
      * `Sign in and enable`
      */
    ["Sign in and Enable"](): string;
    /**
      * `Sign out of LocalMind`
      */
    ["Sign out"](): string;
    /**
      * `Snapshot`
      */
    Snapshot(): string;
    /**
      * `Storage`
      */
    Storage(): string;
    /**
      * `Storage and export`
      */
    ["Storage and Export"](): string;
    /**
      * `Successfully deleted`
      */
    ["Successfully deleted"](): string;
    /**
      * `Successfully joined!`
      */
    ["Successfully joined!"](): string;
    /**
      * `Switch`
      */
    Switch(): string;
    /**
      * `Switch view`
      */
    switchView(): string;
    /**
      * `Sync`
      */
    Sync(): string;
    /**
      * `Tags`
      */
    Tags(): string;
    /**
      * `Text`
      */
    Text(): string;
    /**
      * `Theme`
      */
    Theme(): string;
    /**
      * `Title`
      */
    Title(): string;
    /**
      * `Trash`
      */
    Trash(): string;
    /**
      * `Unknown error`
      */
    UNKNOWN_ERROR(): string;
    /**
      * `Undo`
      */
    Undo(): string;
    /**
      * `Unpin`
      */
    Unpin(): string;
    /**
      * `Untitled`
      */
    Untitled(): string;
    /**
      * `Update workspace name success`
      */
    ["Update workspace name success"](): string;
    /**
      * `Updated`
      */
    Updated(): string;
    /**
      * `Upload`
      */
    Upload(): string;
    /**
      * `Users`
      */
    Users(): string;
    /**
      * `Version`
      */
    Version(): string;
    /**
      * `Visit workspace`
      */
    ["Visit Workspace"](): string;
    /**
      * `Workspace name`
      */
    ["Workspace Name"](): string;
    /**
      * `Workspace Owner`
      */
    ["Workspace Owner"](): string;
    /**
      * `Workspace profile`
      */
    ["Workspace Profile"](): string;
    /**
      * `Workspace settings`
      */
    ["Workspace Settings"](): string;
    /**
      * `{{name}}'s settings`
      */
    ["Workspace Settings with name"](options: {
        readonly name: string;
    }): string;
    /**
      * `{{name}} is saved locally`
      */
    ["Workspace saved locally"](options: {
        readonly name: string;
    }): string;
    /**
      * `Zoom in`
      */
    ["Zoom in"](): string;
    /**
      * `Zoom out`
      */
    ["Zoom out"](): string;
    /**
      * `Unknown User`
      */
    ["Unknown User"](): string;
    /**
      * `Deleted User`
      */
    ["Deleted User"](): string;
    /**
      * `all`
      */
    all(): string;
    /**
      * `current`
      */
    current(): string;
    /**
      * `created at {{time}}`
      */
    ["created at"](options: {
        readonly time: string;
    }): string;
    /**
      * `last updated at {{time}}`
      */
    ["updated at"](options: {
        readonly time: string;
    }): string;
    /**
      * `Automatically check for new updates periodically.`
      */
    ["com.affine.aboutAFFiNE.autoCheckUpdate.description"](): string;
    /**
      * `Check for updates automatically`
      */
    ["com.affine.aboutAFFiNE.autoCheckUpdate.title"](): string;
    /**
      * `Automatically download updates (to this device).`
      */
    ["com.affine.aboutAFFiNE.autoDownloadUpdate.description"](): string;
    /**
      * `Download updates automatically`
      */
    ["com.affine.aboutAFFiNE.autoDownloadUpdate.title"](): string;
    /**
      * `View the LocalMind Changelog.`
      */
    ["com.affine.aboutAFFiNE.changelog.description"](): string;
    /**
      * `Discover what's new`
      */
    ["com.affine.aboutAFFiNE.changelog.title"](): string;
    /**
      * `Check for update`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.button.check"](): string;
    /**
      * `Download update`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.button.download"](): string;
    /**
      * `Restart to update`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.button.restart"](): string;
    /**
      * `Retry`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.button.retry"](): string;
    /**
      * `New version is ready`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.description"](): string;
    /**
      * `Manually check for updates.`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.check"](): string;
    /**
      * `Checking for updates...`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.checking"](): string;
    /**
      * `Downloading the latest version...`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.downloading"](): string;
    /**
      * `Unable to connect to the update server.`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.error"](): string;
    /**
      * `You've got the latest version of LocalMind.`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.latest"](): string;
    /**
      * `Restart to apply update.`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.restart"](): string;
    /**
      * `New update available ({{version}})`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.update-available"](options: {
        readonly version: string;
    }): string;
    /**
      * `Check for updates`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.title"](): string;
    /**
      * `Communities`
      */
    ["com.affine.aboutAFFiNE.community.title"](): string;
    /**
      * `LocalMind community`
      */
    ["com.affine.aboutAFFiNE.contact.community"](): string;
    /**
      * `Contact us`
      */
    ["com.affine.aboutAFFiNE.contact.title"](): string;
    /**
      * `Official website`
      */
    ["com.affine.aboutAFFiNE.contact.website"](): string;
    /**
      * `Privacy`
      */
    ["com.affine.aboutAFFiNE.legal.privacy"](): string;
    /**
      * `Legal Info`
      */
    ["com.affine.aboutAFFiNE.legal.title"](): string;
    /**
      * `Terms of use`
      */
    ["com.affine.aboutAFFiNE.legal.tos"](): string;
    /**
      * `Information about LocalMind`
      */
    ["com.affine.aboutAFFiNE.subtitle"](): string;
    /**
      * `About LocalMind`
      */
    ["com.affine.aboutAFFiNE.title"](): string;
    /**
      * `App version`
      */
    ["com.affine.aboutAFFiNE.version.app"](): string;
    /**
      * `Editor version`
      */
    ["com.affine.aboutAFFiNE.version.editor.title"](): string;
    /**
      * `Version`
      */
    ["com.affine.aboutAFFiNE.version.title"](): string;
    /**
      * `Get started`
      */
    ["com.affine.ai-onboarding.edgeless.get-started"](): string;
    /**
      * `Lets you think bigger, create faster, work smarter and save time for every project.`
      */
    ["com.affine.ai-onboarding.edgeless.message"](): string;
    /**
      * `Upgrade to unlimited usage`
      */
    ["com.affine.ai-onboarding.edgeless.purchase"](): string;
    /**
      * `Right-clicking to select content AI`
      */
    ["com.affine.ai-onboarding.edgeless.title"](): string;
    /**
      * `Lets you think bigger, create faster, work smarter and save time for every project.`
      */
    ["com.affine.ai-onboarding.general.1.description"](): string;
    /**
      * `Meet LocalMind AI`
      */
    ["com.affine.ai-onboarding.general.1.title"](): string;
    /**
      * `Answer questions, draft docs, visualize ideas - LocalMind AI can save you time at every possible step. Powered by GPT's most powerful model.`
      */
    ["com.affine.ai-onboarding.general.2.description"](): string;
    /**
      * `Chat with LocalMind AI`
      */
    ["com.affine.ai-onboarding.general.2.title"](): string;
    /**
      * `Get insightful answer to any question, instantly.`
      */
    ["com.affine.ai-onboarding.general.3.description"](): string;
    /**
      * `Edit inline with LocalMind AI`
      */
    ["com.affine.ai-onboarding.general.3.title"](): string;
    /**
      * `Expand thinking. Untangle complexity. Breakdown and visualise your content with crafted mindmap and presentable slides with one click.`
      */
    ["com.affine.ai-onboarding.general.4.description"](): string;
    /**
      * `Make mind-map and presents with AI`
      */
    ["com.affine.ai-onboarding.general.4.title"](): string;
    /**
      * `LocalMind AI is ready`
      */
    ["com.affine.ai-onboarding.general.5.title"](): string;
    /**
      * `Get started`
      */
    ["com.affine.ai-onboarding.general.get-started"](): string;
    /**
      * `Next`
      */
    ["com.affine.ai-onboarding.general.next"](): string;
    /**
      * `Back`
      */
    ["com.affine.ai-onboarding.general.prev"](): string;
    /**
      * `Get unlimited usage`
      */
    ["com.affine.ai-onboarding.general.purchase"](): string;
    /**
      * `Remind me later`
      */
    ["com.affine.ai-onboarding.general.skip"](): string;
    /**
      * `Try for free`
      */
    ["com.affine.ai-onboarding.general.try-for-free"](): string;
    /**
      * `Dismiss`
      */
    ["com.affine.ai-onboarding.local.action-dismiss"](): string;
    /**
      * `Get started`
      */
    ["com.affine.ai-onboarding.local.action-get-started"](): string;
    /**
      * `Learn more`
      */
    ["com.affine.ai-onboarding.local.action-learn-more"](): string;
    /**
      * `Lets you think bigger, create faster, work smarter and save time for every project.`
      */
    ["com.affine.ai-onboarding.local.message"](): string;
    /**
      * `Meet LocalMind AI`
      */
    ["com.affine.ai-onboarding.local.title"](): string;
    /**
      * `New`
      */
    ["com.affine.ai-scroll-tip.tag"](): string;
    /**
      * `Meet LocalMind AI`
      */
    ["com.affine.ai-scroll-tip.title"](): string;
    /**
      * `View`
      */
    ["com.affine.ai-scroll-tip.view"](): string;
    /**
      * `Please switch to edgeless mode`
      */
    ["com.affine.ai.action.edgeless-only.dialog-title"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.ai.login-required.dialog-cancel"](): string;
    /**
      * `Sign in`
      */
    ["com.affine.ai.login-required.dialog-confirm"](): string;
    /**
      * `To use LocalMind AI, please sign in to your LocalMind Cloud account.`
      */
    ["com.affine.ai.login-required.dialog-content"](): string;
    /**
      * `Sign in to continue`
      */
    ["com.affine.ai.login-required.dialog-title"](): string;
    /**
      * `Failed to insert template, please try again.`
      */
    ["com.affine.ai.template-insert.failed"](): string;
    /**
      * `LocalMind AI`
      */
    ["com.affine.ai.chat-panel.title"](): string;
    /**
      * `LocalMind AI is loading history...`
      */
    ["com.affine.ai.chat-panel.loading-history"](): string;
    /**
      * `Embedding {{done}}/{{total}}`
      */
    ["com.affine.ai.chat-panel.embedding-progress"](options: Readonly<{
        done: string;
        total: string;
    }>): string;
    /**
      * `Delete this history?`
      */
    ["com.affine.ai.chat-panel.session.delete.confirm.title"](): string;
    /**
      * `Do you want to delete this AI conversation history? Once deleted, it cannot be recovered.`
      */
    ["com.affine.ai.chat-panel.session.delete.confirm.message"](): string;
    /**
      * `History deleted`
      */
    ["com.affine.ai.chat-panel.session.delete.toast.success"](): string;
    /**
      * `Failed to delete history`
      */
    ["com.affine.ai.chat-panel.session.delete.toast.failed"](): string;
    /**
      * `All docs`
      */
    ["com.affine.all-pages.header"](): string;
    /**
      * `Learn more`
      */
    ["com.affine.app-sidebar.learn-more"](): string;
    /**
      * `Star us`
      */
    ["com.affine.app-sidebar.star-us"](): string;
    /**
      * `Download update`
      */
    ["com.affine.appUpdater.downloadUpdate"](): string;
    /**
      * `Downloading`
      */
    ["com.affine.appUpdater.downloading"](): string;
    /**
      * `Restart to install update`
      */
    ["com.affine.appUpdater.installUpdate"](): string;
    /**
      * `Open download page`
      */
    ["com.affine.appUpdater.openDownloadPage"](): string;
    /**
      * `Update available`
      */
    ["com.affine.appUpdater.updateAvailable"](): string;
    /**
      * `Discover what's new!`
      */
    ["com.affine.appUpdater.whatsNew"](): string;
    /**
      * `Customise the appearance of the client.`
      */
    ["com.affine.appearanceSettings.clientBorder.description"](): string;
    /**
      * `Client border style`
      */
    ["com.affine.appearanceSettings.clientBorder.title"](): string;
    /**
      * `Choose your colour mode`
      */
    ["com.affine.appearanceSettings.color.description"](): string;
    /**
      * `Colour mode`
      */
    ["com.affine.appearanceSettings.color.title"](): string;
    /**
      * `Edit all LocalMind theme variables here`
      */
    ["com.affine.appearanceSettings.customize-theme.description"](): string;
    /**
      * `Customize Theme`
      */
    ["com.affine.appearanceSettings.customize-theme.title"](): string;
    /**
      * `Images`
      */
    ["com.affine.appearanceSettings.images.title"](): string;
    /**
      * `Smooth image rendering`
      */
    ["com.affine.appearanceSettings.images.antialiasing.title"](): string;
    /**
      * `When disabled, images are rendered using nearest-neighbor scaling for crisp pixels.`
      */
    ["com.affine.appearanceSettings.images.antialiasing.description"](): string;
    /**
      * `Reset all`
      */
    ["com.affine.appearanceSettings.customize-theme.reset"](): string;
    /**
      * `Open Theme Editor`
      */
    ["com.affine.appearanceSettings.customize-theme.open"](): string;
    /**
      * `Choose your font style`
      */
    ["com.affine.appearanceSettings.font.description"](): string;
    /**
      * `Font style`
      */
    ["com.affine.appearanceSettings.font.title"](): string;
    /**
      * `Mono`
      */
    ["com.affine.appearanceSettings.fontStyle.mono"](): string;
    /**
      * `Sans`
      */
    ["com.affine.appearanceSettings.fontStyle.sans"](): string;
    /**
      * `Serif`
      */
    ["com.affine.appearanceSettings.fontStyle.serif"](): string;
    /**
      * `Select the language for the interface.`
      */
    ["com.affine.appearanceSettings.language.description"](): string;
    /**
      * `Display language`
      */
    ["com.affine.appearanceSettings.language.title"](): string;
    /**
      * `Use background noise effect on the sidebar.`
      */
    ["com.affine.appearanceSettings.noisyBackground.description"](): string;
    /**
      * `Noise background on the sidebar`
      */
    ["com.affine.appearanceSettings.noisyBackground.title"](): string;
    /**
      * `Sidebar`
      */
    ["com.affine.appearanceSettings.sidebar.title"](): string;
    /**
      * `Customize your LocalMind appearance`
      */
    ["com.affine.appearanceSettings.subtitle"](): string;
    /**
      * `Menubar`
      */
    ["com.affine.appearanceSettings.menubar.title"](): string;
    /**
      * `Enable menubar app`
      */
    ["com.affine.appearanceSettings.menubar.toggle"](): string;
    /**
      * `Display the menubar app in the tray for quick access to LocalMind or meeting recordings.`
      */
    ["com.affine.appearanceSettings.menubar.description"](): string;
    /**
      * `Window behavior`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.title"](): string;
    /**
      * `Quick open from tray icon`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.openOnLeftClick.toggle"](): string;
    /**
      * `Open LocalMind when left‑clicking the tray icon.`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.openOnLeftClick.description"](): string;
    /**
      * `Minimize to tray`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.minimizeToTray.toggle"](): string;
    /**
      * `Minimize LocalMind to the system tray.`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.minimizeToTray.description"](): string;
    /**
      * `Close to tray`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.closeToTray.toggle"](): string;
    /**
      * `Close LocalMind to the system tray.`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.closeToTray.description"](): string;
    /**
      * `Start minimized`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.startMinimized.toggle"](): string;
    /**
      * `Start LocalMind minimized to the system tray.`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.startMinimized.description"](): string;
    /**
      * `Theme`
      */
    ["com.affine.appearanceSettings.theme.title"](): string;
    /**
      * `Appearance settings`
      */
    ["com.affine.appearanceSettings.title"](): string;
    /**
      * `Use transparency effect on the sidebar.`
      */
    ["com.affine.appearanceSettings.translucentUI.description"](): string;
    /**
      * `Translucent UI on the sidebar`
      */
    ["com.affine.appearanceSettings.translucentUI.title"](): string;
    /**
      * `Show linked doc in sidebar`
      */
    ["com.affine.appearanceSettings.showLinkedDocInSidebar.title"](): string;
    /**
      * `Control whether to show the structure of linked docs in the sidebar.`
      */
    ["com.affine.appearanceSettings.showLinkedDocInSidebar.description"](): string;
    /**
      * `Your current email is {{email}}. We'll send a confirmation link there first so you can securely switch to a new email address.`
      */
    ["com.affine.auth.change.email.message"](options: {
        readonly email: string;
    }): string;
    /**
      * `Please enter your new email address below. We will send a verification link to this email address to complete the process.`
      */
    ["com.affine.auth.change.email.page.subtitle"](): string;
    /**
      * `Congratulations! You have successfully updated the email address associated with your LocalMind account.`
      */
    ["com.affine.auth.change.email.page.success.subtitle"](): string;
    /**
      * `Email address updated!`
      */
    ["com.affine.auth.change.email.page.success.title"](): string;
    /**
      * `Change email address`
      */
    ["com.affine.auth.change.email.page.title"](): string;
    /**
      * `Forgot password`
      */
    ["com.affine.auth.forget"](): string;
    /**
      * `Later`
      */
    ["com.affine.auth.later"](): string;
    /**
      * `Open LocalMind`
      */
    ["com.affine.auth.open.affine"](): string;
    /**
      * `Download app`
      */
    ["com.affine.auth.open.affine.download-app"](): string;
    /**
      * `Try again`
      */
    ["com.affine.auth.open.affine.try-again"](): string;
    /**
      * `Still have problems?`
      */
    ["com.affine.auth.open.affine.still-have-problems"](): string;
    /**
      * `Continue with Browser`
      */
    ["com.affine.auth.open.affine.continue-with-browser"](): string;
    /**
      * `Download Latest Client`
      */
    ["com.affine.auth.open.affine.download-latest-client"](): string;
    /**
      * `Open here instead`
      */
    ["com.affine.auth.open.affine.doc.open-here"](): string;
    /**
      * `Edit settings`
      */
    ["com.affine.auth.open.affine.doc.edit-settings"](): string;
    /**
      * `Requires LocalMind desktop app version 0.18 or later.`
      */
    ["com.affine.auth.open.affine.doc.footer-text"](): string;
    /**
      * `Please set a password of {{min}}-{{max}} characters with both letters and numbers to continue signing up with `
      */
    ["com.affine.auth.page.sent.email.subtitle"](options: Readonly<{
        min: string;
        max: string;
    }>): string;
    /**
      * `Welcome to LocalMind, you're almost there!`
      */
    ["com.affine.auth.page.sent.email.title"](): string;
    /**
      * `Password`
      */
    ["com.affine.auth.password"](): string;
    /**
      * `Invalid password`
      */
    ["com.affine.auth.password.error"](): string;
    /**
      * `Set password failed`
      */
    ["com.affine.auth.password.set-failed"](): string;
    /**
      * `Reset password`
      */
    ["com.affine.auth.reset.password"](): string;
    /**
      * `You will receive an email with a link to reset your password. Please check your inbox.`
      */
    ["com.affine.auth.reset.password.message"](): string;
    /**
      * `Password reset successful`
      */
    ["com.affine.auth.reset.password.page.success"](): string;
    /**
      * `Reset your LocalMind password`
      */
    ["com.affine.auth.reset.password.page.title"](): string;
    /**
      * `Send reset link`
      */
    ["com.affine.auth.send.reset.password.link"](): string;
    /**
      * `Send set link`
      */
    ["com.affine.auth.send.set.password.link"](): string;
    /**
      * `Send verification link`
      */
    ["com.affine.auth.send.verify.email.hint"](): string;
    /**
      * `Verification code`
      */
    ["com.affine.auth.sign.auth.code"](): string;
    /**
      * `Invalid verification code`
      */
    ["com.affine.auth.sign.auth.code.invalid"](): string;
    /**
      * `Continue with code`
      */
    ["com.affine.auth.sign.auth.code.continue"](): string;
    /**
      * `Resend code`
      */
    ["com.affine.auth.sign.auth.code.resend"](): string;
    /**
      * `Resend in {{second}}s`
      */
    ["com.affine.auth.sign.auth.code.resend.hint"](options: {
        readonly second: string;
    }): string;
    /**
      * `Sent`
      */
    ["com.affine.auth.sent"](): string;
    /**
      * `The verification link failed to be sent, please try again later.`
      */
    ["com.affine.auth.sent.change.email.fail"](): string;
    /**
      * `Verification link has been sent.`
      */
    ["com.affine.auth.sent.change.email.hint"](): string;
    /**
      * `Reset password link has been sent.`
      */
    ["com.affine.auth.sent.change.password.hint"](): string;
    /**
      * `Your password has been updated! You can sign in to LocalMind with the new password.`
      */
    ["com.affine.auth.sent.reset.password.success.message"](): string;
    /**
      * `Set password link has been sent.`
      */
    ["com.affine.auth.sent.set.password.hint"](): string;
    /**
      * `Your password has been saved! You can sign in to LocalMind with email and password.`
      */
    ["com.affine.auth.sent.set.password.success.message"](): string;
    /**
      * `Verification link has been sent.`
      */
    ["com.affine.auth.sent.verify.email.hint"](): string;
    /**
      * `Save Email`
      */
    ["com.affine.auth.set.email.save"](): string;
    /**
      * `Set password`
      */
    ["com.affine.auth.set.password"](): string;
    /**
      * `Please set a password of {{min}}-{{max}} characters with both letters and numbers to continue signing up with `
      */
    ["com.affine.auth.set.password.message"](options: Readonly<{
        min: string;
        max: string;
    }>): string;
    /**
      * `Maximum {{max}} characters`
      */
    ["com.affine.auth.set.password.message.maxlength"](options: {
        readonly max: string;
    }): string;
    /**
      * `Minimum {{min}} characters`
      */
    ["com.affine.auth.set.password.message.minlength"](options: {
        readonly min: string;
    }): string;
    /**
      * `Password set successful`
      */
    ["com.affine.auth.set.password.page.success"](): string;
    /**
      * `Set your LocalMind password`
      */
    ["com.affine.auth.set.password.page.title"](): string;
    /**
      * `Set a password at least {{min}} letters long`
      */
    ["com.affine.auth.set.password.placeholder"](options: {
        readonly min: string;
    }): string;
    /**
      * `Confirm password`
      */
    ["com.affine.auth.set.password.placeholder.confirm"](): string;
    /**
      * `Save password`
      */
    ["com.affine.auth.set.password.save"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.auth.sign-out.confirm-modal.cancel"](): string;
    /**
      * `Sign Out`
      */
    ["com.affine.auth.sign-out.confirm-modal.confirm"](): string;
    /**
      * `After signing out, synced workspaces associated with this account will be removed from this device. Signing in again will add them back.`
      */
    ["com.affine.auth.sign-out.confirm-modal.description"](): string;
    /**
      * `Sign out?`
      */
    ["com.affine.auth.sign-out.confirm-modal.title"](): string;
    /**
      * `If you haven't received the email, please check your spam folder.`
      */
    ["com.affine.auth.sign.auth.code.message"](): string;
    /**
      * `Sign in with magic link`
      */
    ["com.affine.auth.sign.auth.code.send-email.sign-in"](): string;
    /**
      * `Terms of conditions`
      */
    ["com.affine.auth.sign.condition"](): string;
    /**
      * `Continue with email`
      */
    ["com.affine.auth.sign.email.continue"](): string;
    /**
      * `Invalid email`
      */
    ["com.affine.auth.sign.email.error"](): string;
    /**
      * `Enter your email address`
      */
    ["com.affine.auth.sign.email.placeholder"](): string;
    /**
      * `Sign in to LocalMind`
      */
    ["com.affine.auth.sign.in"](): string;
    /**
      * `Confirm your email`
      */
    ["com.affine.auth.sign.in.sent.email.subtitle"](): string;
    /**
      * `Self-hosted LocalMind`
      */
    ["com.affine.auth.sign.add-selfhosted.title"](): string;
    /**
      * `Connect to your LocalMind server`
      */
    ["com.affine.auth.sign.add-selfhosted"](): string;
    /**
      * `LocalMind Server URL`
      */
    ["com.affine.auth.sign.add-selfhosted.baseurl"](): string;
    /**
      * `Connect`
      */
    ["com.affine.auth.sign.add-selfhosted.connect-button"](): string;
    /**
      * `Unable to connect to the server.`
      */
    ["com.affine.auth.sign.add-selfhosted.error"](): string;
    /**
      * `Privacy policy`
      */
    ["com.affine.auth.sign.policy"](): string;
    /**
      * `Sign up`
      */
    ["com.affine.auth.sign.up"](): string;
    /**
      * `Create your account`
      */
    ["com.affine.auth.sign.up.sent.email.subtitle"](): string;
    /**
      * `The app will automatically open or redirect to the web version. If you encounter any issues, you can also click the button below to manually open the LocalMind app.`
      */
    ["com.affine.auth.sign.up.success.subtitle"](): string;
    /**
      * `Your account has been created and you're now signed in!`
      */
    ["com.affine.auth.sign.up.success.title"](): string;
    /**
      * `You have successfully signed in. The app will automatically open or redirect to the web version. if you encounter any issues, you can also click the button below to  manually open the LocalMind app.`
      */
    ["com.affine.auth.signed.success.subtitle"](): string;
    /**
      * `You're almost there!`
      */
    ["com.affine.auth.signed.success.title"](): string;
    /**
      * `Server error, please try again later.`
      */
    ["com.affine.auth.toast.message.failed"](): string;
    /**
      * `You have signed in to LocalMind.`
      */
    ["com.affine.auth.toast.message.signed-in"](): string;
    /**
      * `Unable to sign in`
      */
    ["com.affine.auth.toast.title.failed"](): string;
    /**
      * `Signed in`
      */
    ["com.affine.auth.toast.title.signed-in"](): string;
    /**
      * `Your current email is {{email}}. We'll send a verification link to this email so you can confirm it belongs to you.`
      */
    ["com.affine.auth.verify.email.message"](options: {
        readonly email: string;
    }): string;
    /**
      * `Back`
      */
    ["com.affine.backButton"](): string;
    /**
      * `Your workspace is saved in this browser. When disk space is low, the browser may remove it automatically. Enable LocalMind Sync to keep it safer.`
      */
    ["com.affine.banner.local-warning"](): string;
    /**
      * `LocalMind Cloud`
      */
    ["com.affine.brand.affineCloud"](): string;
    /**
      * `Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec`
      */
    ["com.affine.calendar-date-picker.month-names"](): string;
    /**
      * `Today`
      */
    ["com.affine.calendar-date-picker.today"](): string;
    /**
      * `Su,Mo,Tu,We,Th,Fr,Sa`
      */
    ["com.affine.calendar-date-picker.week-days"](): string;
    /**
      * `Host by LocalMind.Pro, Save, sync, and backup all your data.`
      */
    ["com.affine.cloud-scroll-tip.caption"](): string;
    /**
      * `LocalMind Cloud`
      */
    ["com.affine.cloud-scroll-tip.title"](): string;
    /**
      * `Collections`
      */
    ["com.affine.cmdk.affine.category.affine.collections"](): string;
    /**
      * `Create`
      */
    ["com.affine.cmdk.affine.category.affine.creation"](): string;
    /**
      * `Edgeless`
      */
    ["com.affine.cmdk.affine.category.affine.edgeless"](): string;
    /**
      * `General`
      */
    ["com.affine.cmdk.affine.category.affine.general"](): string;
    /**
      * `Help`
      */
    ["com.affine.cmdk.affine.category.affine.help"](): string;
    /**
      * `Layout controls`
      */
    ["com.affine.cmdk.affine.category.affine.layout"](): string;
    /**
      * `Navigation`
      */
    ["com.affine.cmdk.affine.category.affine.navigation"](): string;
    /**
      * `Docs`
      */
    ["com.affine.cmdk.affine.category.affine.pages"](): string;
    /**
      * `Recent`
      */
    ["com.affine.cmdk.affine.category.affine.recent"](): string;
    /**
      * `Settings`
      */
    ["com.affine.cmdk.affine.category.affine.settings"](): string;
    /**
      * `Tags`
      */
    ["com.affine.cmdk.affine.category.affine.tags"](): string;
    /**
      * `Updates`
      */
    ["com.affine.cmdk.affine.category.affine.updates"](): string;
    /**
      * `Edgeless commands`
      */
    ["com.affine.cmdk.affine.category.editor.edgeless"](): string;
    /**
      * `Insert object`
      */
    ["com.affine.cmdk.affine.category.editor.insert-object"](): string;
    /**
      * `Doc Commands`
      */
    ["com.affine.cmdk.affine.category.editor.page"](): string;
    /**
      * `Results`
      */
    ["com.affine.cmdk.affine.category.results"](): string;
    /**
      * `Change client border style to`
      */
    ["com.affine.cmdk.affine.client-border-style.to"](): string;
    /**
      * `Change colour mode to`
      */
    ["com.affine.cmdk.affine.color-mode.to"](): string;
    /**
      * `Contact us`
      */
    ["com.affine.cmdk.affine.contact-us"](): string;
    /**
      * `Create "{{keyWord}}" doc and insert`
      */
    ["com.affine.cmdk.affine.create-new-doc-and-insert"](options: {
        readonly keyWord: string;
    }): string;
    /**
      * `New "{{keyWord}}" edgeless`
      */
    ["com.affine.cmdk.affine.create-new-edgeless-as"](options: {
        readonly keyWord: string;
    }): string;
    /**
      * `New "{{keyWord}}" page`
      */
    ["com.affine.cmdk.affine.create-new-page-as"](options: {
        readonly keyWord: string;
    }): string;
    /**
      * `Change display language to`
      */
    ["com.affine.cmdk.affine.display-language.to"](): string;
    /**
      * `Add to favourites`
      */
    ["com.affine.cmdk.affine.editor.add-to-favourites"](): string;
    /**
      * `Start presentation`
      */
    ["com.affine.cmdk.affine.editor.edgeless.presentation-start"](): string;
    /**
      * `Remove from favourites`
      */
    ["com.affine.cmdk.affine.editor.remove-from-favourites"](): string;
    /**
      * `Restore from trash`
      */
    ["com.affine.cmdk.affine.editor.restore-from-trash"](): string;
    /**
      * `Reveal doc history modal`
      */
    ["com.affine.cmdk.affine.editor.reveal-page-history-modal"](): string;
    /**
      * `This doc has been moved to the trash, you can either restore or permanently delete it.`
      */
    ["com.affine.cmdk.affine.editor.trash-footer-hint"](): string;
    /**
      * `Change font style to`
      */
    ["com.affine.cmdk.affine.font-style.to"](): string;
    /**
      * `Change full width layout to`
      */
    ["com.affine.cmdk.affine.full-width-layout.to"](): string;
    /**
      * `Change default width for new pages in to standard`
      */
    ["com.affine.cmdk.affine.default-page-width-layout.standard"](): string;
    /**
      * `Change default width for new pages in to full width`
      */
    ["com.affine.cmdk.affine.default-page-width-layout.full-width"](): string;
    /**
      * `Change current page width to standard`
      */
    ["com.affine.cmdk.affine.current-page-width-layout.standard"](): string;
    /**
      * `Change current page width to full width`
      */
    ["com.affine.cmdk.affine.current-page-width-layout.full-width"](): string;
    /**
      * `Getting started`
      */
    ["com.affine.cmdk.affine.getting-started"](): string;
    /**
      * `Import workspace`
      */
    ["com.affine.cmdk.affine.import-workspace"](): string;
    /**
      * `Insert this link to the current doc`
      */
    ["com.affine.cmdk.affine.insert-link"](): string;
    /**
      * `Collapse left sidebar`
      */
    ["com.affine.cmdk.affine.left-sidebar.collapse"](): string;
    /**
      * `Expand left sidebar`
      */
    ["com.affine.cmdk.affine.left-sidebar.expand"](): string;
    /**
      * `Go to all docs`
      */
    ["com.affine.cmdk.affine.navigation.goto-all-pages"](): string;
    /**
      * `Go to edgeless list`
      */
    ["com.affine.cmdk.affine.navigation.goto-edgeless-list"](): string;
    /**
      * `Go to page list`
      */
    ["com.affine.cmdk.affine.navigation.goto-page-list"](): string;
    /**
      * `Go to trash`
      */
    ["com.affine.cmdk.affine.navigation.goto-trash"](): string;
    /**
      * `Go to workspace`
      */
    ["com.affine.cmdk.affine.navigation.goto-workspace"](): string;
    /**
      * `Go to account settings`
      */
    ["com.affine.cmdk.affine.navigation.open-account-settings"](): string;
    /**
      * `Go to Settings`
      */
    ["com.affine.cmdk.affine.navigation.open-settings"](): string;
    /**
      * `New edgeless`
      */
    ["com.affine.cmdk.affine.new-edgeless-page"](): string;
    /**
      * `New page`
      */
    ["com.affine.cmdk.affine.new-page"](): string;
    /**
      * `New workspace`
      */
    ["com.affine.cmdk.affine.new-workspace"](): string;
    /**
      * `Change noise background on the sidebar to`
      */
    ["com.affine.cmdk.affine.noise-background-on-the-sidebar.to"](): string;
    /**
      * `Restart to upgrade`
      */
    ["com.affine.cmdk.affine.restart-to-upgrade"](): string;
    /**
      * `OFF`
      */
    ["com.affine.cmdk.affine.switch-state.off"](): string;
    /**
      * `ON`
      */
    ["com.affine.cmdk.affine.switch-state.on"](): string;
    /**
      * `Change translucent UI on the sidebar to`
      */
    ["com.affine.cmdk.affine.translucent-ui-on-the-sidebar.to"](): string;
    /**
      * `What's new`
      */
    ["com.affine.cmdk.affine.whats-new"](): string;
    /**
      * `Search docs or paste link...`
      */
    ["com.affine.cmdk.docs.placeholder"](): string;
    /**
      * `Insert links`
      */
    ["com.affine.cmdk.insert-links"](): string;
    /**
      * `No results found`
      */
    ["com.affine.cmdk.no-results"](): string;
    /**
      * `No results found for`
      */
    ["com.affine.cmdk.no-results-for"](): string;
    /**
      * `Type a command or search anything...`
      */
    ["com.affine.cmdk.placeholder"](): string;
    /**
      * `Switch to $t(com.affine.edgelessMode)`
      */
    ["com.affine.cmdk.switch-to-edgeless"](): string;
    /**
      * `Switch to $t(com.affine.pageMode)`
      */
    ["com.affine.cmdk.switch-to-page"](): string;
    /**
      * `Delete`
      */
    ["com.affine.collection-bar.action.tooltip.delete"](): string;
    /**
      * `Edit`
      */
    ["com.affine.collection-bar.action.tooltip.edit"](): string;
    /**
      * `Pin to sidebar`
      */
    ["com.affine.collection-bar.action.tooltip.pin"](): string;
    /**
      * `Unpin`
      */
    ["com.affine.collection-bar.action.tooltip.unpin"](): string;
    /**
      * `Do you want to add a document to the current collection? If it is filtered based on rules, this will add a set of included rules.`
      */
    ["com.affine.collection.add-doc.confirm.description"](): string;
    /**
      * `Add new doc to this collection`
      */
    ["com.affine.collection.add-doc.confirm.title"](): string;
    /**
      * `Doc already exists`
      */
    ["com.affine.collection.addPage.alreadyExists"](): string;
    /**
      * `Added successfully`
      */
    ["com.affine.collection.addPage.success"](): string;
    /**
      * `Add docs`
      */
    ["com.affine.collection.addPages"](): string;
    /**
      * `Add rules`
      */
    ["com.affine.collection.addRules"](): string;
    /**
      * `All collections`
      */
    ["com.affine.collection.allCollections"](): string;
    /**
      * `Empty collection`
      */
    ["com.affine.collection.emptyCollection"](): string;
    /**
      * `Collection is a smart folder where you can manually add docs or automatically add docs through rules.`
      */
    ["com.affine.collection.emptyCollectionDescription"](): string;
    /**
      * `HELP INFO`
      */
    ["com.affine.collection.helpInfo"](): string;
    /**
      * `Edit collection`
      */
    ["com.affine.collection.menu.edit"](): string;
    /**
      * `Rename`
      */
    ["com.affine.collection.menu.rename"](): string;
    /**
      * `Removed successfully`
      */
    ["com.affine.collection.removePage.success"](): string;
    /**
      * `No collections`
      */
    ["com.affine.collections.empty.message"](): string;
    /**
      * `New collection`
      */
    ["com.affine.collections.empty.new-collection-button"](): string;
    /**
      * `Collections`
      */
    ["com.affine.collections.header"](): string;
    /**
      * `Couldn't copy image`
      */
    ["com.affine.copy.asImage.notAvailable.title"](): string;
    /**
      * `The 'Copy as image' feature is only available on our desktop app. Please download and install the client to access this feature.`
      */
    ["com.affine.copy.asImage.notAvailable.message"](): string;
    /**
      * `Download Client`
      */
    ["com.affine.copy.asImage.notAvailable.action"](): string;
    /**
      * `Image copied`
      */
    ["com.affine.copy.asImage.success"](): string;
    /**
      * `Image copy failed`
      */
    ["com.affine.copy.asImage.failed"](): string;
    /**
      * `Copy as Markdown`
      */
    ["com.affine.export.copy-markdown"](): string;
    /**
      * `Copied as Markdown`
      */
    ["com.affine.export.copied-as-markdown"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.confirmModal.button.cancel"](): string;
    /**
      * `Ok`
      */
    ["com.affine.confirmModal.button.ok"](): string;
    /**
      * `Current year`
      */
    ["com.affine.currentYear"](): string;
    /**
      * `Deleting {{count}} tags cannot be undone, please proceed with caution.`
      */
    ["com.affine.delete-tags.confirm.multi-tag-description"](options: {
        readonly count: string;
    }): string;
    /**
      * `Delete tag?`
      */
    ["com.affine.delete-tags.confirm.title"](): string;
    /**
      * `{{count}} tag deleted`

      * - com.affine.delete-tags.count_one: `{{count}} tag deleted`

      * - com.affine.delete-tags.count_other: `{{count}} tags deleted`
      */
    ["com.affine.delete-tags.count"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} tag deleted`
      */
    ["com.affine.delete-tags.count_one"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} tags deleted`
      */
    ["com.affine.delete-tags.count_other"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Delete workspace from this device and optionally delete all data.`
      */
    ["com.affine.deleteLeaveWorkspace.description"](): string;
    /**
      * `Leave workspace`
      */
    ["com.affine.deleteLeaveWorkspace.leave"](): string;
    /**
      * `After you leave, you will not be able to access content within this workspace.`
      */
    ["com.affine.deleteLeaveWorkspace.leaveDescription"](): string;
    /**
      * `Docs`
      */
    ["com.affine.docs.header"](): string;
    /**
      * `Draw with a blank whiteboard`
      */
    ["com.affine.draw_with_a_blank_whiteboard"](): string;
    /**
      * `Earlier`
      */
    ["com.affine.earlier"](): string;
    /**
      * `Edgeless mode`
      */
    ["com.affine.edgelessMode"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.editCollection.button.cancel"](): string;
    /**
      * `Create`
      */
    ["com.affine.editCollection.button.create"](): string;
    /**
      * `Create collection`
      */
    ["com.affine.editCollection.createCollection"](): string;
    /**
      * `Filters`
      */
    ["com.affine.editCollection.filters"](): string;
    /**
      * `Docs`
      */
    ["com.affine.editCollection.pages"](): string;
    /**
      * `Clear selected`
      */
    ["com.affine.editCollection.pages.clear"](): string;
    /**
      * `Rename collection`
      */
    ["com.affine.editCollection.renameCollection"](): string;
    /**
      * `Rules`
      */
    ["com.affine.editCollection.rules"](): string;
    /**
      * `No results`
      */
    ["com.affine.editCollection.rules.empty.noResults"](): string;
    /**
      * `No docs meet the filtering rules`
      */
    ["com.affine.editCollection.rules.empty.noResults.tips"](): string;
    /**
      * `No rules`
      */
    ["com.affine.editCollection.rules.empty.noRules"](): string;
    /**
      * `Add selected doc`
      */
    ["com.affine.editCollection.rules.include.add"](): string;
    /**
      * `is`
      */
    ["com.affine.editCollection.rules.include.is"](): string;
    /**
      * `is-not`
      */
    ["com.affine.editCollection.rules.include.is-not"](): string;
    /**
      * `Doc`
      */
    ["com.affine.editCollection.rules.include.page"](): string;
    /**
      * `“Selected docs” refers to manually adding docs rather than automatically adding them through rule matching. You can manually add docs through the “Add selected docs” option or by dragging and dropping.`
      */
    ["com.affine.editCollection.rules.include.tips"](): string;
    /**
      * `What is "Selected docs"？`
      */
    ["com.affine.editCollection.rules.include.tipsTitle"](): string;
    /**
      * `Selected docs`
      */
    ["com.affine.editCollection.rules.include.title"](): string;
    /**
      * `Preview`
      */
    ["com.affine.editCollection.rules.preview"](): string;
    /**
      * `Reset`
      */
    ["com.affine.editCollection.rules.reset"](): string;
    /**
      * `automatically`
      */
    ["com.affine.editCollection.rules.tips.highlight"](): string;
    /**
      * `Save`
      */
    ["com.affine.editCollection.save"](): string;
    /**
      * `Save as new collection`
      */
    ["com.affine.editCollection.saveCollection"](): string;
    /**
      * `Search doc...`
      */
    ["com.affine.editCollection.search.placeholder"](): string;
    /**
      * `Untitled collection`
      */
    ["com.affine.editCollection.untitledCollection"](): string;
    /**
      * `Update collection`
      */
    ["com.affine.editCollection.updateCollection"](): string;
    /**
      * `Collection is a smart folder where you can manually add docs or automatically add docs through rules.`
      */
    ["com.affine.editCollectionName.createTips"](): string;
    /**
      * `Name`
      */
    ["com.affine.editCollectionName.name"](): string;
    /**
      * `Collection name`
      */
    ["com.affine.editCollectionName.name.placeholder"](): string;
    /**
      * `Default to Edgeless mode`
      */
    ["com.affine.editorDefaultMode.edgeless"](): string;
    /**
      * `Default to Page mode`
      */
    ["com.affine.editorDefaultMode.page"](): string;
    /**
      * `Add docs`
      */
    ["com.affine.empty.collection-detail.action.add-doc"](): string;
    /**
      * `Add rules`
      */
    ["com.affine.empty.collection-detail.action.add-rule"](): string;
    /**
      * `Collection is a smart folder where you can manually add docs or automatically add docs through rules.`
      */
    ["com.affine.empty.collection-detail.description"](): string;
    /**
      * `Empty collection`
      */
    ["com.affine.empty.collection-detail.title"](): string;
    /**
      * `Add collection`
      */
    ["com.affine.empty.collections.action.new-collection"](): string;
    /**
      * `Create your first collection here.`
      */
    ["com.affine.empty.collections.description"](): string;
    /**
      * `Collection management`
      */
    ["com.affine.empty.collections.title"](): string;
    /**
      * `New doc`
      */
    ["com.affine.empty.docs.action.new-doc"](): string;
    /**
      * `Create your first doc here.`
      */
    ["com.affine.empty.docs.all-description"](): string;
    /**
      * `Docs management`
      */
    ["com.affine.empty.docs.title"](): string;
    /**
      * `Deleted docs will appear here.`
      */
    ["com.affine.empty.docs.trash-description"](): string;
    /**
      * `Create a new tag for your documents.`
      */
    ["com.affine.empty.tags.description"](): string;
    /**
      * `Tag management`
      */
    ["com.affine.empty.tags.title"](): string;
    /**
      * `There's no doc here yet`
      */
    ["com.affine.emptyDesc"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.enableAffineCloudModal.button.cancel"](): string;
    /**
      * `Enable LocalMind Sync for {{workspaceName}}`
      */
    ["com.affine.enableAffineCloudModal.custom-server.title"](options: {
        readonly workspaceName: string;
    }): string;
    /**
      * `Choose where this workspace will sync.`
      */
    ["com.affine.enableAffineCloudModal.custom-server.description"](): string;
    /**
      * `Enable LocalMind Sync`
      */
    ["com.affine.enableAffineCloudModal.custom-server.enable"](): string;
    /**
      * `Hide error`
      */
    ["com.affine.error.hide-error"](): string;
    /**
      * `Doc content is missing`
      */
    ["com.affine.error.no-page-root.title"](): string;
    /**
      * `It takes longer to load the doc content.`
      */
    ["com.affine.error.loading-timeout-error"](): string;
    /**
      * `Refetch`
      */
    ["com.affine.error.refetch"](): string;
    /**
      * `Reload LocalMind`
      */
    ["com.affine.error.reload"](): string;
    /**
      * `Refresh`
      */
    ["com.affine.error.retry"](): string;
    /**
      * `Something is wrong...`
      */
    ["com.affine.error.unexpected-error.title"](): string;
    /**
      * `Please request a new reset password link.`
      */
    ["com.affine.expired.page.subtitle"](): string;
    /**
      * `Please request a new link.`
      */
    ["com.affine.expired.page.new-subtitle"](): string;
    /**
      * `This link has expired...`
      */
    ["com.affine.expired.page.title"](): string;
    /**
      * `Please try it again later.`
      */
    ["com.affine.export.error.message"](): string;
    /**
      * `Export failed due to an unexpected error`
      */
    ["com.affine.export.error.title"](): string;
    /**
      * `Print`
      */
    ["com.affine.export.print"](): string;
    /**
      * `Please open the download folder to check.`
      */
    ["com.affine.export.success.message"](): string;
    /**
      * `Exported successfully`
      */
    ["com.affine.export.success.title"](): string;
    /**
      * `Add to favourites`
      */
    ["com.affine.favoritePageOperation.add"](): string;
    /**
      * `Remove from favourites`
      */
    ["com.affine.favoritePageOperation.remove"](): string;
    /**
      * `Filter`
      */
    ["com.affine.filter"](): string;
    /**
      * `Add Filter Rule`
      */
    ["com.affine.filter.add-filter"](): string;
    /**
      * `after`
      */
    ["com.affine.filter.after"](): string;
    /**
      * `before`
      */
    ["com.affine.filter.before"](): string;
    /**
      * `contains all`
      */
    ["com.affine.filter.contains all"](): string;
    /**
      * `contains one of`
      */
    ["com.affine.filter.contains one of"](): string;
    /**
      * `does not contains all`
      */
    ["com.affine.filter.does not contains all"](): string;
    /**
      * `does not contains one of`
      */
    ["com.affine.filter.does not contains one of"](): string;
    /**
      * `Empty`
      */
    ["com.affine.filter.empty-tag"](): string;
    /**
      * `Empty`
      */
    ["com.affine.filter.empty"](): string;
    /**
      * `false`
      */
    ["com.affine.filter.false"](): string;
    /**
      * `is`
      */
    ["com.affine.filter.is"](): string;
    /**
      * `is empty`
      */
    ["com.affine.filter.is empty"](): string;
    /**
      * `is not empty`
      */
    ["com.affine.filter.is not empty"](): string;
    /**
      * `Favourited`
      */
    ["com.affine.filter.is-favourited"](): string;
    /**
      * `Shared`
      */
    ["com.affine.filter.is-public"](): string;
    /**
      * `between`
      */
    ["com.affine.filter.between"](): string;
    /**
      * `last 3 days`
      */
    ["com.affine.filter.last 3 days"](): string;
    /**
      * `last 7 days`
      */
    ["com.affine.filter.last 7 days"](): string;
    /**
      * `last 15 days`
      */
    ["com.affine.filter.last 15 days"](): string;
    /**
      * `last 30 days`
      */
    ["com.affine.filter.last 30 days"](): string;
    /**
      * `this week`
      */
    ["com.affine.filter.this week"](): string;
    /**
      * `this month`
      */
    ["com.affine.filter.this month"](): string;
    /**
      * `this quarter`
      */
    ["com.affine.filter.this quarter"](): string;
    /**
      * `this year`
      */
    ["com.affine.filter.this year"](): string;
    /**
      * `last`
      */
    ["com.affine.filter.last"](): string;
    /**
      * `Save view`
      */
    ["com.affine.filter.save-view"](): string;
    /**
      * `true`
      */
    ["com.affine.filter.true"](): string;
    /**
      * `Add filter`
      */
    ["com.affine.filterList.button.add"](): string;
    /**
      * `Display`
      */
    ["com.affine.explorer.display-menu.button"](): string;
    /**
      * `Grouping`
      */
    ["com.affine.explorer.display-menu.grouping"](): string;
    /**
      * `Remove group`
      */
    ["com.affine.explorer.display-menu.grouping.remove"](): string;
    /**
      * `Ordering`
      */
    ["com.affine.explorer.display-menu.ordering"](): string;
    /**
      * `View in Page mode`
      */
    ["com.affine.header.mode-switch.page"](): string;
    /**
      * `View in Edgeless Canvas`
      */
    ["com.affine.header.mode-switch.edgeless"](): string;
    /**
      * `Add tag`
      */
    ["com.affine.header.option.add-tag"](): string;
    /**
      * `Duplicate`
      */
    ["com.affine.header.option.duplicate"](): string;
    /**
      * `Open in desktop app`
      */
    ["com.affine.header.option.open-in-desktop"](): string;
    /**
      * `View all frames`
      */
    ["com.affine.header.option.view-frame"](): string;
    /**
      * `View table of contents`
      */
    ["com.affine.header.option.view-toc"](): string;
    /**
      * `Table of contents`
      */
    ["com.affine.header.menu.toc"](): string;
    /**
      * `Contact us`
      */
    ["com.affine.helpIsland.contactUs"](): string;
    /**
      * `Getting started`
      */
    ["com.affine.helpIsland.gettingStarted"](): string;
    /**
      * `Help and feedback`
      */
    ["com.affine.helpIsland.helpAndFeedback"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.history-vision.tips-modal.cancel"](): string;
    /**
      * `Enable LocalMind Sync`
      */
    ["com.affine.history-vision.tips-modal.confirm"](): string;
    /**
      * `Version history can't work with local workspace. Enable LocalMind Sync for this workspace to use version history.`
      */
    ["com.affine.history-vision.tips-modal.description"](): string;
    /**
      * `Version history needs LocalMind Sync`
      */
    ["com.affine.history-vision.tips-modal.title"](): string;
    /**
      * `Back to doc`
      */
    ["com.affine.history.back-to-page"](): string;
    /**
      * `You are about to restore the current version of the doc to the latest version available. This action will overwrite any changes made prior to the latest version.`
      */
    ["com.affine.history.confirm-restore-modal.hint"](): string;
    /**
      * `Load more`
      */
    ["com.affine.history.confirm-restore-modal.load-more"](): string;
    /**
      * `LIMITED DOC HISTORY`
      */
    ["com.affine.history.confirm-restore-modal.plan-prompt.limited-title"](): string;
    /**
      * `HELP INFO`
      */
    ["com.affine.history.confirm-restore-modal.plan-prompt.title"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.history.confirm-restore-modal.pro-plan-prompt.upgrade"](): string;
    /**
      * `Restore`
      */
    ["com.affine.history.confirm-restore-modal.restore"](): string;
    /**
      * `This document is such a spring chicken, it hasn't sprouted a single historical sprig yet!`
      */
    ["com.affine.history.empty-prompt.description"](): string;
    /**
      * `Empty`
      */
    ["com.affine.history.empty-prompt.title"](): string;
    /**
      * `Restore current version`
      */
    ["com.affine.history.restore-current-version"](): string;
    /**
      * `Version history`
      */
    ["com.affine.history.version-history"](): string;
    /**
      * `View history version`
      */
    ["com.affine.history.view-history-version"](): string;
    /**
      * `Create into a New Workspace`
      */
    ["com.affine.import-template.dialog.createDocToNewWorkspace"](): string;
    /**
      * `Create doc to "{{workspace}}"`
      */
    ["com.affine.import-template.dialog.createDocToWorkspace"](options: {
        readonly workspace: string;
    }): string;
    /**
      * `Create doc with "{{templateName}}" template`
      */
    ["com.affine.import-template.dialog.createDocWithTemplate"](options: {
        readonly templateName: string;
    }): string;
    /**
      * `Failed to import template, please try again.`
      */
    ["com.affine.import-template.dialog.errorImport"](): string;
    /**
      * `Failed to load template, please try again.`
      */
    ["com.affine.import-template.dialog.errorLoad"](): string;
    /**
      * `Create into a New Workspace`
      */
    ["com.affine.import-clipper.dialog.createDocToNewWorkspace"](): string;
    /**
      * `Create doc to "{{workspace}}"`
      */
    ["com.affine.import-clipper.dialog.createDocToWorkspace"](options: {
        readonly workspace: string;
    }): string;
    /**
      * `Create doc from Web Clipper`
      */
    ["com.affine.import-clipper.dialog.createDocFromClipper"](): string;
    /**
      * `Failed to import content, please try again.`
      */
    ["com.affine.import-clipper.dialog.errorImport"](): string;
    /**
      * `Failed to load content, please try again.`
      */
    ["com.affine.import-clipper.dialog.errorLoad"](): string;
    /**
      * `Support Markdown/Notion`
      */
    ["com.affine.import_file"](): string;
    /**
      * `LocalMind workspace data`
      */
    ["com.affine.import.affine-workspace-data"](): string;
    /**
      * `Bear (.bear2bk) (Experimental)`
      */
    ["com.affine.import.bear"](): string;
    /**
      * `Import your Bear note backup. Tags will be converted to LocalMind tags and folders.`
      */
    ["com.affine.import.bear.tooltip"](): string;
    /**
      * `Docx`
      */
    ["com.affine.import.docx"](): string;
    /**
      * `Convert a .docx file into an editable LocalMind page. Complex Word layout may not be preserved.`
      */
    ["com.affine.import.docx.tooltip"](): string;
    /**
      * `HTML`
      */
    ["com.affine.import.html-files"](): string;
    /**
      * `This is an experimental feature that is not perfect and may cause your data to be missing after import.`
      */
    ["com.affine.import.html-files.tooltip"](): string;
    /**
      * `Markdown files (.md)`
      */
    ["com.affine.import.markdown-files"](): string;
    /**
      * `Markdown with media files (.zip)`
      */
    ["com.affine.import.markdown-with-media-files"](): string;
    /**
      * `Please upload a markdown zip file with attachments, experimental function, there may be data loss.`
      */
    ["com.affine.import.markdown-with-media-files.tooltip"](): string;
    /**
      * `If you'd like to request support for additional file types, feel free to let us know on`
      */
    ["com.affine.import.modal.tip"](): string;
    /**
      * `Notion (Experimental)`
      */
    ["com.affine.import.notion"](): string;
    /**
      * `Import your Notion data. Supported import formats: HTML with subpages.`
      */
    ["com.affine.import.notion.tooltip"](): string;
    /**
      * `OneNote (Experimental)`
      */
    ["com.affine.import.onenote"](): string;
    /**
      * `Import a OneNote .one, .onetoc2, or .onepkg file. Available in the desktop app.`
      */
    ["com.affine.import.onenote.tooltip"](): string;
    /**
      * `This format importer is available in the LocalMind desktop app.`
      */
    ["com.affine.import.onenote.desktop-only"](): string;
    /**
      * `PDF document (.pdf)`
      */
    ["com.affine.import.pdf"](): string;
    /**
      * `The OCR service is busy. Wait a moment and retry the import.`
      */
    ["com.affine.import.pdf.ocr-busy"](): string;
    /**
      * `Scanned PDF OCR is not enabled on this LocalMind server. Ask an administrator to enable the server-controlled OCR integration.`
      */
    ["com.affine.import.pdf.ocr-disabled"](): string;
    /**
      * `OCR did not detect readable text in this PDF.`
      */
    ["com.affine.import.pdf.ocr-empty-result"](): string;
    /**
      * `A scanned PDF page was too large for the configured OCR service.`
      */
    ["com.affine.import.pdf.ocr-image-too-large"](): string;
    /**
      * `The LocalMind OCR integration is misconfigured. Ask an administrator to check the OCR URL and allowed host.`
      */
    ["com.affine.import.pdf.ocr-invalid-config"](): string;
    /**
      * `A scanned PDF page could not be converted into a supported OCR image.`
      */
    ["com.affine.import.pdf.ocr-invalid-image"](): string;
    /**
      * `The OCR service returned an invalid or oversized result. Retry, or ask an administrator to inspect the service.`
      */
    ["com.affine.import.pdf.ocr-invalid-response"](): string;
    /**
      * `This PDF contains too many scanned pages for one import. Split it into files of 100 scanned pages or fewer.`
      */
    ["com.affine.import.pdf.ocr-page-limit"](): string;
    /**
      * `OCR converted pages {{pages}}. Review the imported text, tables, and formulas for recognition errors.`
      */
    ["com.affine.import.pdf.ocr-pages-converted"](options: {
        readonly pages: string;
    }): string;
    /**
      * `Pages {{pages}} could not be recognized and were omitted from the imported page.`
      */
    ["com.affine.import.pdf.ocr-pages-failed"](options: {
        readonly pages: string;
    }): string;
    /**
      * `The configured OCR service rejected the request. Retry, or ask an administrator to check its credentials and model.`
      */
    ["com.affine.import.pdf.ocr-rejected"](): string;
    /**
      * `This PDF has no extractable text layer. OCR is required before it can be converted into an editable LocalMind page.`
      */
    ["com.affine.import.pdf.ocr-required"](): string;
    /**
      * `OCR took too long to process a scanned page. Retry the import.`
      */
    ["com.affine.import.pdf.ocr-timeout"](): string;
    /**
      * `The configured OCR service could not be reached. Check the network or ask an administrator to verify the integration.`
      */
    ["com.affine.import.pdf.ocr-unavailable"](): string;
    /**
      * `Convert PDF content into an editable LocalMind page. Scanned pages are sent to the administrator-configured OCR service; layout may change.`
      */
    ["com.affine.import.pdf.tooltip"](): string;
    /**
      * `Microsoft PowerPoint (.pptx)`
      */
    ["com.affine.import.pptx"](): string;
    /**
      * `Convert slide text and tables into an editable LocalMind page. Themes, animation, and media may not be preserved.`
      */
    ["com.affine.import.pptx.tooltip"](): string;
    /**
      * `Obsidian Vault (Experimental)`
      */
    ["com.affine.import.obsidian"](): string;
    /**
      * `Import an Obsidian vault. Select a folder to import all notes, images, and assets with wikilinks resolved.`
      */
    ["com.affine.import.obsidian.tooltip"](): string;
    /**
      * `Snapshot`
      */
    ["com.affine.import.snapshot"](): string;
    /**
      * `Import your LocalMind workspace and page snapshot file.`
      */
    ["com.affine.import.snapshot.tooltip"](): string;
    /**
      * `Microsoft Excel (.xlsx)`
      */
    ["com.affine.import.xlsx"](): string;
    /**
      * `Convert worksheets into editable LocalMind tables. Charts, macros, and formula behavior may not be preserved.`
      */
    ["com.affine.import.xlsx.tooltip"](): string;
    /**
      * `LocalMind backup`
      */
    ["com.affine.import.dotaffinefile"](): string;
    /**
      * `Import your LocalMind backup file`
      */
    ["com.affine.import.dotaffinefile.tooltip"](): string;
    /**
      * `Import failed, please try again.`
      */
    ["com.affine.import.status.failed.message"](): string;
    /**
      * `No file selected`
      */
    ["com.affine.import.status.failed.message.no-file-selected"](): string;
    /**
      * `Import failure`
      */
    ["com.affine.import.status.failed.title"](): string;
    /**
      * `Importing your workspace data, please wait patiently.`
      */
    ["com.affine.import.status.importing.message"](): string;
    /**
      * `Importing...`
      */
    ["com.affine.import.status.importing.title"](): string;
    /**
      * `Your document has been imported successfully, thank you for choosing LocalMind. Any questions please feel free to feedback to us`
      */
    ["com.affine.import.status.success.message"](): string;
    /**
      * `Import completed`
      */
    ["com.affine.import.status.success.title"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.inviteModal.button.cancel"](): string;
    /**
      * `Maybe later`
      */
    ["com.affine.issue-feedback.cancel"](): string;
    /**
      * `Create issue on GitHub`
      */
    ["com.affine.issue-feedback.confirm"](): string;
    /**
      * `Got feedback? We're all ears! Create an issue on GitHub to let us know your thoughts and suggestions`
      */
    ["com.affine.issue-feedback.description"](): string;
    /**
      * `Share your feedback on GitHub`
      */
    ["com.affine.issue-feedback.title"](): string;
    /**
      * `Journals`
      */
    ["com.affine.journal.app-sidebar-title"](): string;
    /**
      * `{{count}} more articles`
      */
    ["com.affine.journal.conflict-show-more"](options: {
        readonly count: string;
    }): string;
    /**
      * `Created`
      */
    ["com.affine.journal.created-today"](): string;
    /**
      * `You haven't created anything yet`
      */
    ["com.affine.journal.daily-count-created-empty-tips"](): string;
    /**
      * `You haven't updated anything yet`
      */
    ["com.affine.journal.daily-count-updated-empty-tips"](): string;
    /**
      * `Updated`
      */
    ["com.affine.journal.updated-today"](): string;
    /**
      * `No Journal`
      */
    ["com.affine.journal.placeholder.title"](): string;
    /**
      * `Create Daily Journal`
      */
    ["com.affine.journal.placeholder.create"](): string;
    /**
      * `Just now`
      */
    ["com.affine.just-now"](): string;
    /**
      * `Align center`
      */
    ["com.affine.keyboardShortcuts.alignCenter"](): string;
    /**
      * `Align left`
      */
    ["com.affine.keyboardShortcuts.alignLeft"](): string;
    /**
      * `Align right`
      */
    ["com.affine.keyboardShortcuts.alignRight"](): string;
    /**
      * `Append to daily note`
      */
    ["com.affine.keyboardShortcuts.appendDailyNote"](): string;
    /**
      * `Body text`
      */
    ["com.affine.keyboardShortcuts.bodyText"](): string;
    /**
      * `Bold`
      */
    ["com.affine.keyboardShortcuts.bold"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.keyboardShortcuts.cancel"](): string;
    /**
      * `Code block`
      */
    ["com.affine.keyboardShortcuts.codeBlock"](): string;
    /**
      * `Copy private link`
      */
    ["com.affine.keyboardShortcuts.copy-private-link"](): string;
    /**
      * `Connector`
      */
    ["com.affine.keyboardShortcuts.connector"](): string;
    /**
      * `Divider`
      */
    ["com.affine.keyboardShortcuts.divider"](): string;
    /**
      * `Expand/collapse sidebar`
      */
    ["com.affine.keyboardShortcuts.expandOrCollapseSidebar"](): string;
    /**
      * `Go back`
      */
    ["com.affine.keyboardShortcuts.goBack"](): string;
    /**
      * `Go forward`
      */
    ["com.affine.keyboardShortcuts.goForward"](): string;
    /**
      * `Group`
      */
    ["com.affine.keyboardShortcuts.group"](): string;
    /**
      * `Group as database`
      */
    ["com.affine.keyboardShortcuts.groupDatabase"](): string;
    /**
      * `Hand`
      */
    ["com.affine.keyboardShortcuts.hand"](): string;
    /**
      * `Heading {{number}}`
      */
    ["com.affine.keyboardShortcuts.heading"](options: {
        readonly number: string;
    }): string;
    /**
      * `Image`
      */
    ["com.affine.keyboardShortcuts.image"](): string;
    /**
      * `Increase indent`
      */
    ["com.affine.keyboardShortcuts.increaseIndent"](): string;
    /**
      * `Inline code`
      */
    ["com.affine.keyboardShortcuts.inlineCode"](): string;
    /**
      * `Italic`
      */
    ["com.affine.keyboardShortcuts.italic"](): string;
    /**
      * `Hyperlink (with selected text)`
      */
    ["com.affine.keyboardShortcuts.link"](): string;
    /**
      * `Move down`
      */
    ["com.affine.keyboardShortcuts.moveDown"](): string;
    /**
      * `Move up`
      */
    ["com.affine.keyboardShortcuts.moveUp"](): string;
    /**
      * `New doc`
      */
    ["com.affine.keyboardShortcuts.newPage"](): string;
    /**
      * `Note`
      */
    ["com.affine.keyboardShortcuts.note"](): string;
    /**
      * `Pen`
      */
    ["com.affine.keyboardShortcuts.pen"](): string;
    /**
      * `Quick search`
      */
    ["com.affine.keyboardShortcuts.quickSearch"](): string;
    /**
      * `Redo`
      */
    ["com.affine.keyboardShortcuts.redo"](): string;
    /**
      * `Reduce indent`
      */
    ["com.affine.keyboardShortcuts.reduceIndent"](): string;
    /**
      * `Select`
      */
    ["com.affine.keyboardShortcuts.select"](): string;
    /**
      * `Select all`
      */
    ["com.affine.keyboardShortcuts.selectAll"](): string;
    /**
      * `Shape`
      */
    ["com.affine.keyboardShortcuts.shape"](): string;
    /**
      * `Strikethrough`
      */
    ["com.affine.keyboardShortcuts.strikethrough"](): string;
    /**
      * `Check keyboard shortcuts quickly`
      */
    ["com.affine.keyboardShortcuts.subtitle"](): string;
    /**
      * `Switch view`
      */
    ["com.affine.keyboardShortcuts.switch"](): string;
    /**
      * `Text`
      */
    ["com.affine.keyboardShortcuts.text"](): string;
    /**
      * `Keyboard shortcuts`
      */
    ["com.affine.keyboardShortcuts.title"](): string;
    /**
      * `Ungroup`
      */
    ["com.affine.keyboardShortcuts.unGroup"](): string;
    /**
      * `Underline`
      */
    ["com.affine.keyboardShortcuts.underline"](): string;
    /**
      * `Undo`
      */
    ["com.affine.keyboardShortcuts.undo"](): string;
    /**
      * `Zoom in`
      */
    ["com.affine.keyboardShortcuts.zoomIn"](): string;
    /**
      * `Zoom out`
      */
    ["com.affine.keyboardShortcuts.zoomOut"](): string;
    /**
      * `Zoom to 100%`
      */
    ["com.affine.keyboardShortcuts.zoomTo100"](): string;
    /**
      * `Zoom to fit`
      */
    ["com.affine.keyboardShortcuts.zoomToFit"](): string;
    /**
      * `Zoom to selection`
      */
    ["com.affine.keyboardShortcuts.zoomToSelection"](): string;
    /**
      * `Last 30 days`
      */
    ["com.affine.last30Days"](): string;
    /**
      * `Last 7 days`
      */
    ["com.affine.last7Days"](): string;
    /**
      * `Last month`
      */
    ["com.affine.lastMonth"](): string;
    /**
      * `Last week`
      */
    ["com.affine.lastWeek"](): string;
    /**
      * `Last year`
      */
    ["com.affine.lastYear"](): string;
    /**
      * `Loading`
      */
    ["com.affine.loading"](): string;
    /**
      * `Loading document content, please wait a moment.`
      */
    ["com.affine.loading.description"](): string;
    /**
      * `Rename`
      */
    ["com.affine.menu.rename"](): string;
    /**
      * `No results found`
      */
    ["com.affine.mobile.search.empty"](): string;
    /**
      * `App version`
      */
    ["com.affine.mobile.setting.about.appVersion"](): string;
    /**
      * `Editor version`
      */
    ["com.affine.mobile.setting.about.editorVersion"](): string;
    /**
      * `About`
      */
    ["com.affine.mobile.setting.about.title"](): string;
    /**
      * `Font style`
      */
    ["com.affine.mobile.setting.appearance.font"](): string;
    /**
      * `Display language`
      */
    ["com.affine.mobile.setting.appearance.language"](): string;
    /**
      * `Color mode`
      */
    ["com.affine.mobile.setting.appearance.theme"](): string;
    /**
      * `Appearance`
      */
    ["com.affine.mobile.setting.appearance.title"](): string;
    /**
      * `Settings`
      */
    ["com.affine.mobile.setting.header-title"](): string;
    /**
      * `Star us on GitHub`
      */
    ["com.affine.mobile.setting.others.github"](): string;
    /**
      * `Discord Group`
      */
    ["com.affine.mobile.setting.others.discord"](): string;
    /**
      * `Privacy`
      */
    ["com.affine.mobile.setting.others.privacy"](): string;
    /**
      * `Terms of use`
      */
    ["com.affine.mobile.setting.others.terms"](): string;
    /**
      * `Privacy & others`
      */
    ["com.affine.mobile.setting.others.title"](): string;
    /**
      * `Official website`
      */
    ["com.affine.mobile.setting.others.website"](): string;
    /**
      * `Delete my account`
      */
    ["com.affine.mobile.setting.others.delete-account"](): string;
    /**
      * `Want to keep data local?`
      */
    ["com.affine.mobile.sign-in.skip.hint"](): string;
    /**
      * `Start LocalMind without an account`
      */
    ["com.affine.mobile.sign-in.skip.link"](): string;
    /**
      * `Older than a month`
      */
    ["com.affine.moreThan30Days"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.moveToTrash.confirmModal.cancel"](): string;
    /**
      * `Delete`
      */
    ["com.affine.moveToTrash.confirmModal.confirm"](): string;
    /**
      * `{{title}} will be moved to trash`
      */
    ["com.affine.moveToTrash.confirmModal.description"](options: {
        readonly title: string;
    }): string;
    /**
      * `{{ number }} docs will be moved to Trash`
      */
    ["com.affine.moveToTrash.confirmModal.description.multiple"](options: {
        readonly number: string;
    }): string;
    /**
      * `Delete doc?`
      */
    ["com.affine.moveToTrash.confirmModal.title"](): string;
    /**
      * `Delete {{ number }} docs?`
      */
    ["com.affine.moveToTrash.confirmModal.title.multiple"](options: {
        readonly number: string;
    }): string;
    /**
      * `Move to trash`
      */
    ["com.affine.moveToTrash.title"](): string;
    /**
      * `New tab`
      */
    ["com.affine.multi-tab.new-tab"](): string;
    /**
      * `LocalMind Sync keeps your workspace backed up, available across devices, and ready for collaboration and publishing.`
      */
    ["com.affine.nameWorkspace.affine-cloud.description"](): string;
    /**
      * `Sync across devices with LocalMind Sync`
      */
    ["com.affine.nameWorkspace.affine-cloud.title"](): string;
    /**
      * `In the web app, workspaces are saved in this browser. If disk space runs low, the browser may remove them automatically. For fully local storage, use the desktop app.`
      */
    ["com.affine.nameWorkspace.affine-cloud.web-tips"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.nameWorkspace.button.cancel"](): string;
    /**
      * `Create`
      */
    ["com.affine.nameWorkspace.button.create"](): string;
    /**
      * `A workspace is your virtual space to capture, create and plan as just one person or together as a team.`
      */
    ["com.affine.nameWorkspace.description"](): string;
    /**
      * `Set a workspace name`
      */
    ["com.affine.nameWorkspace.placeholder"](): string;
    /**
      * `Workspace name`
      */
    ["com.affine.nameWorkspace.subtitle.workspace-name"](): string;
    /**
      * `Workspace type`
      */
    ["com.affine.nameWorkspace.subtitle.workspace-type"](): string;
    /**
      * `Name your workspace`
      */
    ["com.affine.nameWorkspace.title"](): string;
    /**
      * `New page`
      */
    ["com.affine.new.page-mode"](): string;
    /**
      * `New edgeless`
      */
    ["com.affine.new_edgeless"](): string;
    /**
      * `Import`
      */
    ["com.affine.new_import"](): string;
    /**
      * `Next week`
      */
    ["com.affine.nextWeek"](): string;
    /**
      * `Back home`
      */
    ["com.affine.notFoundPage.backButton"](): string;
    /**
      * `Page not found`
      */
    ["com.affine.notFoundPage.title"](): string;
    /**
      * `LocalMind Community`
      */
    ["com.affine.other-page.nav.affine-community"](): string;
    /**
      * `Blog`
      */
    ["com.affine.other-page.nav.blog"](): string;
    /**
      * `Contact us`
      */
    ["com.affine.other-page.nav.contact-us"](): string;
    /**
      * `Download app`
      */
    ["com.affine.other-page.nav.download-app"](): string;
    /**
      * `Official website`
      */
    ["com.affine.other-page.nav.official-website"](): string;
    /**
      * `Open LocalMind`
      */
    ["com.affine.other-page.nav.open-affine"](): string;
    /**
      * `Add linked doc`
      */
    ["com.affine.page-operation.add-linked-page"](): string;
    /**
      * `{{ count }} more properties`
      */
    ["com.affine.page-properties.more-property.more"](options: {
        readonly count: string;
    }): string;
    /**
      * `{{ count }} more property`
      */
    ["com.affine.page-properties.more-property.one"](options: {
        readonly count: string;
    }): string;
    /**
      * `hide {{ count }} property`
      */
    ["com.affine.page-properties.hide-property.one"](options: {
        readonly count: string;
    }): string;
    /**
      * `hide {{ count }} properties`
      */
    ["com.affine.page-properties.hide-property.more"](options: {
        readonly count: string;
    }): string;
    /**
      * `Add property`
      */
    ["com.affine.page-properties.add-property"](): string;
    /**
      * `Create property`
      */
    ["com.affine.page-properties.add-property.menu.create"](): string;
    /**
      * `Properties`
      */
    ["com.affine.page-properties.add-property.menu.header"](): string;
    /**
      * `Config properties`
      */
    ["com.affine.page-properties.config-properties"](): string;
    /**
      * `Backlinks`
      */
    ["com.affine.page-properties.backlinks"](): string;
    /**
      * `Type`
      */
    ["com.affine.page-properties.create-property.menu.header"](): string;
    /**
      * `Added`
      */
    ["com.affine.page-properties.create-property.added"](): string;
    /**
      * `Icons`
      */
    ["com.affine.page-properties.icons"](): string;
    /**
      * `Local user`
      */
    ["com.affine.page-properties.local-user"](): string;
    /**
      * `Outgoing links`
      */
    ["com.affine.page-properties.outgoing-links"](): string;
    /**
      * `Info`
      */
    ["com.affine.page-properties.page-info"](): string;
    /**
      * `View Info`
      */
    ["com.affine.page-properties.page-info.view"](): string;
    /**
      * `No Record`
      */
    ["com.affine.page-properties.property-user-avatar-no-record"](): string;
    /**
      * `Local User`
      */
    ["com.affine.page-properties.property-user-local"](): string;
    /**
      * `Empty`
      */
    ["com.affine.page-properties.property-value-placeholder"](): string;
    /**
      * `Always hide`
      */
    ["com.affine.page-properties.property.always-hide"](): string;
    /**
      * `Always show`
      */
    ["com.affine.page-properties.property.always-show"](): string;
    /**
      * `Checkbox`
      */
    ["com.affine.page-properties.property.checkbox"](): string;
    /**
      * `Created by`
      */
    ["com.affine.page-properties.property.createdBy"](): string;
    /**
      * `Date`
      */
    ["com.affine.page-properties.property.date"](): string;
    /**
      * `Hide in view`
      */
    ["com.affine.page-properties.property.hide-in-view"](): string;
    /**
      * `Hide in view when empty`
      */
    ["com.affine.page-properties.property.hide-in-view-when-empty"](): string;
    /**
      * `Hide when empty`
      */
    ["com.affine.page-properties.property.hide-when-empty"](): string;
    /**
      * `Number`
      */
    ["com.affine.page-properties.property.number"](): string;
    /**
      * `Progress`
      */
    ["com.affine.page-properties.property.progress"](): string;
    /**
      * `Remove property`
      */
    ["com.affine.page-properties.property.remove-property"](): string;
    /**
      * `Required`
      */
    ["com.affine.page-properties.property.required"](): string;
    /**
      * `Show in view`
      */
    ["com.affine.page-properties.property.show-in-view"](): string;
    /**
      * `Tags`
      */
    ["com.affine.page-properties.property.tags"](): string;
    /**
      * `Doc mode`
      */
    ["com.affine.page-properties.property.docPrimaryMode"](): string;
    /**
      * `Text`
      */
    ["com.affine.page-properties.property.text"](): string;
    /**
      * `Journal`
      */
    ["com.affine.page-properties.property.journal"](): string;
    /**
      * `Duplicated`
      */
    ["com.affine.page-properties.property.journal-duplicated"](): string;
    /**
      * `Remove journal mark`
      */
    ["com.affine.page-properties.property.journal-remove"](): string;
    /**
      * `Last edited by`
      */
    ["com.affine.page-properties.property.updatedBy"](): string;
    /**
      * `Created`
      */
    ["com.affine.page-properties.property.createdAt"](): string;
    /**
      * `Updated`
      */
    ["com.affine.page-properties.property.updatedAt"](): string;
    /**
      * `Edgeless theme`
      */
    ["com.affine.page-properties.property.edgelessTheme"](): string;
    /**
      * `Page width`
      */
    ["com.affine.page-properties.property.pageWidth"](): string;
    /**
      * `Template`
      */
    ["com.affine.page-properties.property.template"](): string;
    /**
      * `Add relevant identifiers or categories to the doc. Useful for organizing content, improving searchability, and grouping related docs together.`
      */
    ["com.affine.page-properties.property.tags.tooltips"](): string;
    /**
      * `Indicates that this doc is a journal entry or daily note. Facilitates easy capture of ideas, quick logging of thoughts, and ongoing personal reflection.`
      */
    ["com.affine.page-properties.property.journal.tooltips"](): string;
    /**
      * `Use a checkbox to indicate whether a condition is true or false. Useful for confirming options, toggling features, or tracking task states.`
      */
    ["com.affine.page-properties.property.checkbox.tooltips"](): string;
    /**
      * `Use a date field to select or display a specific date. Useful for scheduling, setting deadlines, or recording important events.`
      */
    ["com.affine.page-properties.property.date.tooltips"](): string;
    /**
      * `Upload images to display or manage them. Useful for showcasing visual content, adding illustrations, or organizing a gallery.`
      */
    ["com.affine.page-properties.property.image.tooltips"](): string;
    /**
      * `Select one or more options. Useful for categorizing items, filtering data, or managing tags.`
      */
    ["com.affine.page-properties.property.multiSelect.tooltips"](): string;
    /**
      * `Enter a numeric value. Useful for quantities, measurements, or ranking items.`
      */
    ["com.affine.page-properties.property.number.tooltips"](): string;
    /**
      * `Set a progress value between 0 and 100. Useful for tracking completion status, visualizing progress, or managing goals.`
      */
    ["com.affine.page-properties.property.progress.tooltips"](): string;
    /**
      * `Choose one option. Useful for selecting a single preference, categorizing items, or making decisions.`
      */
    ["com.affine.page-properties.property.select.tooltips"](): string;
    /**
      * `Enter a link to websites or LocalMind docs. Useful for connecting to external resources and referencing internal docs.`
      */
    ["com.affine.page-properties.property.link.tooltips"](): string;
    /**
      * `Enter text. Useful for descriptions, comments, notes, or any other free-form text input.`
      */
    ["com.affine.page-properties.property.text.tooltips"](): string;
    /**
      * `Displays the author of the current doc. Useful for tracking doc ownership, accountability, and collaboration.`
      */
    ["com.affine.page-properties.property.createdBy.tooltips"](): string;
    /**
      * `Displays the last editor of the current doc. Useful for tracking recent changes.`
      */
    ["com.affine.page-properties.property.updatedBy.tooltips"](): string;
    /**
      * `Record the last modification timestamp. Useful for tracking changes, identifying recent updates, or monitoring content freshness.`
      */
    ["com.affine.page-properties.property.updatedAt.tooltips"](): string;
    /**
      * `Track when a doc was first created. Useful for maintaining record history, sorting by creation date, or auditing content chronologically.`
      */
    ["com.affine.page-properties.property.createdAt.tooltips"](): string;
    /**
      * `Select the doc mode from Page Mode, Edgeless Mode, or Auto. Useful for choosing the best display for your content.`
      */
    ["com.affine.page-properties.property.docPrimaryMode.tooltips"](): string;
    /**
      * `Select the doc theme from Light, Dark, or System. Useful for precise control over content viewing style.`
      */
    ["com.affine.page-properties.property.edgelessTheme.tooltips"](): string;
    /**
      * `Control the width of this page to fit content display needs.`
      */
    ["com.affine.page-properties.property.pageWidth.tooltips"](): string;
    /**
      * `Mark this doc as a template, which can be used to create new docs.`
      */
    ["com.affine.page-properties.property.template.tooltips"](): string;
    /**
      * `Created by {{userName}}`
      */
    ["com.affine.page-properties.property.createdBy.tip"](options: {
        readonly userName: string;
    }): string;
    /**
      * `Last edited by {{userName}}`
      */
    ["com.affine.page-properties.property.updatedBy.tip"](options: {
        readonly userName: string;
    }): string;
    /**
      * `Properties`
      */
    ["com.affine.propertySidebar.property-list.section"](): string;
    /**
      * `Add more properties`
      */
    ["com.affine.propertySidebar.add-more.section"](): string;
    /**
      * `customize properties`
      */
    ["com.affine.page-properties.settings.title"](): string;
    /**
      * `Open tag page`
      */
    ["com.affine.page-properties.tags.open-tags-page"](): string;
    /**
      * `Select tag or create one`
      */
    ["com.affine.page-properties.tags.selector-header-title"](): string;
    /**
      * `Display`
      */
    ["com.affine.page.display"](): string;
    /**
      * `Display properties`
      */
    ["com.affine.page.display.display-properties"](): string;
    /**
      * `Body notes`
      */
    ["com.affine.page.display.display-properties.body-notes"](): string;
    /**
      * `Grouping`
      */
    ["com.affine.page.display.grouping"](): string;
    /**
      * `Favourites`
      */
    ["com.affine.page.display.grouping.group-by-favourites"](): string;
    /**
      * `Tag`
      */
    ["com.affine.page.display.grouping.group-by-tag"](): string;
    /**
      * `Untagged`
      */
    ["com.affine.page.display.grouping.group-by-tag.untagged"](): string;
    /**
      * `No grouping`
      */
    ["com.affine.page.display.grouping.no-grouping"](): string;
    /**
      * `List option`
      */
    ["com.affine.page.display.list-option"](): string;
    /**
      * `Clear selection`
      */
    ["com.affine.page.group-header.clear"](): string;
    /**
      * `Favourited`
      */
    ["com.affine.page.group-header.favourited"](): string;
    /**
      * `Not favourited`
      */
    ["com.affine.page.group-header.not-favourited"](): string;
    /**
      * `Select all`
      */
    ["com.affine.page.group-header.select-all"](): string;
    /**
      * `Created by {{name}}`
      */
    ["com.affine.page.toolbar.created_by"](options: {
        readonly name: string;
    }): string;
    /**
      * `Doc mode`
      */
    ["com.affine.pageMode"](): string;
    /**
      * `all`
      */
    ["com.affine.pageMode.all"](): string;
    /**
      * `Edgeless`
      */
    ["com.affine.pageMode.edgeless"](): string;
    /**
      * `Page`
      */
    ["com.affine.pageMode.page"](): string;
    /**
      * `Congratulations on your successful purchase of LocalMind AI! You're now empowered to refine your content, generate images, and craft comprehensive mindmaps directly within LocalMind AI, dramatically enhancing your productivity.`
      */
    ["com.affine.payment.ai-upgrade-success-page.text"](): string;
    /**
      * `Purchase successful!`
      */
    ["com.affine.payment.ai-upgrade-success-page.title"](): string;
    /**
      * `Cancel subscription`
      */
    ["com.affine.payment.ai.action.cancel.button-label"](): string;
    /**
      * `Keep LocalMind AI`
      */
    ["com.affine.payment.ai.action.cancel.confirm.cancel-text"](): string;
    /**
      * `Cancel subscription`
      */
    ["com.affine.payment.ai.action.cancel.confirm.confirm-text"](): string;
    /**
      * `If you end your subscription now, you can still use LocalMind AI until the end of this billing period.`
      */
    ["com.affine.payment.ai.action.cancel.confirm.description"](): string;
    /**
      * `Cancel subscription`
      */
    ["com.affine.payment.ai.action.cancel.confirm.title"](): string;
    /**
      * `Login`
      */
    ["com.affine.payment.ai.action.login.button-label"](): string;
    /**
      * `Resume`
      */
    ["com.affine.payment.ai.action.resume.button-label"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.payment.ai.action.resume.confirm.cancel-text"](): string;
    /**
      * `Confirm`
      */
    ["com.affine.payment.ai.action.resume.confirm.confirm-text"](): string;
    /**
      * `Are you sure you want to resume the subscription for LocalMind AI? This means your payment method will be charged automatically at the end of each billing cycle, starting from the next billing cycle.`
      */
    ["com.affine.payment.ai.action.resume.confirm.description"](): string;
    /**
      * `You will be charged in the next billing cycle.`
      */
    ["com.affine.payment.ai.action.resume.confirm.notify.msg"](): string;
    /**
      * `Subscription updated`
      */
    ["com.affine.payment.ai.action.resume.confirm.notify.title"](): string;
    /**
      * `Resume auto-renewal?`
      */
    ["com.affine.payment.ai.action.resume.confirm.title"](): string;
    /**
      * `Write with you`
      */
    ["com.affine.payment.ai.benefit.g1"](): string;
    /**
      * `Create quality content from sentences to articles on topics you need`
      */
    ["com.affine.payment.ai.benefit.g1-1"](): string;
    /**
      * `Rewrite like the professionals`
      */
    ["com.affine.payment.ai.benefit.g1-2"](): string;
    /**
      * `Change the tones / fix spelling & grammar`
      */
    ["com.affine.payment.ai.benefit.g1-3"](): string;
    /**
      * `Draw with you`
      */
    ["com.affine.payment.ai.benefit.g2"](): string;
    /**
      * `Visualize your mind, magically`
      */
    ["com.affine.payment.ai.benefit.g2-1"](): string;
    /**
      * `Turn your outline into beautiful, engaging presentations`
      */
    ["com.affine.payment.ai.benefit.g2-2"](): string;
    /**
      * `Summarize your content into structured mind-map`
      */
    ["com.affine.payment.ai.benefit.g2-3"](): string;
    /**
      * `Plan with you`
      */
    ["com.affine.payment.ai.benefit.g3"](): string;
    /**
      * `Memorize and tidy up your knowledge`
      */
    ["com.affine.payment.ai.benefit.g3-1"](): string;
    /**
      * `Auto-sorting and auto-tagging`
      */
    ["com.affine.payment.ai.benefit.g3-2"](): string;
    /**
      * `Open source & Privacy ensured`
      */
    ["com.affine.payment.ai.benefit.g3-3"](): string;
    /**
      * `You have purchased LocalMind AI. The expiration date is {{end}}.`
      */
    ["com.affine.payment.ai.billing-tip.end-at"](options: {
        readonly end: string;
    }): string;
    /**
      * `You have purchased LocalMind AI. The next payment date is {{due}}.`
      */
    ["com.affine.payment.ai.billing-tip.next-bill-at"](options: {
        readonly due: string;
    }): string;
    /**
      * `Your recent payment failed, the next payment date is {{due}}.`
      */
    ["com.affine.payment.billing-tip.past-due"](options: {
        readonly due: string;
    }): string;
    /**
      * `You are currently on the Free plan.`
      */
    ["com.affine.payment.ai.pricing-plan.caption-free"](): string;
    /**
      * `You have purchased LocalMind AI`
      */
    ["com.affine.payment.ai.pricing-plan.caption-purchased"](): string;
    /**
      * `Learn about LocalMind AI`
      */
    ["com.affine.payment.ai.pricing-plan.learn"](): string;
    /**
      * `LocalMind AI`
      */
    ["com.affine.payment.ai.pricing-plan.title"](): string;
    /**
      * `Turn all your ideas into reality`
      */
    ["com.affine.payment.ai.pricing-plan.title-caption-1"](): string;
    /**
      * `A true multimodal AI copilot.`
      */
    ["com.affine.payment.ai.pricing-plan.title-caption-2"](): string;
    /**
      * `Billed annually`
      */
    ["com.affine.payment.ai.subscribe.billed-annually"](): string;
    /**
      * `You have purchased LocalMind AI.`
      */
    ["com.affine.payment.ai.usage-description-purchased"](): string;
    /**
      * `LocalMind AI usage`
      */
    ["com.affine.payment.ai.usage-title"](): string;
    /**
      * `Change plan`
      */
    ["com.affine.payment.ai.usage.change-button-label"](): string;
    /**
      * `Purchase`
      */
    ["com.affine.payment.ai.usage.purchase-button-label"](): string;
    /**
      * `Times used`
      */
    ["com.affine.payment.ai.usage.used-caption"](): string;
    /**
      * `{{used}}/{{limit}} times`
      */
    ["com.affine.payment.ai.usage.used-detail"](options: Readonly<{
        used: string;
        limit: string;
    }>): string;
    /**
      * `Active`
      */
    ["com.affine.payment.subscription-status.active"](): string;
    /**
      * `Past-due bill`
      */
    ["com.affine.payment.subscription-status.past-due"](): string;
    /**
      * `Trialing`
      */
    ["com.affine.payment.subscription-status.trialing"](): string;
    /**
      * `Unlimited local workspaces`
      */
    ["com.affine.payment.benefit-1"](): string;
    /**
      * `Unlimited login devices`
      */
    ["com.affine.payment.benefit-2"](): string;
    /**
      * `Unlimited blocks`
      */
    ["com.affine.payment.benefit-3"](): string;
    /**
      * `{{capacity}} of cloud storage`
      */
    ["com.affine.payment.benefit-4"](options: {
        readonly capacity: string;
    }): string;
    /**
      * `{{capacity}} of maximum file size`
      */
    ["com.affine.payment.benefit-5"](options: {
        readonly capacity: string;
    }): string;
    /**
      * `Number of members per workspace ≤ {{capacity}}`
      */
    ["com.affine.payment.benefit-6"](options: {
        readonly capacity: string;
    }): string;
    /**
      * `{{capacity}}-days version history`
      */
    ["com.affine.payment.benefit-7"](options: {
        readonly capacity: string;
    }): string;
    /**
      * `LocalMind AI`
      */
    ["com.affine.payment.billing-setting.ai-plan"](): string;
    /**
      * `Purchase`
      */
    ["com.affine.payment.billing-setting.ai.purchase"](): string;
    /**
      * `Start free trial`
      */
    ["com.affine.payment.billing-setting.ai.start-free-trial"](): string;
    /**
      * `One-time payment`
      */
    ["com.affine.payment.billing-setting.believer.price-caption"](): string;
    /**
      * `LocalMind Cloud`
      */
    ["com.affine.payment.billing-setting.believer.title"](): string;
    /**
      * `Cancel subscription`
      */
    ["com.affine.payment.billing-setting.cancel-subscription"](): string;
    /**
      * `Once you canceled subscription you will no longer enjoy the plan benefits.`
      */
    ["com.affine.payment.billing-setting.cancel-subscription.description"](): string;
    /**
      * `Change plan`
      */
    ["com.affine.payment.billing-setting.change-plan"](): string;
    /**
      * `LocalMind Cloud`
      */
    ["com.affine.payment.billing-setting.current-plan"](): string;
    /**
      * `Expiration date`
      */
    ["com.affine.payment.billing-setting.expiration-date"](): string;
    /**
      * `Your subscription is valid until {{expirationDate}}`
      */
    ["com.affine.payment.billing-setting.expiration-date.description"](options: {
        readonly expirationDate: string;
    }): string;
    /**
      * `Billing history`
      */
    ["com.affine.payment.billing-setting.history"](): string;
    /**
      * `Information`
      */
    ["com.affine.payment.billing-setting.information"](): string;
    /**
      * `month`
      */
    ["com.affine.payment.billing-setting.month"](): string;
    /**
      * `There are no invoices to display.`
      */
    ["com.affine.payment.billing-setting.no-invoice"](): string;
    /**
      * `Paid`
      */
    ["com.affine.payment.billing-setting.paid"](): string;
    /**
      * `Manage payment details`
      */
    ["com.affine.payment.billing-setting.payment-method"](): string;
    /**
      * `View future and past invoices, update billing information, and change payment methods. Provided by Stripe.`
      */
    ["com.affine.payment.billing-setting.payment-method.description"](): string;
    /**
      * `Go`
      */
    ["com.affine.payment.billing-setting.payment-method.go"](): string;
    /**
      * `Renew date`
      */
    ["com.affine.payment.billing-setting.renew-date"](): string;
    /**
      * `Next billing date: {{renewDate}}`
      */
    ["com.affine.payment.billing-setting.renew-date.description"](options: {
        readonly renewDate: string;
    }): string;
    /**
      * `Due date`
      */
    ["com.affine.payment.billing-setting.due-date"](): string;
    /**
      * `Your subscription will end on {{dueDate}}`
      */
    ["com.affine.payment.billing-setting.due-date.description"](options: {
        readonly dueDate: string;
    }): string;
    /**
      * `Resume`
      */
    ["com.affine.payment.billing-setting.resume-subscription"](): string;
    /**
      * `Manage your billing information and invoices`
      */
    ["com.affine.payment.billing-setting.subtitle"](): string;
    /**
      * `Billing`
      */
    ["com.affine.payment.billing-setting.title"](): string;
    /**
      * `Update`
      */
    ["com.affine.payment.billing-setting.update"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.payment.billing-setting.upgrade"](): string;
    /**
      * `View invoice`
      */
    ["com.affine.payment.billing-setting.view-invoice"](): string;
    /**
      * `year`
      */
    ["com.affine.payment.billing-setting.year"](): string;
    /**
      * `Please tell us more about your use case, to make LocalMind better.`
      */
    ["com.affine.payment.billing-type-form.description"](): string;
    /**
      * `Go`
      */
    ["com.affine.payment.billing-type-form.go"](): string;
    /**
      * `Tell us your use case`
      */
    ["com.affine.payment.billing-type-form.title"](): string;
    /**
      * `You have reached the limit`
      */
    ["com.affine.payment.blob-limit.title"](): string;
    /**
      * `Book a demo`
      */
    ["com.affine.payment.book-a-demo"](): string;
    /**
      * `Buy Pro`
      */
    ["com.affine.payment.buy-pro"](): string;
    /**
      * `Change to {{to}} Billing`
      */
    ["com.affine.payment.change-to"](options: {
        readonly to: string;
    }): string;
    /**
      * `Include in FOSS`
      */
    ["com.affine.payment.cloud.free.benefit.g1"](): string;
    /**
      * `Unlimited local workspaces`
      */
    ["com.affine.payment.cloud.free.benefit.g1-1"](): string;
    /**
      * `Unlimited use and customization`
      */
    ["com.affine.payment.cloud.free.benefit.g1-2"](): string;
    /**
      * `Unlimited doc and edgeless editing`
      */
    ["com.affine.payment.cloud.free.benefit.g1-3"](): string;
    /**
      * `Include in Basic`
      */
    ["com.affine.payment.cloud.free.benefit.g2"](): string;
    /**
      * `10 GB of cloud storage.`
      */
    ["com.affine.payment.cloud.free.benefit.g2-1"](): string;
    /**
      * `10 MB of maximum file size.`
      */
    ["com.affine.payment.cloud.free.benefit.g2-2"](): string;
    /**
      * `Up to 3 members per workspace.`
      */
    ["com.affine.payment.cloud.free.benefit.g2-3"](): string;
    /**
      * `7-days cloud time machine file version history.`
      */
    ["com.affine.payment.cloud.free.benefit.g2-4"](): string;
    /**
      * `Up to 3 login devices.`
      */
    ["com.affine.payment.cloud.free.benefit.g2-5"](): string;
    /**
      * `Local Editor under MIT license.`
      */
    ["com.affine.payment.cloud.free.description"](): string;
    /**
      * `Local FOSS + Cloud Basic`
      */
    ["com.affine.payment.cloud.free.name"](): string;
    /**
      * `Free forever`
      */
    ["com.affine.payment.cloud.free.title"](): string;
    /**
      * `Included in Pro plan`
      */
    ["com.affine.payment.cloud.onetime.included"](): string;
    /**
      * `Included in Believer plan`
      */
    ["com.affine.payment.cloud.lifetime.included"](): string;
    /**
      * `We host, no technical setup required.`
      */
    ["com.affine.payment.cloud.pricing-plan.select.caption"](): string;
    /**
      * `Hosted by LocalMind.Pro`
      */
    ["com.affine.payment.cloud.pricing-plan.select.title"](): string;
    /**
      * `Billed annually`
      */
    ["com.affine.payment.cloud.pricing-plan.toggle-billed-yearly"](): string;
    /**
      * `Saving {{discount}}%`
      */
    ["com.affine.payment.cloud.pricing-plan.toggle-discount"](options: {
        readonly discount: string;
    }): string;
    /**
      * `Annually`
      */
    ["com.affine.payment.cloud.pricing-plan.toggle-yearly"](): string;
    /**
      * `Include in Pro`
      */
    ["com.affine.payment.cloud.pro.benefit.g1"](): string;
    /**
      * `Everything in LocalMind FOSS & Basic.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-1"](): string;
    /**
      * `100 GB of cloud storage.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-2"](): string;
    /**
      * `100 MB of maximum file size.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-3"](): string;
    /**
      * `Up to 10 members per workspace.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-4"](): string;
    /**
      * `30-days cloud time machine file version history.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-5"](): string;
    /**
      * `Add comments on Doc and Edgeless.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-6"](): string;
    /**
      * `Community support.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-7"](): string;
    /**
      * `Real-time syncing & collaboration for more people.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-8"](): string;
    /**
      * `Granular edit access to docs.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-9"](): string;
    /**
      * `For family and small teams.`
      */
    ["com.affine.payment.cloud.pro.description"](): string;
    /**
      * `Pro`
      */
    ["com.affine.payment.cloud.pro.name"](): string;
    /**
      * `annually`
      */
    ["com.affine.payment.cloud.pro.title.billed-yearly"](): string;
    /**
      * `{{price}} per month`
      */
    ["com.affine.payment.cloud.pro.title.price-monthly"](options: {
        readonly price: string;
    }): string;
    /**
      * `Include in Team Workspace`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1"](): string;
    /**
      * `Everything in LocalMind Pro.`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-1"](): string;
    /**
      * `100 GB initial storage + 20 GB per seat.`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-2"](): string;
    /**
      * `500 MB of maximum file size.`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-3"](): string;
    /**
      * `Unlimited team members (10+ seats).`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-4"](): string;
    /**
      * `Multiple admin roles.`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-5"](): string;
    /**
      * `Priority customer support.`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-6"](): string;
    /**
      * `Best for scalable teams.`
      */
    ["com.affine.payment.cloud.team-workspace.description"](): string;
    /**
      * `Team`
      */
    ["com.affine.payment.cloud.team-workspace.name"](): string;
    /**
      * `annually`
      */
    ["com.affine.payment.cloud.team-workspace.title.billed-yearly"](): string;
    /**
      * `{{price}} per seat/month`
      */
    ["com.affine.payment.cloud.team-workspace.title.price-monthly"](options: {
        readonly price: string;
    }): string;
    /**
      * `Contact sales`
      */
    ["com.affine.payment.contact-sales"](): string;
    /**
      * `Current plan`
      */
    ["com.affine.payment.current-plan"](): string;
    /**
      * `Start 14-day free trial`
      */
    ["com.affine.payment.start-free-trial"](): string;
    /**
      * `{{amount}}% off`
      */
    ["com.affine.payment.discount-amount"](options: {
        readonly amount: string;
    }): string;
    /**
      * `Downgrade`
      */
    ["com.affine.payment.downgrade"](): string;
    /**
      * `We'd like to hear more about where we fall short, so that we can make LocalMind better.`
      */
    ["com.affine.payment.downgraded-notify.content"](): string;
    /**
      * `Later`
      */
    ["com.affine.payment.downgraded-notify.later"](): string;
    /**
      * `Sure, Open in browser`
      */
    ["com.affine.payment.downgraded-notify.ok-client"](): string;
    /**
      * `Sure, Open in new tab`
      */
    ["com.affine.payment.downgraded-notify.ok-web"](): string;
    /**
      * `Sorry to see you go`
      */
    ["com.affine.payment.downgraded-notify.title"](): string;
    /**
      * `You have successfully downgraded. After the current billing period ends, your account will automatically switch to the Free plan.`
      */
    ["com.affine.payment.downgraded-tooltip"](): string;
    /**
      * `Best team workspace for collaboration and knowledge distilling.`
      */
    ["com.affine.payment.dynamic-benefit-1"](): string;
    /**
      * `Focusing on what really matters with team project management and automation.`
      */
    ["com.affine.payment.dynamic-benefit-2"](): string;
    /**
      * `Pay for seats, fits all team size.`
      */
    ["com.affine.payment.dynamic-benefit-3"](): string;
    /**
      * `Solutions & best practices for dedicated needs.`
      */
    ["com.affine.payment.dynamic-benefit-4"](): string;
    /**
      * `Embedable & interrogations with IT support.`
      */
    ["com.affine.payment.dynamic-benefit-5"](): string;
    /**
      * `Everything in LocalMind Pro`
      */
    ["com.affine.payment.lifetime.benefit-1"](): string;
    /**
      * `Life-time personal usage`
      */
    ["com.affine.payment.lifetime.benefit-2"](): string;
    /**
      * `{{capacity}} Cloud Storage`
      */
    ["com.affine.payment.lifetime.benefit-3"](options: {
        readonly capacity: string;
    }): string;
    /**
      * `Dedicated Discord support with LocalMind makers`
      */
    ["com.affine.payment.lifetime.benefit-4"](): string;
    /**
      * `Become a Life-time supporter?`
      */
    ["com.affine.payment.lifetime.caption-1"](): string;
    /**
      * `Purchase`
      */
    ["com.affine.payment.lifetime.purchase"](): string;
    /**
      * `Purchased`
      */
    ["com.affine.payment.lifetime.purchased"](): string;
    /**
      * `Believer Plan`
      */
    ["com.affine.payment.lifetime.title"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.payment.member-limit.free.confirm"](): string;
    /**
      * `Workspaces created by {{planName}} users are limited to {{quota}} members. To add more collaborators, you can:`
      */
    ["com.affine.payment.member-limit.description"](options: Readonly<{
        planName: string;
        quota: string;
    }>): string;
    /**
      * `Upgrade to LocalMind Pro for expanded member capacity`
      */
    ["com.affine.payment.member-limit.description.tips-for-free-plan"](): string;
    /**
      * `Convert to a Team Workspace for unlimited collaboration`
      */
    ["com.affine.payment.member-limit.description.tips-1"](): string;
    /**
      * `Or create a new workspace`
      */
    ["com.affine.payment.member-limit.description.tips-2"](): string;
    /**
      * `Got it`
      */
    ["com.affine.payment.member-limit.pro.confirm"](): string;
    /**
      * `You have reached the limit`
      */
    ["com.affine.payment.member-limit.title"](): string;
    /**
      * `Manage members here. {{planName}} users can invite up to {{memberLimit}}`
      */
    ["com.affine.payment.member.description"](options: Readonly<{
        planName: string;
        memberLimit: string;
    }>): string;
    /**
      * `Choose your plan`
      */
    ["com.affine.payment.member.description.choose-plan"](): string;
    /**
      * `go upgrade`
      */
    ["com.affine.payment.member.description.go-upgrade"](): string;
    /**
      * `Looking to collaborate with more people?`
      */
    ["com.affine.payment.member.description2"](): string;
    /**
      * `Work together with unlimited team members.`
      */
    ["com.affine.payment.member.team.description"](): string;
    /**
      * `Invite team members`
      */
    ["com.affine.payment.member.team.invite.title"](): string;
    /**
      * `Invite new members to join your workspace via email or share an invite link`
      */
    ["com.affine.payment.member.team.invite.description"](): string;
    /**
      * `Email Invite`
      */
    ["com.affine.payment.member.team.invite.email-invite"](): string;
    /**
      * `Invite Link`
      */
    ["com.affine.payment.member.team.invite.invite-link"](): string;
    /**
      * `Email addresses`
      */
    ["com.affine.payment.member.team.invite.email-addresses"](): string;
    /**
      * `Enter email addresses (separated by commas)`
      */
    ["com.affine.payment.member.team.invite.email-placeholder"](): string;
    /**
      * `Import CSV`
      */
    ["com.affine.payment.member.team.invite.import-csv"](): string;
    /**
      * `Send Invites`
      */
    ["com.affine.payment.member.team.invite.send-invites"](): string;
    /**
      * `Link expiration`
      */
    ["com.affine.payment.member.team.invite.link-expiration"](): string;
    /**
      * `{{number}} days`
      */
    ["com.affine.payment.member.team.invite.expiration-date"](options: {
        readonly number: string;
    }): string;
    /**
      * `To expire at: {{expireTime}}`
      */
    ["com.affine.payment.member.team.invite.expire-at"](options: {
        readonly expireTime: string;
    }): string;
    /**
      * `Invitation link`
      */
    ["com.affine.payment.member.team.invite.invitation-link"](): string;
    /**
      * `Generate a link to invite members to your workspace`
      */
    ["com.affine.payment.member.team.invite.invitation-link.description"](): string;
    /**
      * `Generate`
      */
    ["com.affine.payment.member.team.invite.generate"](): string;
    /**
      * `Copy`
      */
    ["com.affine.payment.member.team.invite.copy"](): string;
    /**
      * `Done`
      */
    ["com.affine.payment.member.team.invite.done"](): string;
    /**
      * `Invitations sent: {{count}}`
      */
    ["com.affine.payment.member.team.invite.notify.title"](options: {
        readonly count: string;
    }): string;
    /**
      * `These email addresses have already been invited:`
      */
    ["com.affine.payment.member.team.invite.notify.fail-message"](): string;
    /**
      * `Revoke invitation`
      */
    ["com.affine.payment.member.team.revoke"](): string;
    /**
      * `Approve`
      */
    ["com.affine.payment.member.team.approve"](): string;
    /**
      * `Decline`
      */
    ["com.affine.payment.member.team.decline"](): string;
    /**
      * `Remove member`
      */
    ["com.affine.payment.member.team.remove"](): string;
    /**
      * `Retry payment`
      */
    ["com.affine.payment.member.team.retry-payment"](): string;
    /**
      * `Change role to admin`
      */
    ["com.affine.payment.member.team.change.admin"](): string;
    /**
      * `Change role to collaborator`
      */
    ["com.affine.payment.member.team.change.collaborator"](): string;
    /**
      * `Assign as owner`
      */
    ["com.affine.payment.member.team.assign"](): string;
    /**
      * `Insufficient Team Seats`
      */
    ["com.affine.payment.member.team.retry-payment.title"](): string;
    /**
      * `The payment for adding new team members has failed. To add more seats, please update your payment method and process unpaid invoices.`
      */
    ["com.affine.payment.member.team.retry-payment.owner.description"](): string;
    /**
      * `The payment for adding new team members has failed. Please contact your workspace owner to update the payment method and process unpaid invoices.`
      */
    ["com.affine.payment.member.team.retry-payment.admin.description"](): string;
    /**
      * `Update Payment`
      */
    ["com.affine.payment.member.team.retry-payment.update-payment"](): string;
    /**
      * `Subscription has been disabled for your team workspace. To add more seats, you'll need to resume subscription first.`
      */
    ["com.affine.payment.member.team.disabled-subscription.owner.description"](): string;
    /**
      * `Your team workspace has subscription disabled, which prevents adding more seats. Please contact your workspace owner to enable subscription.`
      */
    ["com.affine.payment.member.team.disabled-subscription.admin.description"](): string;
    /**
      * `Resume Subscription`
      */
    ["com.affine.payment.member.team.disabled-subscription.resume-subscription"](): string;
    /**
      * `Invitation Revoked`
      */
    ["com.affine.payment.member.team.revoke.notify.title"](): string;
    /**
      * `You have canceled the invitation for {{name}}`
      */
    ["com.affine.payment.member.team.revoke.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Request approved`
      */
    ["com.affine.payment.member.team.approve.notify.title"](): string;
    /**
      * `You have approved the {{name}}’s request to join this workspace`
      */
    ["com.affine.payment.member.team.approve.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Request declined`
      */
    ["com.affine.payment.member.team.decline.notify.title"](): string;
    /**
      * `You have declined the {{name}}’s request to join this workspace`
      */
    ["com.affine.payment.member.team.decline.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Member removed`
      */
    ["com.affine.payment.member.team.remove.notify.title"](): string;
    /**
      * `You have removed {{name}} from this workspace`
      */
    ["com.affine.payment.member.team.remove.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Role Updated`
      */
    ["com.affine.payment.member.team.change.notify.title"](): string;
    /**
      * `You have successfully promoted {{name}} to Admin.`
      */
    ["com.affine.payment.member.team.change.admin.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `You have successfully changed {{name}} s role to collaborator.`
      */
    ["com.affine.payment.member.team.change.collaborator.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Owner assigned`
      */
    ["com.affine.payment.member.team.assign.notify.title"](): string;
    /**
      * `You have successfully assigned {{name}} as the owner of this workspace.`
      */
    ["com.affine.payment.member.team.assign.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Confirm new workspace owner`
      */
    ["com.affine.payment.member.team.assign.confirm.title"](): string;
    /**
      * `You are about to transfer workspace ownership to {{name}}. Please review the following changes carefully:`
      */
    ["com.affine.payment.member.team.assign.confirm.description"](options: {
        readonly name: string;
    }): string;
    /**
      * `This action cannot be undone`
      */
    ["com.affine.payment.member.team.assign.confirm.description-1"](): string;
    /**
      * `Your role will be changed to Admin`
      */
    ["com.affine.payment.member.team.assign.confirm.description-2"](): string;
    /**
      * `You will lose ownership rights to the entire workspace`
      */
    ["com.affine.payment.member.team.assign.confirm.description-3"](): string;
    /**
      * `To confirm this transfer, please type the workspace name`
      */
    ["com.affine.payment.member.team.assign.confirm.description-4"](): string;
    /**
      * `Type workspace name to confirm`
      */
    ["com.affine.payment.member.team.assign.confirm.placeholder"](): string;
    /**
      * `Transfer Ownership`
      */
    ["com.affine.payment.member.team.assign.confirm.button"](): string;
    /**
      * `Remove member from workspace?`
      */
    ["com.affine.payment.member.team.remove.confirm.title"](): string;
    /**
      * `This action will revoke their access to all workspace resources immediately.`
      */
    ["com.affine.payment.member.team.remove.confirm.description"](): string;
    /**
      * `Remove Member`
      */
    ["com.affine.payment.member.team.remove.confirm.confirm-button"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.payment.member.team.remove.confirm.cancel"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.payment.modal.change.cancel"](): string;
    /**
      * `Change`
      */
    ["com.affine.payment.modal.change.confirm"](): string;
    /**
      * `Change your subscription`
      */
    ["com.affine.payment.modal.change.title"](): string;
    /**
      * `Cancel subscription`
      */
    ["com.affine.payment.modal.downgrade.cancel"](): string;
    /**
      * `You can still use LocalMind Cloud Pro until the end of this billing period :)`
      */
    ["com.affine.payment.modal.downgrade.caption"](): string;
    /**
      * `Keep LocalMind Cloud Pro`
      */
    ["com.affine.payment.modal.downgrade.confirm"](): string;
    /**
      * `Keep Team plan`
      */
    ["com.affine.payment.modal.downgrade.team-confirm"](): string;
    /**
      * `We're sorry to see you go, but we're always working to improve, and your feedback is welcome. We hope to see you return in the future.`
      */
    ["com.affine.payment.modal.downgrade.content"](): string;
    /**
      * `Are you sure?`
      */
    ["com.affine.payment.modal.downgrade.title"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.payment.modal.resume.cancel"](): string;
    /**
      * `Confirm`
      */
    ["com.affine.payment.modal.resume.confirm"](): string;
    /**
      * `Are you sure you want to resume the subscription for your pro account? This means your payment method will be charged automatically at the end of each billing cycle, starting from the next billing cycle.`
      */
    ["com.affine.payment.modal.resume.content"](): string;
    /**
      * `Resume auto-renewal?`
      */
    ["com.affine.payment.modal.resume.title"](): string;
    /**
      * `Refresh`
      */
    ["com.affine.payment.plans-error-retry"](): string;
    /**
      * `Unable to load pricing plans, please check your network. `
      */
    ["com.affine.payment.plans-error-tip"](): string;
    /**
      * `monthly`
      */
    ["com.affine.payment.recurring-monthly"](): string;
    /**
      * `annually`
      */
    ["com.affine.payment.recurring-yearly"](): string;
    /**
      * `Resume`
      */
    ["com.affine.payment.resume"](): string;
    /**
      * `Subscription Resumed`
      */
    ["com.affine.payment.resume.success.title"](): string;
    /**
      * `Your team workspace subscription has been enabled successfully. Changes will take effect immediately.`
      */
    ["com.affine.payment.resume.success.team.message"](): string;
    /**
      * `Resume auto-renewal`
      */
    ["com.affine.payment.resume-renewal"](): string;
    /**
      * `See all plans`
      */
    ["com.affine.payment.see-all-plans"](): string;
    /**
      * `Sign up free`
      */
    ["com.affine.payment.sign-up-free"](): string;
    /**
      * `Cloud storage is insufficient. Please contact the owner of that workspace.`
      */
    ["com.affine.payment.storage-limit.description.member"](): string;
    /**
      * `Cloud storage is insufficient. You can upgrade your account to unlock more cloud storage.`
      */
    ["com.affine.payment.storage-limit.description.owner"](): string;
    /**
      * `Unable to sync due to insufficient storage space. You can remove excess content, upgrade your account, or increase your workspace storage to resolve this issue.`
      */
    ["com.affine.payment.storage-limit.new-description.owner"](): string;
    /**
      * `Sync failed due to storage space limit`
      */
    ["com.affine.payment.storage-limit.new-title"](): string;
    /**
      * `View`
      */
    ["com.affine.payment.storage-limit.view"](): string;
    /**
      * `You are currently on the {{plan}} plan. After the current billing period ends, your account will automatically switch to the Free plan.`
      */
    ["com.affine.payment.subtitle-canceled"](options: {
        readonly plan: string;
    }): string;
    /**
      * `This is the pricing plans of LocalMind Cloud. You can sign up or sign in to your account first.`
      */
    ["com.affine.payment.subtitle-not-signed-in"](): string;
    /**
      * `See all plans`
      */
    ["com.affine.payment.tag-tooltips"](): string;
    /**
      * `Tell us your use case`
      */
    ["com.affine.payment.tell-us-use-case"](): string;
    /**
      * `Pricing plans`
      */
    ["com.affine.payment.title"](): string;
    /**
      * `You have changed your plan to {{plan}} billing.`
      */
    ["com.affine.payment.updated-notify-msg"](options: {
        readonly plan: string;
    }): string;
    /**
      * `Subscription updated`
      */
    ["com.affine.payment.updated-notify-title"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.payment.upgrade"](): string;
    /**
      * `Redeem code`
      */
    ["com.affine.payment.redeem-code"](): string;
    /**
      * `We'd like to hear more about your use case, so that we can make LocalMind better.`
      */
    ["com.affine.payment.upgrade-success-notify.content"](): string;
    /**
      * `Later`
      */
    ["com.affine.payment.upgrade-success-notify.later"](): string;
    /**
      * `Sure, open in browser`
      */
    ["com.affine.payment.upgrade-success-notify.ok-client"](): string;
    /**
      * `Sure, open in new tab`
      */
    ["com.affine.payment.upgrade-success-notify.ok-web"](): string;
    /**
      * `Thanks for subscribing!`
      */
    ["com.affine.payment.upgrade-success-notify.title"](): string;
    /**
      * `Congratulations! Your LocalMind account has been successfully upgraded to a Pro account.`
      */
    ["com.affine.payment.upgrade-success-page.text"](): string;
    /**
      * `Upgrade successful!`
      */
    ["com.affine.payment.upgrade-success-page.title"](): string;
    /**
      * `Congratulations! Your workspace has been successfully upgraded to a Team Workspace. Now you can invite unlimited members to collaborate in this workspace.`
      */
    ["com.affine.payment.upgrade-success-page.team.text-1"](): string;
    /**
      * `Thank you for your purchase!`
      */
    ["com.affine.payment.license-success.title"](): string;
    /**
      * `Thank you for purchasing the LocalMind self-hosted license.`
      */
    ["com.affine.payment.license-success.text-1"](): string;
    /**
      * `You can use this key to upgrade in Settings > Workspace > License > Use purchased key`
      */
    ["com.affine.payment.license-success.hint"](): string;
    /**
      * `Open LocalMind`
      */
    ["com.affine.payment.license-success.open-affine"](): string;
    /**
      * `Copied key to clipboard`
      */
    ["com.affine.payment.license-success.copy"](): string;
    /**
      * `View analytics`
      */
    ["com.affine.doc.analytics.title"](): string;
    /**
      * `({{count}} total)`
      */
    ["com.affine.doc.analytics.summary.total"](options: {
        readonly count: string;
    }): string;
    /**
      * `Last {{days}} days`
      */
    ["com.affine.doc.analytics.window.last-days"](options: {
        readonly days: string;
    }): string;
    /**
      * `Total`
      */
    ["com.affine.doc.analytics.metric.total"](): string;
    /**
      * `Unique`
      */
    ["com.affine.doc.analytics.metric.unique"](): string;
    /**
      * `Guest`
      */
    ["com.affine.doc.analytics.metric.guest"](): string;
    /**
      * `Total views`
      */
    ["com.affine.doc.analytics.chart.total-views"](): string;
    /**
      * `Unique views`
      */
    ["com.affine.doc.analytics.chart.unique-views"](): string;
    /**
      * `Unable to load analytics.`
      */
    ["com.affine.doc.analytics.error.load-analytics"](): string;
    /**
      * `Unable to load viewers.`
      */
    ["com.affine.doc.analytics.error.load-viewers"](): string;
    /**
      * `No page views in this window.`
      */
    ["com.affine.doc.analytics.empty.no-page-views"](): string;
    /**
      * `No viewers in this window.`
      */
    ["com.affine.doc.analytics.empty.no-viewers"](): string;
    /**
      * `Viewers`
      */
    ["com.affine.doc.analytics.viewers.title"](): string;
    /**
      * `Show all viewers`
      */
    ["com.affine.doc.analytics.viewers.show-all"](): string;
    /**
      * `Open pricing plans`
      */
    ["com.affine.doc.analytics.paywall.open-pricing"](): string;
    /**
      * `Doc analytics over 7 days require an LocalMind Team subscription.`
      */
    ["com.affine.doc.analytics.paywall.toast"](): string;
    /**
      * `Close`
      */
    ["com.affine.peek-view-controls.close"](): string;
    /**
      * `Open this doc`
      */
    ["com.affine.peek-view-controls.open-doc"](): string;
    /**
      * `Open in edgeless`
      */
    ["com.affine.peek-view-controls.open-doc-in-edgeless"](): string;
    /**
      * `Open in new tab`
      */
    ["com.affine.peek-view-controls.open-doc-in-new-tab"](): string;
    /**
      * `Open in split view`
      */
    ["com.affine.peek-view-controls.open-doc-in-split-view"](): string;
    /**
      * `Open doc info`
      */
    ["com.affine.peek-view-controls.open-info"](): string;
    /**
      * `Open this attachment`
      */
    ["com.affine.peek-view-controls.open-attachment"](): string;
    /**
      * `Open in new tab`
      */
    ["com.affine.peek-view-controls.open-attachment-in-new-tab"](): string;
    /**
      * `Open in split view`
      */
    ["com.affine.peek-view-controls.open-attachment-in-split-view"](): string;
    /**
      * `Open in center peek`
      */
    ["com.affine.peek-view-controls.open-doc-in-center-peek"](): string;
    /**
      * `Copy link`
      */
    ["com.affine.peek-view-controls.copy-link"](): string;
    /**
      * `Click or drag`
      */
    ["com.affine.split-view-drag-handle.tooltip"](): string;
    /**
      * `Split view does not support folders.`
      */
    ["com.affine.split-view-folder-warning.description"](): string;
    /**
      * `Do not show this again`
      */
    ["do-not-show-this-again"](): string;
    /**
      * `New`
      */
    ["com.affine.quicksearch.group.creation"](): string;
    /**
      * `Search locally`
      */
    ["com.affine.quicksearch.search-locally"](): string;
    /**
      * `Documents`
      */
    ["com.affine.quicksearch.mode.documents"](): string;
    /**
      * `Commands`
      */
    ["com.affine.quicksearch.mode.commands"](): string;
    /**
      * `Load more results`
      */
    ["com.affine.quicksearch.load-more"](): string;
    /**
      * `Search for "{{query}}"`
      */
    ["com.affine.quicksearch.group.searchfor"](options: {
        readonly query: string;
    }): string;
    /**
      * `Search for "{{query}}" (locally)`
      */
    ["com.affine.quicksearch.group.searchfor-locally"](options: {
        readonly query: string;
    }): string;
    /**
      * `Reset sync`
      */
    ["com.affine.resetSyncStatus.button"](): string;
    /**
      * `This operation may fix some synchronization issues.`
      */
    ["com.affine.resetSyncStatus.description"](): string;
    /**
      * `Collections`
      */
    ["com.affine.rootAppSidebar.collections"](): string;
    /**
      * `Notifications`
      */
    ["com.affine.rootAppSidebar.notifications"](): string;
    /**
      * `Only doc can be placed on here`
      */
    ["com.affine.rootAppSidebar.doc.link-doc-only"](): string;
    /**
      * `Remove link`
      */
    ["com.affine.rootAppSidebar.doc.remove-link"](): string;
    /**
      * `Remove link?`
      */
    ["com.affine.rootAppSidebar.doc.remove-link.confirm.title"](): string;
    /**
      * `This removes all links to "{{title}}" from "{{parentTitle}}". The original document and its contents will be kept.`
      */
    ["com.affine.rootAppSidebar.doc.remove-link.confirm.description"](options: Readonly<{
        title: string;
        parentTitle: string;
    }>): string;
    /**
      * `Remove link`
      */
    ["com.affine.rootAppSidebar.doc.remove-link.confirm.confirm"](): string;
    /**
      * `No linked docs`
      */
    ["com.affine.rootAppSidebar.docs.no-subdoc"](): string;
    /**
      * `Loading linked docs...`
      */
    ["com.affine.rootAppSidebar.docs.references-loading"](): string;
    /**
      * `New doc`
      */
    ["com.affine.rootAppSidebar.explorer.collection-add-tooltip"](): string;
    /**
      * `New collection`
      */
    ["com.affine.rootAppSidebar.explorer.collection-section-add-tooltip"](): string;
    /**
      * `New linked doc`
      */
    ["com.affine.rootAppSidebar.explorer.doc-add-tooltip"](): string;
    /**
      * `Copy`
      */
    ["com.affine.rootAppSidebar.explorer.drop-effect.copy"](): string;
    /**
      * `Link`
      */
    ["com.affine.rootAppSidebar.explorer.drop-effect.link"](): string;
    /**
      * `Move`
      */
    ["com.affine.rootAppSidebar.explorer.drop-effect.move"](): string;
    /**
      * `New doc`
      */
    ["com.affine.rootAppSidebar.explorer.fav-section-add-tooltip"](): string;
    /**
      * `New doc`
      */
    ["com.affine.rootAppSidebar.explorer.organize-add-tooltip"](): string;
    /**
      * `New folder`
      */
    ["com.affine.rootAppSidebar.explorer.organize-section-add-tooltip"](): string;
    /**
      * `New doc`
      */
    ["com.affine.rootAppSidebar.explorer.tag-add-tooltip"](): string;
    /**
      * `New tag`
      */
    ["com.affine.rootAppSidebar.explorer.tag-section-add-tooltip"](): string;
    /**
      * `Favorites`
      */
    ["com.affine.rootAppSidebar.favorites"](): string;
    /**
      * `No favorites`
      */
    ["com.affine.rootAppSidebar.favorites.empty"](): string;
    /**
      * `Migration data`
      */
    ["com.affine.rootAppSidebar.migration-data"](): string;
    /**
      * `Empty the old favorites`
      */
    ["com.affine.rootAppSidebar.migration-data.clean-all"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.rootAppSidebar.migration-data.clean-all.cancel"](): string;
    /**
      * `OK`
      */
    ["com.affine.rootAppSidebar.migration-data.clean-all.confirm"](): string;
    /**
      * `The old "Favorites" will be replaced`
      */
    ["com.affine.rootAppSidebar.migration-data.help"](): string;
    /**
      * `Empty the old favorites`
      */
    ["com.affine.rootAppSidebar.migration-data.help.clean-all"](): string;
    /**
      * `OK`
      */
    ["com.affine.rootAppSidebar.migration-data.help.confirm"](): string;
    /**
      * `Organize`
      */
    ["com.affine.rootAppSidebar.organize"](): string;
    /**
      * `Delete`
      */
    ["com.affine.rootAppSidebar.organize.delete"](): string;
    /**
      * `Only empty folders can be deleted. Move out the contents or delete subfolders first.`
      */
    ["com.affine.rootAppSidebar.organize.delete.not-empty"](): string;
    /**
      * `Delete (empty folders only)`
      */
    ["com.affine.rootAppSidebar.organize.delete.empty-only"](): string;
    /**
      * `Remove from folder`
      */
    ["com.affine.rootAppSidebar.organize.delete-from-folder"](): string;
    /**
      * `Delete the folder will not delete any docs, tags, or collections.`
      */
    ["com.affine.rootAppSidebar.organize.delete.notify-message"](): string;
    /**
      * `Delete {{name}}`
      */
    ["com.affine.rootAppSidebar.organize.delete.notify-title"](options: {
        readonly name: string;
    }): string;
    /**
      * `No folders`
      */
    ["com.affine.rootAppSidebar.organize.empty"](): string;
    /**
      * `Empty folder`
      */
    ["com.affine.rootAppSidebar.organize.empty-folder"](): string;
    /**
      * `Add pages`
      */
    ["com.affine.rootAppSidebar.organize.empty-folder.add-pages"](): string;
    /**
      * `New folder`
      */
    ["com.affine.rootAppSidebar.organize.empty.new-folders-button"](): string;
    /**
      * `Add to favorites`
      */
    ["com.affine.rootAppSidebar.organize.folder-add-favorite"](): string;
    /**
      * `Remove from favorites`
      */
    ["com.affine.rootAppSidebar.organize.folder-rm-favorite"](): string;
    /**
      * `Add Collections`
      */
    ["com.affine.rootAppSidebar.organize.folder.add-collections"](): string;
    /**
      * `New doc`
      */
    ["com.affine.rootAppSidebar.organize.folder.new-doc"](): string;
    /**
      * `Add docs`
      */
    ["com.affine.rootAppSidebar.organize.folder.add-docs"](): string;
    /**
      * `Add others`
      */
    ["com.affine.rootAppSidebar.organize.folder.add-others"](): string;
    /**
      * `Add tags`
      */
    ["com.affine.rootAppSidebar.organize.folder.add-tags"](): string;
    /**
      * `Create a subfolder`
      */
    ["com.affine.rootAppSidebar.organize.folder.create-subfolder"](): string;
    /**
      * `New folder`
      */
    ["com.affine.rootAppSidebar.organize.new-folders"](): string;
    /**
      * `Only folder can be placed on here`
      */
    ["com.affine.rootAppSidebar.organize.root-folder-only"](): string;
    /**
      * `Add More`
      */
    ["com.affine.rootAppSidebar.organize.add-more"](): string;
    /**
      * `Add Folder`
      */
    ["com.affine.rootAppSidebar.organize.add-folder"](): string;
    /**
      * `New Collection`
      */
    ["com.affine.rootAppSidebar.collection.new"](): string;
    /**
      * `Others`
      */
    ["com.affine.rootAppSidebar.others"](): string;
    /**
      * `Only doc can be placed on here`
      */
    ["com.affine.rootAppSidebar.tag.doc-only"](): string;
    /**
      * `Tags`
      */
    ["com.affine.rootAppSidebar.tags"](): string;
    /**
      * `No tags`
      */
    ["com.affine.rootAppSidebar.tags.empty"](): string;
    /**
      * `New tag`
      */
    ["com.affine.rootAppSidebar.tags.empty.new-tag-button"](): string;
    /**
      * `New tag`
      */
    ["com.affine.rootAppSidebar.tags.new-tag"](): string;
    /**
      * `No docs`
      */
    ["com.affine.rootAppSidebar.tags.no-doc"](): string;
    /**
      * `Drag to resize`
      */
    ["com.affine.rootAppSidebar.resize-handle.tooltip.drag"](): string;
    /**
      * `Click to collapse`
      */
    ["com.affine.rootAppSidebar.resize-handle.tooltip.click"](): string;
    /**
      * `Type here ...`
      */
    ["com.affine.search-tags.placeholder"](): string;
    /**
      * `Empty`
      */
    ["com.affine.selectPage.empty"](): string;
    /**
      * `Selected`
      */
    ["com.affine.selectPage.selected"](): string;
    /**
      * `Add include doc`
      */
    ["com.affine.selectPage.title"](): string;
    /**
      * `Search collections...`
      */
    ["com.affine.selector-collection.search.placeholder"](): string;
    /**
      * `Search tags...`
      */
    ["com.affine.selector-tag.search.placeholder"](): string;
    /**
      * `Notifications`
      */
    ["com.affine.setting.notifications"](): string;
    /**
      * `Notifications`
      */
    ["com.affine.setting.notifications.header.title"](): string;
    /**
      * `Choose the types of updates you want to receive and where to get them.`
      */
    ["com.affine.setting.notifications.header.description"](): string;
    /**
      * `Email notifications`
      */
    ["com.affine.setting.notifications.email.title"](): string;
    /**
      * `Mention`
      */
    ["com.affine.setting.notifications.email.mention.title"](): string;
    /**
      * `You will be notified through email when other members of the workspace @ you.`
      */
    ["com.affine.setting.notifications.email.mention.subtitle"](): string;
    /**
      * `Invites`
      */
    ["com.affine.setting.notifications.email.invites.title"](): string;
    /**
      * `Invitation related messages will be sent through emails.`
      */
    ["com.affine.setting.notifications.email.invites.subtitle"](): string;
    /**
      * `Comments`
      */
    ["com.affine.setting.notifications.email.comments.title"](): string;
    /**
      * `You will be notified through email when other members of the workspace comment on your docs.`
      */
    ["com.affine.setting.notifications.email.comments.subtitle"](): string;
    /**
      * `SparkClaw notifications`
      */
    ["com.affine.setting.notifications.sparkclaw.title"](): string;
    /**
      * `Mentions`
      */
    ["com.affine.setting.notifications.sparkclaw.mention.title"](): string;
    /**
      * `Send document and comment mentions to your connected SparkClaw devices.`
      */
    ["com.affine.setting.notifications.sparkclaw.mention.subtitle"](): string;
    /**
      * `Account settings`
      */
    ["com.affine.setting.account"](): string;
    /**
      * `Delete your account from {{server}}`
      */
    ["com.affine.setting.account.delete-from-server"](options: {
        readonly server: string;
    }): string;
    /**
      * `Once deleted, your account will no longer be accessible, and all data in your personal space on the server will be permanently deleted.`
      */
    ["com.affine.setting.account.delete.message"](): string;
    /**
      * `Cannot delete account`
      */
    ["com.affine.setting.account.delete.team-warning-title"](): string;
    /**
      * `You’re the owner of a team workspace. To delete your account, please delete the workspace or transfer ownership first.`
      */
    ["com.affine.setting.account.delete.team-warning-description"](): string;
    /**
      * `Delete your account?`
      */
    ["com.affine.setting.account.delete.confirm-title"](): string;
    /**
      * `Please type your email to confirm`
      */
    ["com.affine.setting.account.delete.input-placeholder"](): string;
    /**
      * `Delete`
      */
    ["com.affine.setting.account.delete.confirm-button"](): string;
    /**
      * `Account deleted`
      */
    ["com.affine.setting.account.delete.success-title"](): string;
    /**
      * `Your account and server-side data have been deleted.`
      */
    ["com.affine.setting.account.delete.success-description-1"](): string;
    /**
      * `Local data can be deleted by uninstalling app and clearing browser data.`
      */
    ["com.affine.setting.account.delete.success-description-2"](): string;
    /**
      * `Your personal information`
      */
    ["com.affine.setting.account.message"](): string;
    /**
      * `Sync with LocalMind`
      */
    ["com.affine.setting.sign.message"](): string;
    /**
      * `Securely sign out of your account.`
      */
    ["com.affine.setting.sign.out.message"](): string;
    /**
      * `General`
      */
    ["com.affine.settingSidebar.settings.general"](): string;
    /**
      * `Workspace`
      */
    ["com.affine.settingSidebar.settings.workspace"](): string;
    /**
      * `Settings`
      */
    ["com.affine.settingSidebar.title"](): string;
    /**
      * `Appearance`
      */
    ["com.affine.settings.appearance"](): string;
    /**
      * `Customise the appearance of the client.`
      */
    ["com.affine.settings.appearance.border-style-description"](): string;
    /**
      * `Customise your date style.`
      */
    ["com.affine.settings.appearance.date-format-description"](): string;
    /**
      * `Maximum display of content within a doc.`
      */
    ["com.affine.settings.appearance.full-width-description"](): string;
    /**
      * `Select the language for the interface.`
      */
    ["com.affine.settings.appearance.language-description"](): string;
    /**
      * `By default, the week starts on Sunday.`
      */
    ["com.affine.settings.appearance.start-week-description"](): string;
    /**
      * `Customise appearance of Windows Client.`
      */
    ["com.affine.settings.appearance.window-frame-description"](): string;
    /**
      * `Links`
      */
    ["com.affine.setting.appearance.links"](): string;
    /**
      * `Open LocalMind links`
      */
    ["com.affine.setting.appearance.open-in-app"](): string;
    /**
      * `You can choose to open the link in the desktop app or directly in the browser.`
      */
    ["com.affine.setting.appearance.open-in-app.hint"](): string;
    /**
      * `Ask me each time`
      */
    ["com.affine.setting.appearance.open-in-app.always-ask"](): string;
    /**
      * `Open links in desktop app`
      */
    ["com.affine.setting.appearance.open-in-app.open-in-desktop-app"](): string;
    /**
      * `Open links in browser`
      */
    ["com.affine.setting.appearance.open-in-app.open-in-web"](): string;
    /**
      * `Open LocalMind links`
      */
    ["com.affine.setting.appearance.open-in-app.title"](): string;
    /**
      * `Open this doc in LocalMind app`
      */
    ["com.affine.open-in-app.card.title"](): string;
    /**
      * `Open in app`
      */
    ["com.affine.open-in-app.card.button.open"](): string;
    /**
      * `Dismiss`
      */
    ["com.affine.open-in-app.card.button.dismiss"](): string;
    /**
      * `Remember choice`
      */
    ["com.affine.open-in-app.card.remember"](): string;
    /**
      * `Download desktop app`
      */
    ["com.affine.open-in-app.card.download"](): string;
    /**
      * `If enabled, it will automatically check for new versions at regular intervals.`
      */
    ["com.affine.settings.auto-check-description"](): string;
    /**
      * `If enabled, new versions will be automatically downloaded to the current device.`
      */
    ["com.affine.settings.auto-download-description"](): string;
    /**
      * `Editor`
      */
    ["com.affine.settings.editorSettings"](): string;
    /**
      * `Edgeless`
      */
    ["com.affine.settings.editorSettings.edgeless"](): string;
    /**
      * `Connector`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter"](): string;
    /**
      * `Border style`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.border-style"](): string;
    /**
      * `Border thickness`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.border-thickness"](): string;
    /**
      * `Color`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.color"](): string;
    /**
      * `Connector shape`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.connector-shape"](): string;
    /**
      * `Curve`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.connector-shape.curve"](): string;
    /**
      * `Elbowed`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.connector-shape.elbowed"](): string;
    /**
      * `Straight`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.connector-shape.straight"](): string;
    /**
      * `End endpoint`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.end-endpoint"](): string;
    /**
      * `Start endpoint`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.start-endpoint"](): string;
    /**
      * `Custom`
      */
    ["com.affine.settings.editorSettings.edgeless.custom"](): string;
    /**
      * `Mind Map`
      */
    ["com.affine.settings.editorSettings.edgeless.mind-map"](): string;
    /**
      * `Layout`
      */
    ["com.affine.settings.editorSettings.edgeless.mind-map.layout"](): string;
    /**
      * `Left`
      */
    ["com.affine.settings.editorSettings.edgeless.mind-map.layout.left"](): string;
    /**
      * `Radial`
      */
    ["com.affine.settings.editorSettings.edgeless.mind-map.layout.radial"](): string;
    /**
      * `Right`
      */
    ["com.affine.settings.editorSettings.edgeless.mind-map.layout.right"](): string;
    /**
      * `Note`
      */
    ["com.affine.settings.editorSettings.edgeless.note"](): string;
    /**
      * `Background`
      */
    ["com.affine.settings.editorSettings.edgeless.note.background"](): string;
    /**
      * `Border style`
      */
    ["com.affine.settings.editorSettings.edgeless.note.border"](): string;
    /**
      * `Border thickness`
      */
    ["com.affine.settings.editorSettings.edgeless.note.border-thickness"](): string;
    /**
      * `Dash`
      */
    ["com.affine.settings.editorSettings.edgeless.note.border.dash"](): string;
    /**
      * `None`
      */
    ["com.affine.settings.editorSettings.edgeless.note.border.none"](): string;
    /**
      * `Solid`
      */
    ["com.affine.settings.editorSettings.edgeless.note.border.solid"](): string;
    /**
      * `Corners`
      */
    ["com.affine.settings.editorSettings.edgeless.note.corners"](): string;
    /**
      * `Shadow style`
      */
    ["com.affine.settings.editorSettings.edgeless.note.shadow"](): string;
    /**
      * `Pen`
      */
    ["com.affine.settings.editorSettings.edgeless.pen"](): string;
    /**
      * `Color`
      */
    ["com.affine.settings.editorSettings.edgeless.pen.color"](): string;
    /**
      * `Thickness`
      */
    ["com.affine.settings.editorSettings.edgeless.pen.thickness"](): string;
    /**
      * `Shape`
      */
    ["com.affine.settings.editorSettings.edgeless.shape"](): string;
    /**
      * `Border color`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.border-color"](): string;
    /**
      * `Border style`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.border-style"](): string;
    /**
      * `Border thickness`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.border-thickness"](): string;
    /**
      * `Diamond`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.diamond"](): string;
    /**
      * `Ellipse`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.ellipse"](): string;
    /**
      * `Fill color`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.fill-color"](): string;
    /**
      * `Flow`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.flow"](): string;
    /**
      * `Font`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.font"](): string;
    /**
      * `Font size`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.font-size"](): string;
    /**
      * `Font style`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.font-style"](): string;
    /**
      * `List`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.list"](): string;
    /**
      * `Rounded Rectangle`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.rounded-rectangle"](): string;
    /**
      * `Square`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.square"](): string;
    /**
      * `Text alignment`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.text-alignment"](): string;
    /**
      * `Text color`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.text-color"](): string;
    /**
      * `Triangle`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.triangle"](): string;
    /**
      * `Frame`
      */
    ["com.affine.settings.editorSettings.edgeless.frame"](): string;
    /**
      * `Background`
      */
    ["com.affine.settings.editorSettings.edgeless.frame.background"](): string;
    /**
      * `Style`
      */
    ["com.affine.settings.editorSettings.edgeless.style"](): string;
    /**
      * `General`
      */
    ["com.affine.settings.editorSettings.edgeless.style.general"](): string;
    /**
      * `Scribbled`
      */
    ["com.affine.settings.editorSettings.edgeless.style.scribbled"](): string;
    /**
      * `Text`
      */
    ["com.affine.settings.editorSettings.edgeless.text"](): string;
    /**
      * `Alignment`
      */
    ["com.affine.settings.editorSettings.edgeless.text.alignment"](): string;
    /**
      * `Center`
      */
    ["com.affine.settings.editorSettings.edgeless.text.alignment.center"](): string;
    /**
      * `Left`
      */
    ["com.affine.settings.editorSettings.edgeless.text.alignment.left"](): string;
    /**
      * `Right`
      */
    ["com.affine.settings.editorSettings.edgeless.text.alignment.right"](): string;
    /**
      * `Text color`
      */
    ["com.affine.settings.editorSettings.edgeless.text.color"](): string;
    /**
      * `Font`
      */
    ["com.affine.settings.editorSettings.edgeless.text.font"](): string;
    /**
      * `Font family`
      */
    ["com.affine.settings.editorSettings.edgeless.text.font-family"](): string;
    /**
      * `Font size`
      */
    ["com.affine.settings.editorSettings.edgeless.text.font-size"](): string;
    /**
      * `Font style`
      */
    ["com.affine.settings.editorSettings.edgeless.text.font-style"](): string;
    /**
      * `Font weight`
      */
    ["com.affine.settings.editorSettings.edgeless.text.font-weight"](): string;
    /**
      * `General`
      */
    ["com.affine.settings.editorSettings.general"](): string;
    /**
      * `Enable the powerful AI assistant, LocalMind AI.`
      */
    ["com.affine.settings.editorSettings.general.ai.description"](): string;
    /**
      * `Disable AI and Reload`
      */
    ["com.affine.settings.editorSettings.general.ai.disable.confirm"](): string;
    /**
      * `Are you sure you want to disable AI? We value your productivity and our AI can enhance it. Please think again!`
      */
    ["com.affine.settings.editorSettings.general.ai.disable.description"](): string;
    /**
      * `Disable AI?`
      */
    ["com.affine.settings.editorSettings.general.ai.disable.title"](): string;
    /**
      * `Enable AI and Reload`
      */
    ["com.affine.settings.editorSettings.general.ai.enable.confirm"](): string;
    /**
      * `Do you want to enable AI? Our AI assistant is ready to enhance your productivity and provide smart assistance. Let's get started! We need reload page to make this change.`
      */
    ["com.affine.settings.editorSettings.general.ai.enable.description"](): string;
    /**
      * `Enable AI?`
      */
    ["com.affine.settings.editorSettings.general.ai.enable.title"](): string;
    /**
      * `LocalMind AI`
      */
    ["com.affine.settings.editorSettings.general.ai.title"](): string;
    /**
      * `Set a default programming language.`
      */
    ["com.affine.settings.editorSettings.general.default-code-block.language.description"](): string;
    /**
      * `Code blocks default language`
      */
    ["com.affine.settings.editorSettings.general.default-code-block.language.title"](): string;
    /**
      * `Show line numbers in all code blocks by default.`
      */
    ["com.affine.settings.editorSettings.general.default-code-block.line-numbers.description"](): string;
    /**
      * `Show line numbers in code blocks`
      */
    ["com.affine.settings.editorSettings.general.default-code-block.line-numbers.title"](): string;
    /**
      * `Encapsulate code snippets for better readability.`
      */
    ["com.affine.settings.editorSettings.general.default-code-block.wrap.description"](): string;
    /**
      * `Wrap code in code blocks`
      */
    ["com.affine.settings.editorSettings.general.default-code-block.wrap.title"](): string;
    /**
      * `Default mode for new doc.`
      */
    ["com.affine.settings.editorSettings.general.default-new-doc.description"](): string;
    /**
      * `New doc default mode`
      */
    ["com.affine.settings.editorSettings.general.default-new-doc.title"](): string;
    /**
      * `Auto-title new docs with current date`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.title"](): string;
    /**
      * `Automatically title blank new docs with today's date.`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.description"](): string;
    /**
      * `New doc date format`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.title"](): string;
    /**
      * `Choose the date format used for automatic new doc titles.`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.description"](): string;
    /**
      * `DD-MM-YYYY`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.dd-mm-yyyy"](): string;
    /**
      * `MM-DD-YYYY`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.mm-dd-yyyy"](): string;
    /**
      * `YYYY-MM-DD`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.yyyy-mm-dd"](): string;
    /**
      * `Journal style (localized)`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.journal"](): string;
    /**
      * `Display add icon option`
      */
    ["com.affine.settings.editorSettings.general.add-icon-option.title"](): string;
    /**
      * `Show or hide the add icon option for docs without an icon.`
      */
    ["com.affine.settings.editorSettings.general.add-icon-option.description"](): string;
    /**
      * `Customize your text experience.`
      */
    ["com.affine.settings.editorSettings.general.font-family.custom.description"](): string;
    /**
      * `Custom font family`
      */
    ["com.affine.settings.editorSettings.general.font-family.custom.title"](): string;
    /**
      * `Choose your editor's font family.`
      */
    ["com.affine.settings.editorSettings.general.font-family.description"](): string;
    /**
      * `Font family`
      */
    ["com.affine.settings.editorSettings.general.font-family.title"](): string;
    /**
      * `Adjust the base font size for better readability.`
      */
    ["com.affine.settings.editorSettings.general.font-size.description"](): string;
    /**
      * `Font size`
      */
    ["com.affine.settings.editorSettings.general.font-size.title"](): string;
    /**
      * `Automatically detect and correct spelling errors.`
      */
    ["com.affine.settings.editorSettings.general.spell-check.description"](): string;
    /**
      * `Spell check`
      */
    ["com.affine.settings.editorSettings.general.spell-check.title"](): string;
    /**
      * `Page`
      */
    ["com.affine.settings.editorSettings.page"](): string;
    /**
      * `Middle click paste`
      */
    ["com.affine.settings.editorSettings.general.middle-click-paste.title"](): string;
    /**
      * `Enable default middle click paste behavior on Linux.`
      */
    ["com.affine.settings.editorSettings.general.middle-click-paste.description"](): string;
    /**
      * `Display bi-directional links on the doc.`
      */
    ["com.affine.settings.editorSettings.page.display-bi-link.description"](): string;
    /**
      * `Display bi-directional links`
      */
    ["com.affine.settings.editorSettings.page.display-bi-link.title"](): string;
    /**
      * `Display document information on the doc.`
      */
    ["com.affine.settings.editorSettings.page.display-doc-info.description"](): string;
    /**
      * `Display doc info`
      */
    ["com.affine.settings.editorSettings.page.display-doc-info.title"](): string;
    /**
      * `Maximise display of content within a page.`
      */
    ["com.affine.settings.editorSettings.page.full-width.description"](): string;
    /**
      * `Full width layout`
      */
    ["com.affine.settings.editorSettings.page.full-width.title"](): string;
    /**
      * `Default page width`
      */
    ["com.affine.settings.editorSettings.page.default-page-width.title"](): string;
    /**
      * `Set default width for new pages, individual pages can override.`
      */
    ["com.affine.settings.editorSettings.page.default-page-width.description"](): string;
    /**
      * `Standard`
      */
    ["com.affine.settings.editorSettings.page.default-page-width.standard"](): string;
    /**
      * `Full width`
      */
    ["com.affine.settings.editorSettings.page.default-page-width.full-width"](): string;
    /**
      * `Set edgeless default color scheme.`
      */
    ["com.affine.settings.editorSettings.page.edgeless-default-theme.description"](): string;
    /**
      * `Edgeless default theme`
      */
    ["com.affine.settings.editorSettings.page.edgeless-default-theme.title"](): string;
    /**
      * `Specified by current color mode`
      */
    ["com.affine.settings.editorSettings.page.edgeless-default-theme.specified"](): string;
    /**
      * `Scroll wheel zoom`
      */
    ["com.affine.settings.editorSettings.page.edgeless-scroll-wheel-zoom.title"](): string;
    /**
      * `Use the scroll wheel to zoom in and out.`
      */
    ["com.affine.settings.editorSettings.page.edgeless-scroll-wheel-zoom.description"](): string;
    /**
      * `Preferences`
      */
    ["com.affine.settings.editorSettings.preferences"](): string;
    /**
      * `You can export the entire preferences data for backup, and the exported data can be re-imported.`
      */
    ["com.affine.settings.editorSettings.preferences.export.description"](): string;
    /**
      * `Export Settings`
      */
    ["com.affine.settings.editorSettings.preferences.export.title"](): string;
    /**
      * `You can import previously exported preferences data for restoration.`
      */
    ["com.affine.settings.editorSettings.preferences.import.description"](): string;
    /**
      * `Import Settings`
      */
    ["com.affine.settings.editorSettings.preferences.import.title"](): string;
    /**
      * `Configure your own editor`
      */
    ["com.affine.settings.editorSettings.subtitle"](): string;
    /**
      * `Editor settings`
      */
    ["com.affine.settings.editorSettings.title"](): string;
    /**
      * `Ask me every time`
      */
    ["com.affine.settings.editorSettings.ask-me-every-time"](): string;
    /**
      * `Email`
      */
    ["com.affine.settings.email"](): string;
    /**
      * `Change email`
      */
    ["com.affine.settings.email.action"](): string;
    /**
      * `Change email`
      */
    ["com.affine.settings.email.action.change"](): string;
    /**
      * `Verify email`
      */
    ["com.affine.settings.email.action.verify"](): string;
    /**
      * `Enable LocalMind Sync to collaborate with others`
      */
    ["com.affine.settings.member-tooltip"](): string;
    /**
      * `Loading member list...`
      */
    ["com.affine.settings.member.loading"](): string;
    /**
      * `Noise background on the sidebar`
      */
    ["com.affine.settings.noise-style"](): string;
    /**
      * `Use background noise effect on the sidebar.`
      */
    ["com.affine.settings.noise-style-description"](): string;
    /**
      * `Password`
      */
    ["com.affine.settings.password"](): string;
    /**
      * `Change password`
      */
    ["com.affine.settings.password.action.change"](): string;
    /**
      * `Set password`
      */
    ["com.affine.settings.password.action.set"](): string;
    /**
      * `Set a password to sign in to your account`
      */
    ["com.affine.settings.password.message"](): string;
    /**
      * `My profile`
      */
    ["com.affine.settings.profile"](): string;
    /**
      * `Your account profile will be displayed to everyone.`
      */
    ["com.affine.settings.profile.message"](): string;
    /**
      * `Display name`
      */
    ["com.affine.settings.profile.name"](): string;
    /**
      * `Input account name`
      */
    ["com.affine.settings.profile.placeholder"](): string;
    /**
      * `Remove workspace`
      */
    ["com.affine.settings.remove-workspace"](): string;
    /**
      * `Remove workspace from this device and optionally delete all data.`
      */
    ["com.affine.settings.remove-workspace-description"](): string;
    /**
      * `Sign in / Sign up`
      */
    ["com.affine.settings.sign"](): string;
    /**
      * `Need more customization options? Tell us in the community.`
      */
    ["com.affine.settings.suggestion"](): string;
    /**
      * `Translucent UI on the sidebar`
      */
    ["com.affine.settings.translucent-style"](): string;
    /**
      * `Use transparency effect on the sidebar.`
      */
    ["com.affine.settings.translucent-style-description"](): string;
    /**
      * `Meetings`
      */
    ["com.affine.settings.meetings"](): string;
    /**
      * `Beyond Recording
    Your AI Meeting Assistant is Here`
      */
    ["com.affine.settings.meetings.setting.welcome"](): string;
    /**
      * `Native Audio Capture, No Bots Required - Direct from Your Mac to Meeting Intelligence.`
      */
    ["com.affine.settings.meetings.setting.prompt"](): string;
    /**
      * `Learn more`
      */
    ["com.affine.settings.meetings.setting.welcome.learn-more"](): string;
    /**
      * `Enable meeting notes`
      */
    ["com.affine.settings.meetings.enable.title"](): string;
    /**
      * `Meeting recording`
      */
    ["com.affine.settings.meetings.record.header"](): string;
    /**
      * `When meeting starts`
      */
    ["com.affine.settings.meetings.record.recording-mode"](): string;
    /**
      * `Choose the behavior when the meeting starts.`
      */
    ["com.affine.settings.meetings.record.recording-mode.description"](): string;
    /**
      * `Open saved recordings`
      */
    ["com.affine.settings.meetings.record.open-saved-file"](): string;
    /**
      * `Open the locally stored recording files.`
      */
    ["com.affine.settings.meetings.record.open-saved-file.description"](): string;
    /**
      * `Transcription with AI`
      */
    ["com.affine.settings.meetings.transcription.header"](): string;
    /**
      * `AI auto summary`
      */
    ["com.affine.settings.meetings.transcription.auto-summary"](): string;
    /**
      * `Automatically generate a summary of the meeting notes.`
      */
    ["com.affine.settings.meetings.transcription.auto-summary.description"](): string;
    /**
      * `AI auto todo list`
      */
    ["com.affine.settings.meetings.transcription.auto-todo"](): string;
    /**
      * `Automatically generate a todo list of the meeting notes.`
      */
    ["com.affine.settings.meetings.transcription.auto-todo.description"](): string;
    /**
      * `Privacy & Security`
      */
    ["com.affine.settings.meetings.privacy.header"](): string;
    /**
      * `Screen & System audio recording`
      */
    ["com.affine.settings.meetings.privacy.screen-system-audio-recording"](): string;
    /**
      * `The Meeting feature requires permission to be used.`
      */
    ["com.affine.settings.meetings.privacy.screen-system-audio-recording.description"](): string;
    /**
      * `Click to allow`
      */
    ["com.affine.settings.meetings.privacy.screen-system-audio-recording.permission-setting"](): string;
    /**
      * `Microphone`
      */
    ["com.affine.settings.meetings.privacy.microphone"](): string;
    /**
      * `The Meeting feature requires permission to be used.`
      */
    ["com.affine.settings.meetings.privacy.microphone.description"](): string;
    /**
      * `Click to allow`
      */
    ["com.affine.settings.meetings.privacy.microphone.permission-setting"](): string;
    /**
      * `Permission issues`
      */
    ["com.affine.settings.meetings.privacy.issues"](): string;
    /**
      * `Permissions are granted but the status isn't updated? Restart the app to refresh permissions.`
      */
    ["com.affine.settings.meetings.privacy.issues.description"](): string;
    /**
      * `Restart App`
      */
    ["com.affine.settings.meetings.privacy.issues.restart"](): string;
    /**
      * `Do nothing`
      */
    ["com.affine.settings.meetings.record.recording-mode.none"](): string;
    /**
      * `Auto start recording`
      */
    ["com.affine.settings.meetings.record.recording-mode.auto-start"](): string;
    /**
      * `Show a recording prompt`
      */
    ["com.affine.settings.meetings.record.recording-mode.prompt"](): string;
    /**
      * `Screen & System Audio Recording`
      */
    ["com.affine.settings.meetings.record.permission-modal.title"](): string;
    /**
      * `LocalMind will generate meeting notes by recording your meetings. Authorization to "Screen & System Audio Recording" is necessary.`
      */
    ["com.affine.settings.meetings.record.permission-modal.description"](): string;
    /**
      * `Save meeting's recording block to`
      */
    ["com.affine.settings.meetings.record.save-mode"](): string;
    /**
      * `Open System Settings`
      */
    ["com.affine.settings.meetings.record.permission-modal.open-setting"](): string;
    /**
      * `Workspace`
      */
    ["com.affine.settings.workspace"](): string;
    /**
      * `You can view current workspace's information here.`
      */
    ["com.affine.settings.workspace.description"](): string;
    /**
      * `Experimental features`
      */
    ["com.affine.settings.workspace.experimental-features"](): string;
    /**
      * `Get started`
      */
    ["com.affine.settings.workspace.experimental-features.get-started"](): string;
    /**
      * `Experimental features`
      */
    ["com.affine.settings.workspace.experimental-features.header.plugins"](): string;
    /**
      * `Some features available for early access`
      */
    ["com.affine.settings.workspace.experimental-features.header.subtitle"](): string;
    /**
      * `I am aware of the risks, and I am willing to continue to use it.`
      */
    ["com.affine.settings.workspace.experimental-features.prompt-disclaimer"](): string;
    /**
      * `Do you want to use the plugin system that is in an experimental stage?`
      */
    ["com.affine.settings.workspace.experimental-features.prompt-header"](): string;
    /**
      * `You are about to enable an experimental feature. This feature is still in development and may contain errors or behave unpredictably. Please proceed with caution and at your own risk.`
      */
    ["com.affine.settings.workspace.experimental-features.prompt-warning"](): string;
    /**
      * `WARNING MESSAGE`
      */
    ["com.affine.settings.workspace.experimental-features.prompt-warning-title"](): string;
    /**
      * `Enable AI`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai.name"](): string;
    /**
      * `Enable or disable ALL AI features.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai.description"](): string;
    /**
      * `Enable AI Network Search`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-network-search.name"](): string;
    /**
      * `Enable or disable AI Network Search feature.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-network-search.description"](): string;
    /**
      * `Enable AI Model Switch`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-model-switch.name"](): string;
    /**
      * `Enable or disable AI model switch feature.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-model-switch.description"](): string;
    /**
      * `Enable AI Playground`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-playground.name"](): string;
    /**
      * `Enable or disable AI playground feature.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-playground.description"](): string;
    /**
      * `Database Full Width`
      */
    ["com.affine.settings.workspace.experimental-features.enable-database-full-width.name"](): string;
    /**
      * `The database will be displayed in full-width mode.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-database-full-width.description"](): string;
    /**
      * `Database Attachment Note`
      */
    ["com.affine.settings.workspace.experimental-features.enable-database-attachment-note.name"](): string;
    /**
      * `Allows adding notes to database attachments.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-database-attachment-note.description"](): string;
    /**
      * `Todo Block Query`
      */
    ["com.affine.settings.workspace.experimental-features.enable-block-query.name"](): string;
    /**
      * `Enables querying of todo blocks.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-block-query.description"](): string;
    /**
      * `Synced Doc Block`
      */
    ["com.affine.settings.workspace.experimental-features.enable-synced-doc-block.name"](): string;
    /**
      * `Enables syncing of doc blocks.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-synced-doc-block.description"](): string;
    /**
      * `Edgeless Text`
      */
    ["com.affine.settings.workspace.experimental-features.enable-edgeless-text.name"](): string;
    /**
      * `Enables edgeless text blocks.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-edgeless-text.description"](): string;
    /**
      * `Color Picker`
      */
    ["com.affine.settings.workspace.experimental-features.enable-color-picker.name"](): string;
    /**
      * `Enables color picker blocks.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-color-picker.description"](): string;
    /**
      * `AI Chat Block`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-chat-block.name"](): string;
    /**
      * `Enables AI chat blocks.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-chat-block.description"](): string;
    /**
      * `AI Onboarding`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-onboarding.name"](): string;
    /**
      * `Enables AI onboarding.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-onboarding.description"](): string;
    /**
      * `Mind Map Import`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mind-map-import.name"](): string;
    /**
      * `Enables mind map import.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mind-map-import.description"](): string;
    /**
      * `Block Meta`
      */
    ["com.affine.settings.workspace.experimental-features.enable-block-meta.name"](): string;
    /**
      * `Once enabled, all blocks will have created time, updated time, created by and updated by.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-block-meta.description"](): string;
    /**
      * `Callout`
      */
    ["com.affine.settings.workspace.experimental-features.enable-callout.name"](): string;
    /**
      * `Let your words stand out. This also include the callout in the transcription block.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-callout.description"](): string;
    /**
      * `Embed Iframe Block`
      */
    ["com.affine.settings.workspace.experimental-features.enable-embed-iframe-block.name"](): string;
    /**
      * `Enables Embed Iframe Block.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-embed-iframe-block.description"](): string;
    /**
      * `Emoji Folder Icon`
      */
    ["com.affine.settings.workspace.experimental-features.enable-emoji-folder-icon.name"](): string;
    /**
      * `Once enabled, you can use an emoji as the folder icon. When the first character of the folder name is an emoji, it will be extracted and used as its icon.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-emoji-folder-icon.description"](): string;
    /**
      * `Emoji Doc Icon`
      */
    ["com.affine.settings.workspace.experimental-features.enable-emoji-doc-icon.name"](): string;
    /**
      * `Once enabled, you can use an emoji as the doc icon. When the first character of the doc name is an emoji, it will be extracted and used as its icon.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-emoji-doc-icon.description"](): string;
    /**
      * `Editor Settings`
      */
    ["com.affine.settings.workspace.experimental-features.enable-editor-settings.name"](): string;
    /**
      * `Enables editor settings.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-editor-settings.description"](): string;
    /**
      * `Theme Editor`
      */
    ["com.affine.settings.workspace.experimental-features.enable-theme-editor.name"](): string;
    /**
      * `Enables theme editor.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-theme-editor.description"](): string;
    /**
      * `Allow create local workspace`
      */
    ["com.affine.settings.workspace.experimental-features.enable-local-workspace.name"](): string;
    /**
      * `Allow create local workspace`
      */
    ["com.affine.settings.workspace.experimental-features.enable-local-workspace.description"](): string;
    /**
      * `Advanced block visibility control`
      */
    ["com.affine.settings.workspace.experimental-features.enable-advanced-block-visibility.name"](): string;
    /**
      * `To provide detailed control over which edgeless blocks are visible in page mode.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-advanced-block-visibility.description"](): string;
    /**
      * `Mobile Keyboard Toolbar`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-keyboard-toolbar.name"](): string;
    /**
      * `Enables the mobile keyboard toolbar.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-keyboard-toolbar.description"](): string;
    /**
      * `Mobile Linked Doc Widget`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-linked-doc-menu.name"](): string;
    /**
      * `Enables the mobile linked doc menu.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-linked-doc-menu.description"](): string;
    /**
      * `Enable Snapshot Import Export`
      */
    ["com.affine.settings.workspace.experimental-features.enable-snapshot-import-export.name"](): string;
    /**
      * `Once enabled, users can import and export blocksuite snapshots.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-snapshot-import-export.description"](): string;
    /**
      * `Enable Edgeless Editing`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-edgeless-editing.name"](): string;
    /**
      * `Once enabled, users can edit edgeless canvas.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-edgeless-editing.description"](): string;
    /**
      * `PDF embed preview`
      */
    ["com.affine.settings.workspace.experimental-features.enable-pdf-embed-preview.name"](): string;
    /**
      * `Once enabled, you can preview PDF in embed view.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-pdf-embed-preview.description"](): string;
    /**
      * `Audio block`
      */
    ["com.affine.settings.workspace.experimental-features.enable-audio-block.name"](): string;
    /**
      * `Audio block allows you to play audio files globally and add notes to them.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-audio-block.description"](): string;
    /**
      * `Meetings`
      */
    ["com.affine.settings.workspace.experimental-features.enable-meetings.name"](): string;
    /**
      * `Meetings allows you to record and transcribe meetings. Don't forget to enable it in LocalMind settings.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-meetings.description"](): string;
    /**
      * `Editor RTL`
      */
    ["com.affine.settings.workspace.experimental-features.enable-editor-rtl.name"](): string;
    /**
      * `Once enabled, the editor will be displayed in RTL mode.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-editor-rtl.description"](): string;
    /**
      * `Edgeless scribbled style`
      */
    ["com.affine.settings.workspace.experimental-features.enable-edgeless-scribbled-style.name"](): string;
    /**
      * `Once enabled, you can use scribbled style in edgeless mode.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-edgeless-scribbled-style.description"](): string;
    /**
      * `Database block table view virtual scroll`
      */
    ["com.affine.settings.workspace.experimental-features.enable-table-virtual-scroll.name"](): string;
    /**
      * `Once enabled, switch table view to virtual scroll mode in Database Block.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-table-virtual-scroll.description"](): string;
    /**
      * `Code block HTML preview`
      */
    ["com.affine.settings.workspace.experimental-features.enable-code-block-html-preview.name"](): string;
    /**
      * `Once enabled, you can preview HTML in code block.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-code-block-html-preview.description"](): string;
    /**
      * `Adapter Panel`
      */
    ["com.affine.settings.workspace.experimental-features.enable-adapter-panel.name"](): string;
    /**
      * `Once enabled, you can preview adapter export content in the right side bar.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-adapter-panel.description"](): string;
    /**
      * `Send detailed object information to AI`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-send-detailed-object.name"](): string;
    /**
      * `When toggled off, every time you choose "Continue with AI", AI only got a screenshot.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-send-detailed-object.description"](): string;
    /**
      * `Only an owner can edit the workspace avatar and name. Changes will be shown for everyone.`
      */
    ["com.affine.settings.workspace.not-owner"](): string;
    /**
      * `Preference`
      */
    ["com.affine.settings.workspace.preferences"](): string;
    /**
      * `Team's Billing`
      */
    ["com.affine.settings.workspace.billing"](): string;
    /**
      * `Team Workspace`
      */
    ["com.affine.settings.workspace.billing.team-workspace"](): string;
    /**
      * `Your workspace is in a free trail period.`
      */
    ["com.affine.settings.workspace.billing.team-workspace.description.free-trail"](): string;
    /**
      * `Your workspace is billed annually.`
      */
    ["com.affine.settings.workspace.billing.team-workspace.description.billed.annually"](): string;
    /**
      * `Your workspace is billed monthly.`
      */
    ["com.affine.settings.workspace.billing.team-workspace.description.billed.monthly"](): string;
    /**
      * `Your subscription will end on {{date}}`
      */
    ["com.affine.settings.workspace.billing.team-workspace.not-renewed"](options: {
        readonly date: string;
    }): string;
    /**
      * `Next billing date: {{date}}`
      */
    ["com.affine.settings.workspace.billing.team-workspace.next-billing-date"](options: {
        readonly date: string;
    }): string;
    /**
      * `Cancel Plan`
      */
    ["com.affine.settings.workspace.billing.team-workspace.cancel-plan"](): string;
    /**
      * `License`
      */
    ["com.affine.settings.workspace.license"](): string;
    /**
      * `Manage license information and invoices for the self host team workspace.`
      */
    ["com.affine.settings.workspace.license.description"](): string;
    /**
      * `Get teams plan for your self hosted workspace.`
      */
    ["com.affine.settings.workspace.license.benefit.team.title"](): string;
    /**
      * `Need more seats? Best for scalable teams.`
      */
    ["com.affine.settings.workspace.license.benefit.team.subtitle"](): string;
    /**
      * `Everything in Self Hosted FOSS`
      */
    ["com.affine.settings.workspace.license.benefit.team.g1"](): string;
    /**
      * `{{initialQuota}} initial storage + {{quotaPerSeat}} per seat`
      */
    ["com.affine.settings.workspace.license.benefit.team.g2"](options: Readonly<{
        initialQuota: string;
        quotaPerSeat: string;
    }>): string;
    /**
      * `{{quota}} of maximum file size`
      */
    ["com.affine.settings.workspace.license.benefit.team.g3"](options: {
        readonly quota: string;
    }): string;
    /**
      * `Unlimited team members (10+ seats)`
      */
    ["com.affine.settings.workspace.license.benefit.team.g4"](): string;
    /**
      * `Multiple admin roles`
      */
    ["com.affine.settings.workspace.license.benefit.team.g5"](): string;
    /**
      * `Priority customer support`
      */
    ["com.affine.settings.workspace.license.benefit.team.g6"](): string;
    /**
      * `Learn more`
      */
    ["com.affine.settings.workspace.license.learn-more"](): string;
    /**
      * `Selfhosted workspace`
      */
    ["com.affine.settings.workspace.license.self-host"](): string;
    /**
      * `Self-host Team Workspace`
      */
    ["com.affine.settings.workspace.license.self-host-team"](): string;
    /**
      * `This license will expire on {{expirationDate}}, with {{leftDays}} days remaining.`
      */
    ["com.affine.settings.workspace.license.self-host-team.team.description"](options: Readonly<{
        expirationDate: string;
        leftDays: string;
    }>): string;
    /**
      * `Basic version: {{memberCount}} seats. For more, purchase or use activation key.`
      */
    ["com.affine.settings.workspace.license.self-host-team.free.description"](options: {
        readonly memberCount: string;
    }): string;
    /**
      * `Seats`
      */
    ["com.affine.settings.workspace.license.self-host-team.seats"](): string;
    /**
      * `Use purchased key`
      */
    ["com.affine.settings.workspace.license.self-host-team.use-purchased-key"](): string;
    /**
      * `Upload license file`
      */
    ["com.affine.settings.workspace.license.self-host-team.upload-license-file"](): string;
    /**
      * `Upload license file locally and verify the license information.`
      */
    ["com.affine.settings.workspace.license.self-host-team.upload-license-file.description"](): string;
    /**
      * `To purchase a license:`
      */
    ["com.affine.settings.workspace.license.self-host-team.upload-license-file.tips.title"](): string;
    /**
      * `Workspace id`
      */
    ["com.affine.settings.workspace.license.self-host-team.upload-license-file.tips.workspace-id"](): string;
    /**
      * `Click to upload`
      */
    ["com.affine.settings.workspace.license.self-host-team.upload-license-file.click-to-upload"](): string;
    /**
      * `Activation failed`
      */
    ["com.affine.settings.workspace.license.self-host-team.upload-license-file.failed"](): string;
    /**
      * `Activation Success`
      */
    ["com.affine.settings.workspace.license.self-host-team.upload-license-file.success.title"](): string;
    /**
      * `License has been successfully applied`
      */
    ["com.affine.settings.workspace.license.self-host-team.upload-license-file.success.description"](): string;
    /**
      * `If you encounter any issues, contact LocalMind support.`
      */
    ["com.affine.settings.workspace.license.self-host-team.upload-license-file.help"](): string;
    /**
      * `Deactivate`
      */
    ["com.affine.settings.workspace.license.self-host-team.deactivate-license"](): string;
    /**
      * `Replace your license file`
      */
    ["com.affine.settings.workspace.license.self-host-team.replace-license.title"](): string;
    /**
      * `Replace the existing license file with a new, updated version.`
      */
    ["com.affine.settings.workspace.license.self-host-team.replace-license.description"](): string;
    /**
      * `Upload license file`
      */
    ["com.affine.settings.workspace.license.self-host-team.replace-license.upload"](): string;
    /**
      * `Buy more seat`
      */
    ["com.affine.settings.workspace.license.buy-more-seat"](): string;
    /**
      * `Activate License`
      */
    ["com.affine.settings.workspace.license.activate-modal.title"](): string;
    /**
      * `Enter license key to activate this self host workspace.`
      */
    ["com.affine.settings.workspace.license.activate-modal.description"](): string;
    /**
      * `License activated successfully.`
      */
    ["com.affine.settings.workspace.license.activate-success"](): string;
    /**
      * `Confirm deactivation?`
      */
    ["com.affine.settings.workspace.license.deactivate-modal.title"](): string;
    /**
      * `After deactivation, you will need to upload a new license to continue using team feature`
      */
    ["com.affine.settings.workspace.license.deactivate-modal.description-license"](): string;
    /**
      * `Manage Payment`
      */
    ["com.affine.settings.workspace.license.deactivate-modal.manage-payment"](): string;
    /**
      * `License deactivated successfully.`
      */
    ["com.affine.settings.workspace.license.deactivate-success"](): string;
    /**
      * `Local`
      */
    ["com.affine.settings.workspace.state.local"](): string;
    /**
      * `Sync with LocalMind Cloud`
      */
    ["com.affine.settings.workspace.state.sync-affine-cloud"](): string;
    /**
      * `Self-Hosted Server`
      */
    ["com.affine.settings.workspace.state.self-hosted"](): string;
    /**
      * `Joined Workspace`
      */
    ["com.affine.settings.workspace.state.joined"](): string;
    /**
      * `Available Offline`
      */
    ["com.affine.settings.workspace.state.available-offline"](): string;
    /**
      * `Published to Web`
      */
    ["com.affine.settings.workspace.state.published"](): string;
    /**
      * `Team Workspace`
      */
    ["com.affine.settings.workspace.state.team"](): string;
    /**
      * `Properties`
      */
    ["com.affine.settings.workspace.properties"](): string;
    /**
      * `Add property`
      */
    ["com.affine.settings.workspace.properties.add_property"](): string;
    /**
      * `All`
      */
    ["com.affine.settings.workspace.properties.all"](): string;
    /**
      * `Delete property`
      */
    ["com.affine.settings.workspace.properties.delete-property"](): string;
    /**
      * `Edit property`
      */
    ["com.affine.settings.workspace.properties.edit-property"](): string;
    /**
      * `General properties`
      */
    ["com.affine.settings.workspace.properties.general-properties"](): string;
    /**
      * `Properties`
      */
    ["com.affine.settings.workspace.properties.header.title"](): string;
    /**
      * `In use`
      */
    ["com.affine.settings.workspace.properties.in-use"](): string;
    /**
      * `Readonly properties`
      */
    ["com.affine.settings.workspace.properties.readonly-properties"](): string;
    /**
      * `Required properties`
      */
    ["com.affine.settings.workspace.properties.required-properties"](): string;
    /**
      * `Set as required property`
      */
    ["com.affine.settings.workspace.properties.set-as-required"](): string;
    /**
      * `Unused`
      */
    ["com.affine.settings.workspace.properties.unused"](): string;
    /**
      * `You can view current workspace's storage and files here.`
      */
    ["com.affine.settings.workspace.storage.subtitle"](): string;
    /**
      * `Enable LocalMind Sync to publish this workspace`
      */
    ["com.affine.settings.workspace.publish-tooltip"](): string;
    /**
      * `Sharing`
      */
    ["com.affine.settings.workspace.sharing.title"](): string;
    /**
      * `Allow URL unfurling by Slack & other social apps, even if a doc is only accessible by workspace members.`
      */
    ["com.affine.settings.workspace.sharing.url-preview.description"](): string;
    /**
      * `Always enable url preview`
      */
    ["com.affine.settings.workspace.sharing.url-preview.title"](): string;
    /**
      * `Control whether pages in this workspace can be shared publicly. Turn off to block new shares and external access for existing shares.`
      */
    ["com.affine.settings.workspace.sharing.workspace-sharing.description"](): string;
    /**
      * `Allow workspace page sharing`
      */
    ["com.affine.settings.workspace.sharing.workspace-sharing.title"](): string;
    /**
      * `LocalMind AI`
      */
    ["com.affine.settings.workspace.affine-ai.title"](): string;
    /**
      * `Allow LocalMind AI Assistant`
      */
    ["com.affine.settings.workspace.affine-ai.label"](): string;
    /**
      * `Allow workspace members to use LocalMind AI features. This setting doesn't affect billing. Workspace members use LocalMind AI through their personal accounts.`
      */
    ["com.affine.settings.workspace.affine-ai.description"](): string;
    /**
      * `Archived workspaces`
      */
    ["com.affine.settings.workspace.backup"](): string;
    /**
      * `Manage archived local workspace files`
      */
    ["com.affine.settings.workspace.backup.subtitle"](): string;
    /**
      * `No archived workspace files found`
      */
    ["com.affine.settings.workspace.backup.empty"](): string;
    /**
      * `Delete archived workspace`
      */
    ["com.affine.settings.workspace.backup.delete"](): string;
    /**
      * `Are you sure you want to delete this workspace. This action cannot be undone. Make sure you no longer need them before proceeding.`
      */
    ["com.affine.settings.workspace.backup.delete.warning"](): string;
    /**
      * `Workspace backup deleted successfully`
      */
    ["com.affine.settings.workspace.backup.delete.success"](): string;
    /**
      * `Workspace enabled successfully`
      */
    ["com.affine.settings.workspace.backup.import.success"](): string;
    /**
      * `Enable local workspace`
      */
    ["com.affine.settings.workspace.backup.import"](): string;
    /**
      * `Open`
      */
    ["com.affine.settings.workspace.backup.import.success.action"](): string;
    /**
      * `Deleted on {{date}} at {{time}}`
      */
    ["com.affine.settings.workspace.backup.delete-at"](options: Readonly<{
        date: string;
        time: string;
    }>): string;
    /**
      * `Indexer & Embedding`
      */
    ["com.affine.settings.workspace.indexer-embedding.title"](): string;
    /**
      * `Manage LocalMind indexing and LocalMind AI Embedding for local content processing`
      */
    ["com.affine.settings.workspace.indexer-embedding.description"](): string;
    /**
      * `Embedding`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.title"](): string;
    /**
      * `Embedding allows AI to retrieve your content. If the indexer uses local settings, it may affect some of the results of the Embedding.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.description"](): string;
    /**
      * `Only the workspace owner can enable Workspace Embedding.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.disabled-tooltip"](): string;
    /**
      * `Select doc`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.select-doc"](): string;
    /**
      * `Upload file`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.upload-file"](): string;
    /**
      * `Workspace Embedding`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.switch.title"](): string;
    /**
      * `AI can call files embedded in the workspace.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.switch.description"](): string;
    /**
      * `Failed to update workspace doc embedding enabled`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.switch.error"](): string;
    /**
      * `Failed to remove attachment from embedding`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.remove-attachment.error"](): string;
    /**
      * `Failed to update ignored docs`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.update-ignored-docs.error"](): string;
    /**
      * `Embedding progress`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.progress.title"](): string;
    /**
      * `Syncing`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.progress.syncing"](): string;
    /**
      * `Synced`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.progress.synced"](): string;
    /**
      * `Loading sync status...`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.progress.loading-sync-status"](): string;
    /**
      * `Ignore Docs`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.ignore-docs.title"](): string;
    /**
      * `The Ignored docs will not be embedded into the current workspace.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.ignore-docs.description"](): string;
    /**
      * `Additional attachments`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.title"](): string;
    /**
      * `The uploaded file will be embedded in the current workspace.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.description"](): string;
    /**
      * `Remove the attachment from embedding?`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.remove-attachment.title"](): string;
    /**
      * `Attachment will be removed. AI will not continue to extract content from this attachment.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.remove-attachment.description"](): string;
    /**
      * `Delete File`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.remove-attachment.tooltip"](): string;
    /**
      * `Sharing docs requires LocalMind Sync.`
      */
    ["com.affine.share-menu.EnableCloudDescription"](): string;
    /**
      * `Share mode`
      */
    ["com.affine.share-menu.ShareMode"](): string;
    /**
      * `Share doc`
      */
    ["com.affine.share-menu.SharePage"](): string;
    /**
      * `General access`
      */
    ["com.affine.share-menu.generalAccess"](): string;
    /**
      * `Share via export`
      */
    ["com.affine.share-menu.ShareViaExport"](): string;
    /**
      * `Download a static copy of your doc to share with others`
      */
    ["com.affine.share-menu.ShareViaExportDescription"](): string;
    /**
      * `Print a paper copy`
      */
    ["com.affine.share-menu.ShareViaPrintDescription"](): string;
    /**
      * `Share with link`
      */
    ["com.affine.share-menu.ShareWithLink"](): string;
    /**
      * `Create a link you can easily share with anyone. The visitors will open your doc in the form od a document`
      */
    ["com.affine.share-menu.ShareWithLinkDescription"](): string;
    /**
      * `Shared doc`
      */
    ["com.affine.share-menu.SharedPage"](): string;
    /**
      * `Copy Link`
      */
    ["com.affine.share-menu.copy"](): string;
    /**
      * `Copy private link`
      */
    ["com.affine.share-menu.copy-private-link"](): string;
    /**
      * `Copy Link to Selected Block`
      */
    ["com.affine.share-menu.copy.block"](): string;
    /**
      * `Copy Link to Edgeless Mode`
      */
    ["com.affine.share-menu.copy.edgeless"](): string;
    /**
      * `Copy Link to Selected Frame`
      */
    ["com.affine.share-menu.copy.frame"](): string;
    /**
      * `Copy Link to Page Mode`
      */
    ["com.affine.share-menu.copy.page"](): string;
    /**
      * `You can share this document with link.`
      */
    ["com.affine.share-menu.create-public-link.notification.success.message"](): string;
    /**
      * `Public link created`
      */
    ["com.affine.share-menu.create-public-link.notification.success.title"](): string;
    /**
      * `Please try again later.`
      */
    ["com.affine.share-menu.disable-publish-link.notification.fail.message"](): string;
    /**
      * `Failed to disable public link`
      */
    ["com.affine.share-menu.disable-publish-link.notification.fail.title"](): string;
    /**
      * `This doc is no longer shared publicly.`
      */
    ["com.affine.share-menu.disable-publish-link.notification.success.message"](): string;
    /**
      * `Public link disabled`
      */
    ["com.affine.share-menu.disable-publish-link.notification.success.title"](): string;
    /**
      * `Manage workspace members`
      */
    ["com.affine.share-menu.navigate.workspace"](): string;
    /**
      * `Anyone with the link`
      */
    ["com.affine.share-menu.option.link.label"](): string;
    /**
      * `No access`
      */
    ["com.affine.share-menu.option.link.no-access"](): string;
    /**
      * `Only workspace members can access this link`
      */
    ["com.affine.share-menu.option.link.no-access.description"](): string;
    /**
      * `Read only`
      */
    ["com.affine.share-menu.option.link.readonly"](): string;
    /**
      * `Anyone can access this link`
      */
    ["com.affine.share-menu.option.link.readonly.description"](): string;
    /**
      * `Sharing for this workspace is turned off. Please contact an admin to enable it.`
      */
    ["com.affine.share-menu.workspace-sharing.disabled.tooltip"](): string;
    /**
      * `Can manage`
      */
    ["com.affine.share-menu.option.permission.can-manage"](): string;
    /**
      * `Can edit`
      */
    ["com.affine.share-menu.option.permission.can-edit"](): string;
    /**
      * `Can read`
      */
    ["com.affine.share-menu.option.permission.can-read"](): string;
    /**
      * `No access`
      */
    ["com.affine.share-menu.option.permission.no-access"](): string;
    /**
      * `Members in workspace`
      */
    ["com.affine.share-menu.option.permission.label"](): string;
    /**
      * `Workspace admins and owner automatically have Can manage permissions.`
      */
    ["com.affine.share-menu.option.permission.tips"](): string;
    /**
      * `Publish to web`
      */
    ["com.affine.share-menu.publish-to-web"](): string;
    /**
      * `Share privately`
      */
    ["com.affine.share-menu.share-privately"](): string;
    /**
      * `Share`
      */
    ["com.affine.share-menu.shareButton"](): string;
    /**
      * `Shared`
      */
    ["com.affine.share-menu.sharedButton"](): string;
    /**
      * `{{member1}} and {{member2}} are in this doc`
      */
    ["com.affine.share-menu.member-management.member-count-2"](options: Readonly<{
        member1: string;
        member2: string;
    }>): string;
    /**
      * `{{member1}}, {{member2}} and {{member3}} are in this doc`
      */
    ["com.affine.share-menu.member-management.member-count-3"](options: Readonly<{
        member1: string;
        member2: string;
        member3: string;
    }>): string;
    /**
      * `{{member1}}, {{member2}} and {{memberCount}} others`
      */
    ["com.affine.share-menu.member-management.member-count-more"](options: Readonly<{
        member1: string;
        member2: string;
        memberCount: string;
    }>): string;
    /**
      * `Remove`
      */
    ["com.affine.share-menu.member-management.remove"](): string;
    /**
      * `Set as owner`
      */
    ["com.affine.share-menu.member-management.set-as-owner"](): string;
    /**
      * `Make this person the owner?`
      */
    ["com.affine.share-menu.member-management.set-as-owner.confirm.title"](): string;
    /**
      * `The new owner will be effective immediately, and you might lose access to this doc if other users remove you, please confirm.`
      */
    ["com.affine.share-menu.member-management.set-as-owner.confirm.description"](): string;
    /**
      * `Permission updated`
      */
    ["com.affine.share-menu.member-management.update-success"](): string;
    /**
      * `Failed to update permission`
      */
    ["com.affine.share-menu.member-management.update-fail"](): string;
    /**
      * `{{memberCount}} collaborators in the doc`
      */
    ["com.affine.share-menu.member-management.header"](options: {
        readonly memberCount: string;
    }): string;
    /**
      * `Add collaborators`
      */
    ["com.affine.share-menu.member-management.add-collaborators"](): string;
    /**
      * `Send invite`
      */
    ["com.affine.share-menu.invite-editor.header"](): string;
    /**
      * `Manage members`
      */
    ["com.affine.share-menu.invite-editor.manage-members"](): string;
    /**
      * `Invite`
      */
    ["com.affine.share-menu.invite-editor.invite"](): string;
    /**
      * `No results found`
      */
    ["com.affine.share-menu.invite-editor.no-found"](): string;
    /**
      * `Invite other members`
      */
    ["com.affine.share-menu.invite-editor.placeholder"](): string;
    /**
      * `Notify via Email`
      */
    ["com.affine.share-menu.invite-editor.sent-email"](): string;
    /**
      * `Permission not available in Free plan`
      */
    ["com.affine.share-menu.paywall.owner.title"](): string;
    /**
      * `Upgrade to Pro or higher to unlock permission settings for this doc.`
      */
    ["com.affine.share-menu.paywall.owner.description"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.share-menu.paywall.owner.confirm"](): string;
    /**
      * `Permission requires a workspace upgrade`
      */
    ["com.affine.share-menu.paywall.member.title"](): string;
    /**
      * `Ask your workspace owner to upgrade to Pro or higher to enable permissions.`
      */
    ["com.affine.share-menu.paywall.member.description"](): string;
    /**
      * `Got it`
      */
    ["com.affine.share-menu.paywall.member.confirm"](): string;
    /**
      * `Built with`
      */
    ["com.affine.share-page.footer.built-with"](): string;
    /**
      * `Create with`
      */
    ["com.affine.share-page.footer.create-with"](): string;
    /**
      * `Empower your sharing with LocalMind Cloud: One-click doc sharing`
      */
    ["com.affine.share-page.footer.description"](): string;
    /**
      * `Get started for free`
      */
    ["com.affine.share-page.footer.get-started"](): string;
    /**
      * `Use This Template`
      */
    ["com.affine.share-page.header.import-template"](): string;
    /**
      * `Login or Sign Up`
      */
    ["com.affine.share-page.header.login"](): string;
    /**
      * `Present`
      */
    ["com.affine.share-page.header.present"](): string;
    /**
      * `Edgeless`
      */
    ["com.affine.shortcutsTitle.edgeless"](): string;
    /**
      * `General`
      */
    ["com.affine.shortcutsTitle.general"](): string;
    /**
      * `Markdown syntax`
      */
    ["com.affine.shortcutsTitle.markdownSyntax"](): string;
    /**
      * `Page`
      */
    ["com.affine.shortcutsTitle.page"](): string;
    /**
      * `Collapse sidebar`
      */
    ["com.affine.sidebarSwitch.collapse"](): string;
    /**
      * `Expand sidebar`
      */
    ["com.affine.sidebarSwitch.expand"](): string;
    /**
      * `Snapshot Imp. & Exp.`
      */
    ["com.affine.snapshot.import-export.enable"](): string;
    /**
      * `Once enabled you can find the Snapshot Export Import option in the document's More menu.`
      */
    ["com.affine.snapshot.import-export.enable.desc"](): string;
    /**
      * `Maybe later`
      */
    ["com.affine.star-affine.cancel"](): string;
    /**
      * `Star on GitHub`
      */
    ["com.affine.star-affine.confirm"](): string;
    /**
      * `Are you finding our app useful and enjoyable? We'd love your support to keep improving! A great way to help us out is by giving us a star on GitHub. This simple action can make a big difference and helps us continue to deliver the best experience for you.`
      */
    ["com.affine.star-affine.description"](): string;
    /**
      * `Star us on GitHub`
      */
    ["com.affine.star-affine.title"](): string;
    /**
      * `Change plan`
      */
    ["com.affine.storage.change-plan"](): string;
    /**
      * `You have reached the maximum capacity limit for your current account`
      */
    ["com.affine.storage.maximum-tips"](): string;
    /**
      * `Pro users will have unlimited storage capacity during the alpha test period of the team version`
      */
    ["com.affine.storage.maximum-tips.pro"](): string;
    /**
      * `Plan`
      */
    ["com.affine.storage.plan"](): string;
    /**
      * `LocalMind Sync storage`
      */
    ["com.affine.storage.title"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.storage.upgrade"](): string;
    /**
      * `Space used`
      */
    ["com.affine.storage.used.hint"](): string;
    /**
      * `Syncing`
      */
    ["com.affine.syncing"](): string;
    /**
      * `{{count}} doc`

      * - com.affine.tags.count_one: `{{count}} doc`

      * - com.affine.tags.count_other: `{{count}} docs`

      * - com.affine.tags.count_zero: `{{count}} doc`
      */
    ["com.affine.tags.count"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} doc`
      */
    ["com.affine.tags.count_one"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} docs`
      */
    ["com.affine.tags.count_other"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} doc`
      */
    ["com.affine.tags.count_zero"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Type tag name here...`
      */
    ["com.affine.tags.create-tag.placeholder"](): string;
    /**
      * `Tag already exists`
      */
    ["com.affine.tags.create-tag.toast.exist"](): string;
    /**
      * `Tag created`
      */
    ["com.affine.tags.create-tag.toast.success"](): string;
    /**
      * `Tag deleted`
      */
    ["com.affine.tags.delete-tags.toast"](): string;
    /**
      * `Tag updated`
      */
    ["com.affine.tags.edit-tag.toast.success"](): string;
    /**
      * `New tag`
      */
    ["com.affine.tags.empty.new-tag-button"](): string;
    /**
      * `Enable telemetry`
      */
    ["com.affine.telemetry.enable"](): string;
    /**
      * `Telemetry is a feature that allows us to collect data on how you use the app. This data helps us improve the app and provide better features.`
      */
    ["com.affine.telemetry.enable.desc"](): string;
    /**
      * `Dark`
      */
    ["com.affine.themeSettings.dark"](): string;
    /**
      * `Light`
      */
    ["com.affine.themeSettings.light"](): string;
    /**
      * `System`
      */
    ["com.affine.themeSettings.system"](): string;
    /**
      * `Auto`
      */
    ["com.affine.themeSettings.auto"](): string;
    /**
      * `now`
      */
    ["com.affine.time.now"](): string;
    /**
      * `this month`
      */
    ["com.affine.time.this-mouth"](): string;
    /**
      * `this week`
      */
    ["com.affine.time.this-week"](): string;
    /**
      * `this year`
      */
    ["com.affine.time.this-year"](): string;
    /**
      * `today`
      */
    ["com.affine.time.today"](): string;
    /**
      * `Successfully added linked doc`
      */
    ["com.affine.toastMessage.addLinkedPage"](): string;
    /**
      * `Couldn't add the linked doc. Please try again.`
      */
    ["com.affine.toastMessage.addLinkedPageFailed"](): string;
    /**
      * `This document is already linked here`
      */
    ["com.affine.toastMessage.linkedPageAlreadyExists"](): string;
    /**
      * `A document can't be linked to itself`
      */
    ["com.affine.toastMessage.linkedPageSelfLink"](): string;
    /**
      * `Link removed. The original document was kept.`
      */
    ["com.affine.toastMessage.removeLinkedPage"](): string;
    /**
      * `Couldn't remove the link. Please try again.`
      */
    ["com.affine.toastMessage.removeLinkedPageFailed"](): string;
    /**
      * `Added to favorites`
      */
    ["com.affine.toastMessage.addedFavorites"](): string;
    /**
      * `Edgeless mode`
      */
    ["com.affine.toastMessage.edgelessMode"](): string;
    /**
      * `Moved to trash`
      */
    ["com.affine.toastMessage.movedTrash"](): string;
    /**
      * `Page Mode`
      */
    ["com.affine.toastMessage.pageMode"](): string;
    /**
      * `Default mode has changed`
      */
    ["com.affine.toastMessage.defaultMode.page.title"](): string;
    /**
      * `The default mode for this document has been changed to Page mode`
      */
    ["com.affine.toastMessage.defaultMode.page.message"](): string;
    /**
      * `Default mode has changed`
      */
    ["com.affine.toastMessage.defaultMode.edgeless.title"](): string;
    /**
      * `The default mode for this document has been changed to Edgeless mode`
      */
    ["com.affine.toastMessage.defaultMode.edgeless.message"](): string;
    /**
      * `Permanently deleted`
      */
    ["com.affine.toastMessage.permanentlyDeleted"](): string;
    /**
      * `Removed from favourites`
      */
    ["com.affine.toastMessage.removedFavorites"](): string;
    /**
      * `Successfully renamed`
      */
    ["com.affine.toastMessage.rename"](): string;
    /**
      * `{{title}} restored`
      */
    ["com.affine.toastMessage.restored"](options: {
        readonly title: string;
    }): string;
    /**
      * `Successfully deleted`
      */
    ["com.affine.toastMessage.successfullyDeleted"](): string;
    /**
      * `Today`
      */
    ["com.affine.today"](): string;
    /**
      * `Tomorrow`
      */
    ["com.affine.tomorrow"](): string;
    /**
      * `Last {{weekday}}`
      */
    ["com.affine.last-week"](options: {
        readonly weekday: string;
    }): string;
    /**
      * `Next {{weekday}}`
      */
    ["com.affine.next-week"](options: {
        readonly weekday: string;
    }): string;
    /**
      * `Limited to view-only on mobile.`
      */
    ["com.affine.top-tip.mobile"](): string;
    /**
      * `Delete`
      */
    ["com.affine.trashOperation.delete"](): string;
    /**
      * `Once deleted, you can't undo this action. Do you confirm?`
      */
    ["com.affine.trashOperation.delete.description"](): string;
    /**
      * `Permanently delete`
      */
    ["com.affine.trashOperation.delete.title"](): string;
    /**
      * `Once deleted, you can't undo this action. Do you confirm?`
      */
    ["com.affine.trashOperation.deleteDescription"](): string;
    /**
      * `Delete permanently`
      */
    ["com.affine.trashOperation.deletePermanently"](): string;
    /**
      * `Restore it`
      */
    ["com.affine.trashOperation.restoreIt"](): string;
    /**
      * `Refresh current page`
      */
    ["com.affine.upgrade.button-text.done"](): string;
    /**
      * `Data upgrade error`
      */
    ["com.affine.upgrade.button-text.error"](): string;
    /**
      * `Upgrade workspace data`
      */
    ["com.affine.upgrade.button-text.pending"](): string;
    /**
      * `Upgrading`
      */
    ["com.affine.upgrade.button-text.upgrading"](): string;
    /**
      * `After upgrading the workspace data, please refresh the page to see the changes.`
      */
    ["com.affine.upgrade.tips.done"](): string;
    /**
      * `We encountered some errors while upgrading the workspace data.`
      */
    ["com.affine.upgrade.tips.error"](): string;
    /**
      * `To ensure compatibility with the updated LocalMind client, please upgrade your data by clicking the "Upgrade workspace data" button below.`
      */
    ["com.affine.upgrade.tips.normal"](): string;
    /**
      * `AI usage`
      */
    ["com.affine.user-info.usage.ai"](): string;
    /**
      * `Sync storage`
      */
    ["com.affine.user-info.usage.cloud"](): string;
    /**
      * `Close`
      */
    ["com.affine.workbench.split-view-menu.close"](): string;
    /**
      * `Full screen`
      */
    ["com.affine.workbench.split-view-menu.full-screen"](): string;
    /**
      * `Solo view`
      */
    ["com.affine.workbench.split-view-menu.keep-this-one"](): string;
    /**
      * `Move left`
      */
    ["com.affine.workbench.split-view-menu.move-left"](): string;
    /**
      * `Move right`
      */
    ["com.affine.workbench.split-view-menu.move-right"](): string;
    /**
      * `Open in split view`
      */
    ["com.affine.workbench.split-view.page-menu-open"](): string;
    /**
      * `Open in new tab`
      */
    ["com.affine.workbench.tab.page-menu-open"](): string;
    /**
      * `You cannot delete the last workspace`
      */
    ["com.affine.workspace.cannot-delete"](): string;
    /**
      * `Synced workspaces`
      */
    ["com.affine.workspace.cloud"](): string;
    /**
      * `Sign out`
      */
    ["com.affine.workspace.cloud.account.logout"](): string;
    /**
      * `Account settings`
      */
    ["com.affine.workspace.cloud.account.settings"](): string;
    /**
      * `Admin panel`
      */
    ["com.affine.workspace.cloud.account.admin"](): string;
    /**
      * `Team owner`
      */
    ["com.affine.workspace.cloud.account.team.owner"](): string;
    /**
      * `Team member`
      */
    ["com.affine.workspace.cloud.account.team.member"](): string;
    /**
      * `Multiple teams`
      */
    ["com.affine.workspace.cloud.account.team.multi"](): string;
    /**
      * `Click to open workspace`
      */
    ["com.affine.workspace.cloud.account.team.tips-1"](): string;
    /**
      * `Click to open workspace list`
      */
    ["com.affine.workspace.cloud.account.team.tips-2"](): string;
    /**
      * `Sign in / Sign up to LocalMind`
      */
    ["com.affine.workspace.cloud.auth"](): string;
    /**
      * `Sync with LocalMind`
      */
    ["com.affine.workspace.cloud.description"](): string;
    /**
      * `Join workspace`
      */
    ["com.affine.workspace.cloud.join"](): string;
    /**
      * `LocalMind Sync`
      */
    ["com.affine.workspace.cloud.sync"](): string;
    /**
      * `Failed to turn on LocalMind Sync. Please try again.`
      */
    ["com.affine.workspace.enable-cloud.failed"](): string;
    /**
      * `Local workspaces`
      */
    ["com.affine.workspace.local"](): string;
    /**
      * `Import workspace`
      */
    ["com.affine.workspace.local.import"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.workspaceDelete.button.cancel"](): string;
    /**
      * `Delete`
      */
    ["com.affine.workspaceDelete.button.delete"](): string;
    /**
      * `Please type workspace name to confirm`
      */
    ["com.affine.workspaceDelete.placeholder"](): string;
    /**
      * `Delete workspace`
      */
    ["com.affine.workspaceDelete.title"](): string;
    /**
      * `Create workspace`
      */
    ["com.affine.workspaceList.addWorkspace.create"](): string;
    /**
      * `Create synced workspace`
      */
    ["com.affine.workspaceList.addWorkspace.create-cloud"](): string;
    /**
      * `Cloud sync`
      */
    ["com.affine.workspaceList.workspaceListType.cloud"](): string;
    /**
      * `Local storage`
      */
    ["com.affine.workspaceList.workspaceListType.local"](): string;
    /**
      * `Add Server`
      */
    ["com.affine.workspaceList.addServer"](): string;
    /**
      * `All docs`
      */
    ["com.affine.workspaceSubPath.all"](): string;
    /**
      * `Intelligence`
      */
    ["com.affine.workspaceSubPath.chat"](): string;
    /**
      * `Tasks`
      */
    ["com.affine.workspaceSubPath.tasks"](): string;
    /**
      * `Trash`
      */
    ["com.affine.workspaceSubPath.trash"](): string;
    /**
      * `Deleted docs will appear here.`
      */
    ["com.affine.workspaceSubPath.trash.empty-description"](): string;
    /**
      * `Active`
      */
    ["com.affine.localmind.tasks.filter.active"](): string;
    /**
      * `All`
      */
    ["com.affine.localmind.tasks.filter.all"](): string;
    /**
      * `Approval`
      */
    ["com.affine.localmind.tasks.filter.approval"](): string;
    /**
      * `Task history pages`
      */
    ["com.affine.localmind.tasks.history.navigation"](): string;
    /**
      * `Previous page`
      */
    ["com.affine.localmind.tasks.history.previous"](): string;
    /**
      * `Next page`
      */
    ["com.affine.localmind.tasks.history.next"](): string;
    /**
      * `This task is unavailable or you no longer have access.`
      */
    ["com.affine.localmind.tasks.history.unavailable"](): string;
    /**
      * `Confirm again`
      */
    ["com.affine.localmind.tasks.approval.confirmAgain"](): string;
    /**
      * `Document update preview`
      */
    ["com.affine.localmind.tasks.approval.preview"](): string;
    /**
      * `The document changed while this task was queued. The previous approval is invalid. Review this update before confirming again.`
      */
    ["com.affine.localmind.tasks.approval.changed"](): string;
    /**
      * `Previously approved version`
      */
    ["com.affine.localmind.tasks.approval.previousVersion"](): string;
    /**
      * `Target version`
      */
    ["com.affine.localmind.tasks.approval.currentVersion"](): string;
    /**
      * `Approval details`
      */
    ["com.affine.localmind.tasks.approval.summary"](): string;
    /**
      * `Operation`
      */
    ["com.affine.localmind.tasks.approval.operation"](): string;
    /**
      * `Commands`
      */
    ["com.affine.localmind.tasks.approval.commandCount"](): string;
    /**
      * `Revision`
      */
    ["com.affine.localmind.tasks.approval.revision"](): string;
    /**
      * `Completed`
      */
    ["com.affine.localmind.tasks.filter.completed"](): string;
    /**
      * `No active tasks`
      */
    ["com.affine.localmind.tasks.empty.active"](): string;
    /**
      * `No tasks`
      */
    ["com.affine.localmind.tasks.empty.all"](): string;
    /**
      * `No tasks need approval`
      */
    ["com.affine.localmind.tasks.empty.approval"](): string;
    /**
      * `No completed tasks`
      */
    ["com.affine.localmind.tasks.empty.completed"](): string;
    /**
      * `Select a task`
      */
    ["com.affine.localmind.tasks.empty.detail"](): string;
    /**
      * `Untitled task`
      */
    ["com.affine.localmind.tasks.untitled"](): string;
    /**
      * `Refresh tasks`
      */
    ["com.affine.localmind.tasks.refresh"](): string;
    /**
      * `Task details`
      */
    ["com.affine.localmind.tasks.details"](): string;
    /**
      * `Steps`
      */
    ["com.affine.localmind.tasks.steps"](): string;
    /**
      * `Result`
      */
    ["com.affine.localmind.tasks.result"](): string;
    /**
      * `Failure`
      */
    ["com.affine.localmind.tasks.failure"](): string;
    /**
      * `Created`
      */
    ["com.affine.localmind.tasks.created"](): string;
    /**
      * `Updated`
      */
    ["com.affine.localmind.tasks.updated"](): string;
    /**
      * `Open document`
      */
    ["com.affine.localmind.tasks.openDocument"](): string;
    /**
      * `Approve`
      */
    ["com.affine.localmind.tasks.action.approve"](): string;
    /**
      * `Reject`
      */
    ["com.affine.localmind.tasks.action.reject"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.localmind.tasks.action.cancel"](): string;
    /**
      * `Resume`
      */
    ["com.affine.localmind.tasks.action.resume"](): string;
    /**
      * `Abandon`
      */
    ["com.affine.localmind.tasks.action.abandon"](): string;
    /**
      * `Task updated`
      */
    ["com.affine.localmind.tasks.action.success"](): string;
    /**
      * `Could not update task`
      */
    ["com.affine.localmind.tasks.action.failed"](): string;
    /**
      * `Queued`
      */
    ["com.affine.localmind.tasks.status.queued"](): string;
    /**
      * `Running`
      */
    ["com.affine.localmind.tasks.status.running"](): string;
    /**
      * `Waiting for approval`
      */
    ["com.affine.localmind.tasks.status.waiting_approval"](): string;
    /**
      * `Completed`
      */
    ["com.affine.localmind.tasks.status.completed"](): string;
    /**
      * `Failed`
      */
    ["com.affine.localmind.tasks.status.failed"](): string;
    /**
      * `Cancelled`
      */
    ["com.affine.localmind.tasks.status.cancelled"](): string;
    /**
      * `Abandoned`
      */
    ["com.affine.localmind.tasks.status.abandoned"](): string;
    /**
      * `Pending`
      */
    ["com.affine.localmind.tasks.status.pending"](): string;
    /**
      * `Approved`
      */
    ["com.affine.localmind.tasks.status.approved"](): string;
    /**
      * `Active`
      */
    ["com.affine.localmind.tasks.status.active"](): string;
    /**
      * `Rejected`
      */
    ["com.affine.localmind.tasks.status.rejected"](): string;
    /**
      * `Withdrawn`
      */
    ["com.affine.localmind.tasks.status.withdrawn"](): string;
    /**
      * `Expired`
      */
    ["com.affine.localmind.tasks.status.expired"](): string;
    /**
      * `Accepted`
      */
    ["com.affine.localmind.tasks.status.accepted"](): string;
    /**
      * `Declined`
      */
    ["com.affine.localmind.tasks.status.declined"](): string;
    /**
      * `Revoked`
      */
    ["com.affine.localmind.tasks.status.revoked"](): string;
    /**
      * `Restricted document request`
      */
    ["com.affine.localmind.tasks.authorization.redacted"](): string;
    /**
      * `Document access request`
      */
    ["com.affine.localmind.tasks.authorization.accessRequest"](): string;
    /**
      * `Project invitation`
      */
    ["com.affine.localmind.tasks.authorization.invitation"](): string;
    /**
      * `Project document authorization`
      */
    ["com.affine.localmind.tasks.authorization.projectGrant"](): string;
    /**
      * `Type`
      */
    ["com.affine.localmind.tasks.authorization.kindLabel"](): string;
    /**
      * `Access level`
      */
    ["com.affine.localmind.tasks.authorization.level"](): string;
    /**
      * `Workspace`
      */
    ["com.affine.localmind.tasks.authorization.workspace"](): string;
    /**
      * `Project`
      */
    ["com.affine.localmind.tasks.authorization.project"](): string;
    /**
      * `Document`
      */
    ["com.affine.localmind.tasks.authorization.document"](): string;
    /**
      * `Related user`
      */
    ["com.affine.localmind.tasks.authorization.relatedUser"](): string;
    /**
      * `AI run`
      */
    ["com.affine.localmind.tasks.authorization.kind.run"](): string;
    /**
      * `Access request`
      */
    ["com.affine.localmind.tasks.authorization.kind.access_request"](): string;
    /**
      * `Project invitation`
      */
    ["com.affine.localmind.tasks.authorization.kind.project_invitation"](): string;
    /**
      * `Project authorization`
      */
    ["com.affine.localmind.tasks.authorization.kind.project_grant"](): string;
    /**
      * `Blocker`
      */
    ["com.affine.localmind.tasks.authorization.kind.blocker"](): string;
    /**
      * `Only the 100 most recent items are shown.`
      */
    ["com.affine.localmind.tasks.capped"](): string;
    /**
      * `Pending`
      */
    ["com.affine.localmind.tasks.step.pending"](): string;
    /**
      * `Running`
      */
    ["com.affine.localmind.tasks.step.running"](): string;
    /**
      * `Waiting for approval`
      */
    ["com.affine.localmind.tasks.step.waiting_approval"](): string;
    /**
      * `Completed`
      */
    ["com.affine.localmind.tasks.step.completed"](): string;
    /**
      * `Failed`
      */
    ["com.affine.localmind.tasks.step.failed"](): string;
    /**
      * `Skipped`
      */
    ["com.affine.localmind.tasks.step.skipped"](): string;
    /**
      * `Intelligence navigation`
      */
    ["com.affine.localmind.workbench.navigation"](): string;
    /**
      * `Projects`
      */
    ["com.affine.localmind.workbench.projects"](): string;
    /**
      * `All projects`
      */
    ["com.affine.localmind.workbench.projects.all"](): string;
    /**
      * `No projects yet`
      */
    ["com.affine.localmind.workbench.projects.emptyTitle"](): string;
    /**
      * `Create a project to collect documents, tasks, and conversations.`
      */
    ["com.affine.localmind.workbench.projects.empty"](): string;
    /**
      * `Create project`
      */
    ["com.affine.localmind.workbench.project.create"](): string;
    /**
      * `Project name`
      */
    ["com.affine.localmind.workbench.project.namePlaceholder"](): string;
    /**
      * `Project actions`
      */
    ["com.affine.localmind.workbench.project.actions"](): string;
    /**
      * `Project access and members`
      */
    ["com.affine.localmind.workbench.project.collaboration"](): string;
    /**
      * `Members`
      */
    ["com.affine.localmind.workbench.project.members"](): string;
    /**
      * `Owner`
      */
    ["com.affine.localmind.workbench.project.role.owner"](): string;
    /**
      * `Member`
      */
    ["com.affine.localmind.workbench.project.role.member"](): string;
    /**
      * `Invite member`
      */
    ["com.affine.localmind.workbench.project.invite"](): string;
    /**
      * `Member email`
      */
    ["com.affine.localmind.workbench.project.invitePlaceholder"](): string;
    /**
      * `Invitation sent`
      */
    ["com.affine.localmind.workbench.project.inviteSent"](): string;
    /**
      * `Could not send invitation`
      */
    ["com.affine.localmind.workbench.project.inviteFailed"](): string;
    /**
      * `Remove member`
      */
    ["com.affine.localmind.workbench.project.removeMember"](): string;
    /**
      * `Remove this project member?`
      */
    ["com.affine.localmind.workbench.project.removeMemberConfirm"](): string;
    /**
      * `{{name}} will immediately lose access granted through this project.`
      */
    ["com.affine.localmind.workbench.project.removeMemberDescription"](options: {
        readonly name: string;
    }): string;
    /**
      * `Member removed`
      */
    ["com.affine.localmind.workbench.project.memberRemoved"](): string;
    /**
      * `Could not remove member`
      */
    ["com.affine.localmind.workbench.project.memberRemoveFailed"](): string;
    /**
      * `Transfer ownership`
      */
    ["com.affine.localmind.workbench.project.transferOwnership"](): string;
    /**
      * `Transfer project ownership?`
      */
    ["com.affine.localmind.workbench.project.transferOwnershipConfirm"](): string;
    /**
      * `{{name}} will become an owner of this project.`
      */
    ["com.affine.localmind.workbench.project.transferOwnershipDescription"](options: {
        readonly name: string;
    }): string;
    /**
      * `Ownership transferred`
      */
    ["com.affine.localmind.workbench.project.ownershipTransferred"](): string;
    /**
      * `Could not transfer ownership`
      */
    ["com.affine.localmind.workbench.project.transferFailed"](): string;
    /**
      * `Project AI permissions`
      */
    ["com.affine.localmind.workbench.project.aiPolicy"](): string;
    /**
      * `Project AI is not configured. Contact your LocalMind instance administrator to configure the global Project model.`
      */
    ["com.affine.localmind.project.aiNotConfigured"](): string;
    /**
      * `Read only`
      */
    ["com.affine.localmind.workbench.project.aiPolicy.readOnly"](): string;
    /**
      * `Read and write`
      */
    ["com.affine.localmind.workbench.project.aiPolicy.readWrite"](): string;
    /**
      * `AI permissions updated`
      */
    ["com.affine.localmind.workbench.project.aiPolicyUpdated"](): string;
    /**
      * `Could not update AI permissions`
      */
    ["com.affine.localmind.workbench.project.aiPolicyFailed"](): string;
    /**
      * `Leave project`
      */
    ["com.affine.localmind.workbench.project.leave"](): string;
    /**
      * `Leave this project?`
      */
    ["com.affine.localmind.workbench.project.leaveConfirm"](): string;
    /**
      * `You will lose access to this project's documents, conversations, and memory.`
      */
    ["com.affine.localmind.workbench.project.leaveDescription"](): string;
    /**
      * `You left the project`
      */
    ["com.affine.localmind.workbench.project.left"](): string;
    /**
      * `Could not leave project`
      */
    ["com.affine.localmind.workbench.project.leaveFailed"](): string;
    /**
      * `Archive`
      */
    ["com.affine.localmind.workbench.project.archive"](): string;
    /**
      * `Archive project?`
      */
    ["com.affine.localmind.workbench.project.archiveConfirm"](): string;
    /**
      * `This project will be removed from the active project tree.`
      */
    ["com.affine.localmind.workbench.project.archiveDescription"](): string;
    /**
      * `Project created`
      */
    ["com.affine.localmind.workbench.project.created"](): string;
    /**
      * `Could not create project`
      */
    ["com.affine.localmind.workbench.project.createFailed"](): string;
    /**
      * `Project renamed`
      */
    ["com.affine.localmind.workbench.project.renamed"](): string;
    /**
      * `Could not rename project`
      */
    ["com.affine.localmind.workbench.project.renameFailed"](): string;
    /**
      * `Project archived`
      */
    ["com.affine.localmind.workbench.project.archived"](): string;
    /**
      * `Could not archive project`
      */
    ["com.affine.localmind.workbench.project.archiveFailed"](): string;
    /**
      * `Untitled document`
      */
    ["com.affine.localmind.workbench.document.untitled"](): string;
    /**
      * `Documents added`
      */
    ["com.affine.localmind.workbench.document.added"](): string;
    /**
      * `Could not add documents`
      */
    ["com.affine.localmind.workbench.document.addFailed"](): string;
    /**
      * `{{granted}} added, {{requested}} awaiting authorization`
      */
    ["com.affine.localmind.workbench.document.addResult"](options: Readonly<{
        granted: string;
        requested: string;
    }>): string;
    /**
      * `Document awaiting authorization`
      */
    ["com.affine.localmind.workbench.document.pending"](): string;
    /**
      * `Document authorization lost`
      */
    ["com.affine.localmind.workbench.document.revoked"](): string;
    /**
      * `Remove document`
      */
    ["com.affine.localmind.workbench.document.remove"](): string;
    /**
      * `Remove this document from the project?`
      */
    ["com.affine.localmind.workbench.document.removeConfirm"](): string;
    /**
      * `Project members and AI will no longer use this document through the project.`
      */
    ["com.affine.localmind.workbench.document.removeDescription"](): string;
    /**
      * `Document removed`
      */
    ["com.affine.localmind.workbench.document.removed"](): string;
    /**
      * `Could not remove document`
      */
    ["com.affine.localmind.workbench.document.removeFailed"](): string;
    /**
      * `Some documents were not added`
      */
    ["com.affine.localmind.workbench.document.shareRequired"](): string;
    /**
      * `You need sharing permission before a selected document can be added.`
      */
    ["com.affine.localmind.workbench.document.shareRequiredDetail"](): string;
    /**
      * `Return to workspace`
      */
    ["com.affine.localmind.workbench.returnToWorkspace"](): string;
    /**
      * `Tasks`
      */
    ["com.affine.localmind.workbench.tasks"](): string;
    /**
      * `To do`
      */
    ["com.affine.localmind.workbench.tasks.todo"](): string;
    /**
      * `In progress`
      */
    ["com.affine.localmind.workbench.tasks.inProgress"](): string;
    /**
      * `Done`
      */
    ["com.affine.localmind.workbench.tasks.done"](): string;
    /**
      * `Needs my action`
      */
    ["com.affine.localmind.workbench.tasks.needsMyAction"](): string;
    /**
      * `Waiting on others`
      */
    ["com.affine.localmind.workbench.tasks.waitingOnOthers"](): string;
    /**
      * `Nothing needs your action`
      */
    ["com.affine.localmind.workbench.tasks.noneForMe"](): string;
    /**
      * `Nothing is waiting on others`
      */
    ["com.affine.localmind.workbench.tasks.noneWaiting"](): string;
    /**
      * `No tasks in this segment`
      */
    ["com.affine.localmind.workbench.tasks.empty"](): string;
    /**
      * `View all in Tasks`
      */
    ["com.affine.localmind.workbench.tasks.viewAll"](): string;
    /**
      * `Add blocker`
      */
    ["com.affine.localmind.workbench.blocker.add"](): string;
    /**
      * `Create blocker`
      */
    ["com.affine.localmind.workbench.blocker.create"](): string;
    /**
      * `Title`
      */
    ["com.affine.localmind.workbench.blocker.title"](): string;
    /**
      * `Type`
      */
    ["com.affine.localmind.workbench.blocker.type"](): string;
    /**
      * `Waiting on`
      */
    ["com.affine.localmind.workbench.blocker.waitingOnLabel"](): string;
    /**
      * `Due date`
      */
    ["com.affine.localmind.workbench.blocker.dueAt"](): string;
    /**
      * `No due date`
      */
    ["com.affine.localmind.workbench.blocker.noDueDate"](): string;
    /**
      * `Created from`
      */
    ["com.affine.localmind.workbench.blocker.originLabel"](): string;
    /**
      * `User`
      */
    ["com.affine.localmind.workbench.blocker.origin.user"](): string;
    /**
      * `AI suggestion`
      */
    ["com.affine.localmind.workbench.blocker.origin.ai"](): string;
    /**
      * `Enter both a title and who or what you are waiting on.`
      */
    ["com.affine.localmind.workbench.blocker.required"](): string;
    /**
      * `Enter a valid due date.`
      */
    ["com.affine.localmind.workbench.blocker.invalidDueDate"](): string;
    /**
      * `The blocker was not created. Check your access and try again.`
      */
    ["com.affine.localmind.workbench.blocker.createFailedInline"](): string;
    /**
      * `Blocker created`
      */
    ["com.affine.localmind.workbench.blocker.created"](): string;
    /**
      * `Could not create blocker`
      */
    ["com.affine.localmind.workbench.blocker.createFailed"](): string;
    /**
      * `Blockers`
      */
    ["com.affine.localmind.workbench.blocker.group"](): string;
    /**
      * `No blockers in this project`
      */
    ["com.affine.localmind.workbench.blocker.empty"](): string;
    /**
      * `Reply`
      */
    ["com.affine.localmind.workbench.blocker.type.reply"](): string;
    /**
      * `File`
      */
    ["com.affine.localmind.workbench.blocker.type.file"](): string;
    /**
      * `Decision`
      */
    ["com.affine.localmind.workbench.blocker.type.decision"](): string;
    /**
      * `Other`
      */
    ["com.affine.localmind.workbench.blocker.type.custom"](): string;
    /**
      * `Waiting`
      */
    ["com.affine.localmind.workbench.blocker.status.waiting"](): string;
    /**
      * `Resolved`
      */
    ["com.affine.localmind.workbench.blocker.status.resolved"](): string;
    /**
      * `Abandoned`
      */
    ["com.affine.localmind.workbench.blocker.status.abandoned"](): string;
    /**
      * `Waiting on {{name}}`
      */
    ["com.affine.localmind.workbench.blocker.waitingOn"](options: {
        readonly name: string;
    }): string;
    /**
      * `Due {{date}}`
      */
    ["com.affine.localmind.workbench.blocker.due"](options: {
        readonly date: string;
    }): string;
    /**
      * `Overdue · due {{date}}`
      */
    ["com.affine.localmind.workbench.blocker.overdue"](options: {
        readonly date: string;
    }): string;
    /**
      * `Resolve`
      */
    ["com.affine.localmind.workbench.blocker.resolve"](): string;
    /**
      * `Abandon`
      */
    ["com.affine.localmind.workbench.blocker.abandon"](): string;
    /**
      * `Blocker updated`
      */
    ["com.affine.localmind.workbench.blocker.updated"](): string;
    /**
      * `Could not update blocker`
      */
    ["com.affine.localmind.workbench.blocker.updateFailed"](): string;
    /**
      * `Suggested blocker`
      */
    ["com.affine.localmind.workbench.blocker.suggestion"](): string;
    /**
      * `Create blocker`
      */
    ["com.affine.localmind.workbench.blocker.suggestionCreate"](): string;
    /**
      * `Creating blocker…`
      */
    ["com.affine.localmind.workbench.blocker.suggestionCreating"](): string;
    /**
      * `Blocker created`
      */
    ["com.affine.localmind.workbench.blocker.suggestionCreated"](): string;
    /**
      * `The blocker was not created. Try again.`
      */
    ["com.affine.localmind.workbench.blocker.suggestionFailed"](): string;
    /**
      * `Select the project where this blocker was suggested, then try again.`
      */
    ["com.affine.localmind.workbench.blocker.selectSuggestedProject"](): string;
    /**
      * `Abandon`
      */
    ["com.affine.localmind.workbench.task.abandon"](): string;
    /**
      * `Approve access`
      */
    ["com.affine.localmind.workbench.action.approveAccess"](): string;
    /**
      * `Reject access`
      */
    ["com.affine.localmind.workbench.action.rejectAccess"](): string;
    /**
      * `Withdraw request`
      */
    ["com.affine.localmind.workbench.action.withdrawRequest"](): string;
    /**
      * `Request again`
      */
    ["com.affine.localmind.workbench.action.requestAgain"](): string;
    /**
      * `Accept invitation`
      */
    ["com.affine.localmind.workbench.action.acceptInvite"](): string;
    /**
      * `Decline invitation`
      */
    ["com.affine.localmind.workbench.action.declineInvite"](): string;
    /**
      * `Withdraw invitation`
      */
    ["com.affine.localmind.workbench.action.withdrawInvite"](): string;
    /**
      * `Pending`
      */
    ["com.affine.localmind.workbench.status.pending"](): string;
    /**
      * `Approved`
      */
    ["com.affine.localmind.workbench.status.approved"](): string;
    /**
      * `Rejected`
      */
    ["com.affine.localmind.workbench.status.rejected"](): string;
    /**
      * `Withdrawn`
      */
    ["com.affine.localmind.workbench.status.withdrawn"](): string;
    /**
      * `Expired`
      */
    ["com.affine.localmind.workbench.status.expired"](): string;
    /**
      * `Accepted`
      */
    ["com.affine.localmind.workbench.status.accepted"](): string;
    /**
      * `Declined`
      */
    ["com.affine.localmind.workbench.status.declined"](): string;
    /**
      * `Revoked`
      */
    ["com.affine.localmind.workbench.status.revoked"](): string;
    /**
      * `Retry`
      */
    ["com.affine.localmind.workbench.retry"](): string;
    /**
      * `AI conversation`
      */
    ["com.affine.localmind.workbench.conversation"](): string;
    /**
      * `AI context settings`
      */
    ["com.affine.localmind.workbench.aiSettings"](): string;
    /**
      * `No accessible workspace is available as an AI execution host.`
      */
    ["com.affine.localmind.workbench.noHost"](): string;
    /**
      * `Document preview`
      */
    ["com.affine.localmind.workbench.documentPreview"](): string;
    /**
      * `Open in workspace`
      */
    ["com.affine.localmind.workbench.openInWorkspace"](): string;
    /**
      * `Close preview`
      */
    ["com.affine.localmind.workbench.closePreview"](): string;
    /**
      * `Request copy to project`
      */
    ["com.affine.localmind.accessRequest.request"](): string;
    /**
      * `Access requested`
      */
    ["com.affine.localmind.accessRequest.requested"](): string;
    /**
      * `Could not request access`
      */
    ["com.affine.localmind.accessRequest.failed"](): string;
    /**
      * `Project copy permissions`
      */
    ["com.affine.localmind.share.projectAccess.title"](): string;
    /**
      * `Pending requests`
      */
    ["com.affine.localmind.share.projectAccess.requests"](): string;
    /**
      * `Approved projects`
      */
    ["com.affine.localmind.share.projectAccess.grants"](): string;
    /**
      * `Project copy request`
      */
    ["com.affine.localmind.share.projectAccess.projectRequest"](): string;
    /**
      * `Personal access request`
      */
    ["com.affine.localmind.share.projectAccess.personalRequest"](): string;
    /**
      * `{{level}} · requested {{time}}`
      */
    ["com.affine.localmind.share.projectAccess.requestMeta"](options: Readonly<{
        level: string;
        time: string;
    }>): string;
    /**
      * `Beneficiary project: {{id}}`
      */
    ["com.affine.localmind.share.projectAccess.projectBeneficiary"](options: {
        readonly id: string;
    }): string;
    /**
      * `Beneficiary user: {{id}}`
      */
    ["com.affine.localmind.share.projectAccess.userBeneficiary"](options: {
        readonly id: string;
    }): string;
    /**
      * `Requested by: {{id}}`
      */
    ["com.affine.localmind.share.projectAccess.requester"](options: {
        readonly id: string;
    }): string;
    /**
      * `{{level}} · {{source}} · granted by {{grantor}} · {{time}}`
      */
    ["com.affine.localmind.share.projectAccess.grantMeta"](options: Readonly<{
        level: string;
        source: string;
        grantor: string;
        time: string;
    }>): string;
    /**
      * `No project copy permissions have been approved.`
      */
    ["com.affine.localmind.share.projectAccess.empty"](): string;
    /**
      * `Approve`
      */
    ["com.affine.localmind.share.projectAccess.approve"](): string;
    /**
      * `Reject`
      */
    ["com.affine.localmind.share.projectAccess.reject"](): string;
    /**
      * `Access approved`
      */
    ["com.affine.localmind.share.projectAccess.approved"](): string;
    /**
      * `Access rejected`
      */
    ["com.affine.localmind.share.projectAccess.rejected"](): string;
    /**
      * `Could not update project access`
      */
    ["com.affine.localmind.share.projectAccess.actionFailed"](): string;
    /**
      * `Write with a blank page`
      */
    ["com.affine.write_with_a_blank_page"](): string;
    /**
      * `Yesterday`
      */
    ["com.affine.yesterday"](): string;
    /**
      * `Inactive`
      */
    ["com.affine.inactive"](): string;
    /**
      * `Inactive member`
      */
    ["com.affine.inactive-member"](): string;
    /**
      * `Inactive workspace`
      */
    ["com.affine.inactive-workspace"](): string;
    /**
      * `Display Properties`
      */
    ["com.affine.all-docs.display.properties"](): string;
    /**
      * `List view options`
      */
    ["com.affine.all-docs.display.list-view"](): string;
    /**
      * `Icon`
      */
    ["com.affine.all-docs.display.list-view.icon"](): string;
    /**
      * `Body`
      */
    ["com.affine.all-docs.display.list-view.body"](): string;
    /**
      * `Quick actions`
      */
    ["com.affine.all-docs.quick-actions"](): string;
    /**
      * `Favorite`
      */
    ["com.affine.all-docs.quick-action.favorite"](): string;
    /**
      * `Move to trash`
      */
    ["com.affine.all-docs.quick-action.trash"](): string;
    /**
      * `Open in split view`
      */
    ["com.affine.all-docs.quick-action.split"](): string;
    /**
      * `Open in new tab`
      */
    ["com.affine.all-docs.quick-action.tab"](): string;
    /**
      * `Select checkbox`
      */
    ["com.affine.all-docs.quick-action.select"](): string;
    /**
      * `Delete permanently`
      */
    ["com.affine.all-docs.quick-action.delete-permanently"](): string;
    /**
      * `Restore`
      */
    ["com.affine.all-docs.quick-action.restore"](): string;
    /**
      * `All`
      */
    ["com.affine.all-docs.pinned-collection.all"](): string;
    /**
      * `Edit collection rules`
      */
    ["com.affine.all-docs.pinned-collection.edit"](): string;
    /**
      * `Template`
      */
    ["com.affine.all-docs.group.is-template"](): string;
    /**
      * `Not Template`
      */
    ["com.affine.all-docs.group.is-not-template"](): string;
    /**
      * `Journal`
      */
    ["com.affine.all-docs.group.is-journal"](): string;
    /**
      * `Not Journal`
      */
    ["com.affine.all-docs.group.is-not-journal"](): string;
    /**
      * `Checked`
      */
    ["com.affine.all-docs.group.is-checked"](): string;
    /**
      * `Unchecked`
      */
    ["com.affine.all-docs.group.is-not-checked"](): string;
    /**
      * `Never updated`
      */
    ["com.affine.all-docs.group.updated-at.never-updated"](): string;
    /**
      * `core`
      */
    core(): string;
    /**
      * `Dark`
      */
    dark(): string;
    /**
      * `invited you to join`
      */
    ["invited you to join"](): string;
    /**
      * `Light`
      */
    light(): string;
    /**
      * `Others`
      */
    others(): string;
    /**
      * `System`
      */
    system(): string;
    /**
      * `unnamed`
      */
    unnamed(): string;
    /**
      * `Please upgrade to the latest version of Chrome for the best experience.`
      */
    upgradeBrowser(): string;
    /**
      * `Workspace properties`
      */
    ["com.affine.workspace.properties"](): string;
    /**
      * `Rename to "{{name}}"`
      */
    ["com.affine.m.rename-to"](options: {
        readonly name: string;
    }): string;
    /**
      * `Rename`
      */
    ["com.affine.m.explorer.folder.rename"](): string;
    /**
      * `Create Folder`
      */
    ["com.affine.m.explorer.folder.new-dialog-title"](): string;
    /**
      * `Organize`
      */
    ["com.affine.m.explorer.folder.root"](): string;
    /**
      * `Create a folder in the {{parent}}.`
      */
    ["com.affine.m.explorer.folder.new-tip-empty"](options: {
        readonly parent: string;
    }): string;
    /**
      * `Create "{{value}}" in the {{parent}}.`
      */
    ["com.affine.m.explorer.folder.new-tip-not-empty"](options: Readonly<{
        value: string;
        parent: string;
    }>): string;
    /**
      * `Done`
      */
    ["com.affine.m.explorer.folder.rename-confirm"](): string;
    /**
      * `Rename`
      */
    ["com.affine.m.explorer.tag.rename"](): string;
    /**
      * `Rename Tag`
      */
    ["com.affine.m.explorer.tag.rename-menu-title"](): string;
    /**
      * `Create Tag`
      */
    ["com.affine.m.explorer.tag.new-dialog-title"](): string;
    /**
      * `Done`
      */
    ["com.affine.m.explorer.tag.rename-confirm"](): string;
    /**
      * `Create a tag in this workspace.`
      */
    ["com.affine.m.explorer.tag.new-tip-empty"](): string;
    /**
      * `Create "{{value}}" tag in this workspace.`
      */
    ["com.affine.m.explorer.tag.new-tip-not-empty"](options: {
        readonly value: string;
    }): string;
    /**
      * `Manage Doc(s)`
      */
    ["com.affine.m.explorer.tag.manage-docs"](): string;
    /**
      * `Rename`
      */
    ["com.affine.m.explorer.collection.rename"](): string;
    /**
      * `Rename Collection`
      */
    ["com.affine.m.explorer.collection.rename-menu-title"](): string;
    /**
      * `Create Collection`
      */
    ["com.affine.m.explorer.collection.new-dialog-title"](): string;
    /**
      * `Rename`
      */
    ["com.affine.m.explorer.doc.rename"](): string;
    /**
      * `Doc`
      */
    ["com.affine.m.selector.type-doc"](): string;
    /**
      * `Tag`
      */
    ["com.affine.m.selector.type-tag"](): string;
    /**
      * `Collection`
      */
    ["com.affine.m.selector.type-collection"](): string;
    /**
      * `Folder`
      */
    ["com.affine.m.selector.where-folder"](): string;
    /**
      * `Tag`
      */
    ["com.affine.m.selector.where-tag"](): string;
    /**
      * `Collection`
      */
    ["com.affine.m.selector.where-collection"](): string;
    /**
      * `Apply`
      */
    ["com.affine.m.selector.confirm-default"](): string;
    /**
      * `Manage {{type}}(s)`
      */
    ["com.affine.m.selector.title"](options: {
        readonly type: string;
    }): string;
    /**
      * `{{total}} item(s)`
      */
    ["com.affine.m.selector.info-total"](options: {
        readonly total: string;
    }): string;
    /**
      * `Add {{count}} {{type}}(s)`
      */
    ["com.affine.m.selector.info-added"](options: Readonly<{
        count: string;
        type: string;
    }>): string;
    /**
      * `Remove {{count}} {{type}}(s)`
      */
    ["com.affine.m.selector.info-removed"](options: Readonly<{
        count: string;
        type: string;
    }>): string;
    /**
      * `Remove items`
      */
    ["com.affine.m.selector.remove-warning.title"](): string;
    /**
      * `You unchecked {{type}} that already exist in the current {{where}}, which means you will remove them from this {{where}}. The item will not be deleted.`
      */
    ["com.affine.m.selector.remove-warning.message"](options: Readonly<{
        type: string;
        where: string;
    }>): string;
    /**
      * `Do not ask again`
      */
    ["com.affine.m.selector.remove-warning.confirm"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.m.selector.remove-warning.cancel"](): string;
    /**
      * `tag`
      */
    ["com.affine.m.selector.remove-warning.where-tag"](): string;
    /**
      * `folder`
      */
    ["com.affine.m.selector.remove-warning.where-folder"](): string;
    /**
      * `Today's activity`
      */
    ["com.affine.m.selector.journal-menu.today-activity"](): string;
    /**
      * `Duplicate Entries in Today's Journal`
      */
    ["com.affine.m.selector.journal-menu.conflicts"](): string;
    /**
      * `Unable to preview this file`
      */
    ["com.affine.attachment.preview.error.title"](): string;
    /**
      * `file type not supported.`
      */
    ["com.affine.attachment.preview.error.subtitle"](): string;
    /**
      * `Failed to render page.`
      */
    ["com.affine.pdf.page.render.error"](): string;
    /**
      * `Duplicate Entries in Today's Journal`
      */
    ["com.affine.editor.journal-conflict.title"](): string;
    /**
      * `Search for "{{query}}"`
      */
    ["com.affine.editor.at-menu.link-to-doc"](options: {
        readonly query: string;
    }): string;
    /**
      * `Recent`
      */
    ["com.affine.editor.at-menu.recent-docs"](): string;
    /**
      * `Tags`
      */
    ["com.affine.editor.at-menu.tags"](): string;
    /**
      * `Collections`
      */
    ["com.affine.editor.at-menu.collections"](): string;
    /**
      * `Loading...`
      */
    ["com.affine.editor.at-menu.loading"](): string;
    /**
      * `New`
      */
    ["com.affine.editor.at-menu.new-doc"](): string;
    /**
      * `New "{{name}}" page`
      */
    ["com.affine.editor.at-menu.create-page"](options: {
        readonly name: string;
    }): string;
    /**
      * `New "{{name}}" edgeless`
      */
    ["com.affine.editor.at-menu.create-edgeless"](options: {
        readonly name: string;
    }): string;
    /**
      * `Import`
      */
    ["com.affine.editor.at-menu.import"](): string;
    /**
      * `{{count}} more docs`
      */
    ["com.affine.editor.at-menu.more-docs-hint"](options: {
        readonly count: string;
    }): string;
    /**
      * `{{count}} more members`
      */
    ["com.affine.editor.at-menu.more-members-hint"](options: {
        readonly count: string;
    }): string;
    /**
      * `Journal`
      */
    ["com.affine.editor.at-menu.journal"](): string;
    /**
      * `Select a specific date`
      */
    ["com.affine.editor.at-menu.date-picker"](): string;
    /**
      * `Mention Members`
      */
    ["com.affine.editor.at-menu.mention-members"](): string;
    /**
      * `Member not notified`
      */
    ["com.affine.editor.at-menu.member-not-notified"](): string;
    /**
      * `This member does not have access to this doc, they are not notified.`
      */
    ["com.affine.editor.at-menu.member-not-notified-message"](): string;
    /**
      * `Invited and notified`
      */
    ["com.affine.editor.at-menu.invited-and-notified"](): string;
    /**
      * `Access needed`
      */
    ["com.affine.editor.at-menu.access-needed"](): string;
    /**
      * `{{username}} does not have access to this doc, do you want to invite and notify them?`
      */
    ["com.affine.editor.at-menu.access-needed-message"](options: {
        readonly username: string;
    }): string;
    /**
      * `Show`
      */
    ["com.affine.editor.bi-directional-link-panel.show"](): string;
    /**
      * `Hide`
      */
    ["com.affine.editor.bi-directional-link-panel.hide"](): string;
    /**
      * `Fold page block`
      */
    ["com.affine.editor.edgeless-note-header.fold-page-block"](): string;
    /**
      * `Open in Page`
      */
    ["com.affine.editor.edgeless-note-header.open-in-page"](): string;
    /**
      * `Fold`
      */
    ["com.affine.editor.edgeless-embed-synced-doc-header.fold"](): string;
    /**
      * `Unfold`
      */
    ["com.affine.editor.edgeless-embed-synced-doc-header.unfold"](): string;
    /**
      * `Open`
      */
    ["com.affine.editor.edgeless-embed-synced-doc-header.open"](): string;
    /**
      * `Empower Your Team with Seamless Collaboration`
      */
    ["com.affine.upgrade-to-team-page.title"](): string;
    /**
      * `Select an existing workspace or create a new one`
      */
    ["com.affine.upgrade-to-team-page.workspace-selector.placeholder"](): string;
    /**
      * `Create Workspace`
      */
    ["com.affine.upgrade-to-team-page.workspace-selector.create-workspace"](): string;
    /**
      * `Upgrade to Team Workspace`
      */
    ["com.affine.upgrade-to-team-page.upgrade-button"](): string;
    /**
      * `Team Workspace gives you everything you need for seamless team collaboration:`
      */
    ["com.affine.upgrade-to-team-page.benefit.title"](): string;
    /**
      * `Invite unlimited members to your workspace`
      */
    ["com.affine.upgrade-to-team-page.benefit.g1"](): string;
    /**
      * `Set custom roles and permissions for better control`
      */
    ["com.affine.upgrade-to-team-page.benefit.g2"](): string;
    /**
      * `Access advanced team management features`
      */
    ["com.affine.upgrade-to-team-page.benefit.g3"](): string;
    /**
      * `Get priority customer support`
      */
    ["com.affine.upgrade-to-team-page.benefit.g4"](): string;
    /**
      * `Perfect for growing teams and organizations that need professional collaboration tools.`
      */
    ["com.affine.upgrade-to-team-page.benefit.description"](): string;
    /**
      * `Upgrade to Team Workspace`
      */
    ["com.affine.upgrade-to-team-page.upgrade-confirm.title"](): string;
    /**
      * `Name Your Workspace`
      */
    ["com.affine.upgrade-to-team-page.create-and-upgrade-confirm.title"](): string;
    /**
      * `A workspace is your virtual space to capture, create and plan as just one person or together as a team.`
      */
    ["com.affine.upgrade-to-team-page.create-and-upgrade-confirm.description"](): string;
    /**
      * `Set a workspace name`
      */
    ["com.affine.upgrade-to-team-page.create-and-upgrade-confirm.placeholder"](): string;
    /**
      * `Continue to Pricing`
      */
    ["com.affine.upgrade-to-team-page.create-and-upgrade-confirm.confirm"](): string;
    /**
      * `No workspace available`
      */
    ["com.affine.upgrade-to-team-page.no-workspace-available"](): string;
    /**
      * `Workspace storage`
      */
    ["com.affine.workspace.storage"](): string;
    /**
      * `Journal`
      */
    ["com.affine.cmdk.affine.category.affine.journal"](): string;
    /**
      * `Select a specific date`
      */
    ["com.affine.cmdk.affine.category.affine.date-picker"](): string;
    /**
      * `Workspace sync paused`
      */
    ["com.affine.payment.sync-paused.title"](): string;
    /**
      * `Your workspace has exceeded both storage and member limits, causing synchronization to pause. To resume syncing, please either:`
      */
    ["com.affine.payment.sync-paused.owner.both.description"](): string;
    /**
      * `Reduce storage usage and remove some team members`
      */
    ["com.affine.payment.sync-paused.owner.both.tips-1"](): string;
    /**
      * `Upgrade your plan for increased capacity`
      */
    ["com.affine.payment.sync-paused.owner.both.tips-2"](): string;
    /**
      * `Your workspace has exceeded its storage limit and synchronization has been paused. To resume syncing, please either:`
      */
    ["com.affine.payment.sync-paused.owner.storage.description"](): string;
    /**
      * `Remove unnecessary files or content to reduce storage usage`
      */
    ["com.affine.payment.sync-paused.owner.storage.tips-1"](): string;
    /**
      * `Upgrade your plan for increased storage capacity`
      */
    ["com.affine.payment.sync-paused.owner.storage.tips-2"](): string;
    /**
      * `Your workspace has reached its maximum member capacity and synchronization has been paused. To resume syncing, you can either`
      */
    ["com.affine.payment.sync-paused.owner.member.description"](): string;
    /**
      * `Remove some team members from the workspace`
      */
    ["com.affine.payment.sync-paused.owner.member.tips-1"](): string;
    /**
      * `Upgrade your plan to accommodate more members`
      */
    ["com.affine.payment.sync-paused.owner.member.tips-2"](): string;
    /**
      * `This workspace has exceeded both storage and member limits, causing synchronization to pause. Please contact your workspace owner to address these limits and resume syncing.`
      */
    ["com.affine.payment.sync-paused.member.both.description"](): string;
    /**
      * `This workspace has exceeded its storage limit and synchronization has been paused. Please contact your workspace owner to either reduce storage usage or upgrade the plan to resume syncing.`
      */
    ["com.affine.payment.sync-paused.member.storage.description"](): string;
    /**
      * `This workspace has reached its maximum member capacity and synchronization has been paused. Please contact your workspace owner to either adjust team membership or upgrade the plan to resume syncing.`
      */
    ["com.affine.payment.sync-paused.member.member.description"](): string;
    /**
      * `Got It`
      */
    ["com.affine.payment.sync-paused.member.member.confirm"](): string;
    /**
      * `Delete Server`
      */
    ["com.affine.server.delete"](): string;
    /**
      * `Start`
      */
    ["com.affine.page-starter-bar.start"](): string;
    /**
      * `Template`
      */
    ["com.affine.page-starter-bar.template"](): string;
    /**
      * `With AI`
      */
    ["com.affine.page-starter-bar.ai"](): string;
    /**
      * `Edgeless`
      */
    ["com.affine.page-starter-bar.edgeless"](): string;
    /**
      * `Unsupported message`
      */
    ["com.affine.notification.unsupported"](): string;
    /**
      * `What are your thoughts?`
      */
    ["com.affine.notification.comment-prompt"](): string;
    /**
      * `No new notifications`
      */
    ["com.affine.notification.empty"](): string;
    /**
      * `No notifications`
      */
    ["com.affine.notification.empty.all"](): string;
    /**
      * `Notifications you keep will appear here.`
      */
    ["com.affine.notification.empty.all.description"](): string;
    /**
      * `Loading more...`
      */
    ["com.affine.notification.loading-more"](): string;
    /**
      * `You'll be notified here for @mentions and workspace invites.`
      */
    ["com.affine.notification.empty.description"](): string;
    /**
      * `Open workspace`
      */
    ["com.affine.notification.invitation-review-approved.open-workspace"](): string;
    /**
      * `Accept & Join`
      */
    ["com.affine.notification.invitation.accept"](): string;
    /**
      * `Unread`
      */
    ["com.affine.notification.filter.unread"](): string;
    /**
      * `All`
      */
    ["com.affine.notification.filter.all"](): string;
    /**
      * `Mark all as read`
      */
    ["com.affine.notification.mark-all-read"](): string;
    /**
      * `Mark as read`
      */
    ["com.affine.notification.mark-read"](): string;
    /**
      * `Clear all notifications`
      */
    ["com.affine.notification.clear-all"](): string;
    /**
      * `Clear all read and unread notifications from your inbox? This cannot be undone. Tasks, file requests and access requests will remain unchanged.`
      */
    ["com.affine.notification.clear-all.confirmation"](): string;
    /**
      * `Delete read notifications`
      */
    ["com.affine.notification.delete-read"](): string;
    /**
      * `Delete notification`
      */
    ["com.affine.notification.delete"](): string;
    /**
      * `More notification actions`
      */
    ["com.affine.notification.more-actions"](): string;
    /**
      * `Tips`
      */
    tips(): string;
    /**
      * `Template`
      */
    Template(): string;
    /**
      * `Delete Template`
      */
    ["com.affine.template-list.delete"](): string;
    /**
      * `No template`
      */
    ["com.affine.template-list.empty"](): string;
    /**
      * `Create new template`
      */
    ["com.affine.template-list.create-new"](): string;
    /**
      * `Set a Template for the Journal`
      */
    ["com.affine.template-journal-onboarding.title"](): string;
    /**
      * `Select`
      */
    ["com.affine.template-journal-onboarding.select"](): string;
    /**
      * `My Templates`
      */
    ["com.affine.settings.workspace.template.title"](): string;
    /**
      * `Template for journal`
      */
    ["com.affine.settings.workspace.template.journal"](): string;
    /**
      * `Select a template for your journal`
      */
    ["com.affine.settings.workspace.template.journal-desc"](): string;
    /**
      * `Keep empty`
      */
    ["com.affine.settings.workspace.template.keep-empty"](): string;
    /**
      * `New doc with template`
      */
    ["com.affine.settings.workspace.template.page"](): string;
    /**
      * `New docs will use the specified template, ignoring default settings.`
      */
    ["com.affine.settings.workspace.template.page-desc"](): string;
    /**
      * `Template for new doc`
      */
    ["com.affine.settings.workspace.template.page-select"](): string;
    /**
      * `Remove template`
      */
    ["com.affine.settings.workspace.template.remove"](): string;
    /**
      * `You don't have permission to do this`
      */
    ["com.affine.no-permission"](): string;
    /**
      * `Unused blobs`
      */
    ["com.affine.settings.workspace.storage.unused-blobs"](): string;
    /**
      * `No unused blobs`
      */
    ["com.affine.settings.workspace.storage.unused-blobs.empty"](): string;
    /**
      * `Selected`
      */
    ["com.affine.settings.workspace.storage.unused-blobs.selected"](): string;
    /**
      * `Delete blob files`
      */
    ["com.affine.settings.workspace.storage.unused-blobs.delete.title"](): string;
    /**
      * `Are you sure you want to delete these blob files? This action cannot be undone. Make sure you no longer need them before proceeding.`
      */
    ["com.affine.settings.workspace.storage.unused-blobs.delete.warning"](): string;
    /**
      * `Join Failed`
      */
    ["com.affine.fail-to-join-workspace.title"](): string;
    /**
      * `Please contact your workspace owner to add more seats.`
      */
    ["com.affine.fail-to-join-workspace.description-2"](): string;
    /**
      * `Request to join`
      */
    ["com.affine.request-to-join-workspace.button"](): string;
    /**
      * `Request Sent successfully`
      */
    ["com.affine.sent-request-to-join-workspace.title"](): string;
    /**
      * `Request failed to send`
      */
    ["com.affine.failed-to-send-request.title"](): string;
    /**
      * `Readwise`
      */
    ["com.affine.integration.name.readwise"](): string;
    /**
      * `Integrations`
      */
    ["com.affine.integration.integrations"](): string;
    /**
      * `Web Clipper`
      */
    ["com.affine.integration.web-clipper.name"](): string;
    /**
      * `Import web pages to LocalMind`
      */
    ["com.affine.integration.web-clipper.desc"](): string;
    /**
      * `Elevate your LocalMind experience with diverse add-ons and seamless integrations.`
      */
    ["com.affine.integration.setting.description"](): string;
    /**
      * `Learn how to develop a integration for LocalMind`
      */
    ["com.affine.integration.setting.learn"](): string;
    /**
      * `Readwise`
      */
    ["com.affine.integration.readwise.name"](): string;
    /**
      * `Manually import your content to LocalMind from Readwise`
      */
    ["com.affine.integration.readwise.desc"](): string;
    /**
      * `Connect`
      */
    ["com.affine.integration.readwise.connect"](): string;
    /**
      * `Connect to Readwise`
      */
    ["com.affine.integration.readwise.connect.title"](): string;
    /**
      * `Paste your access token here`
      */
    ["com.affine.integration.readwise.connect.placeholder"](): string;
    /**
      * `Please enter a valid access token.`
      */
    ["com.affine.integration.readwise.connect.input-error"](): string;
    /**
      * `Access Token failed validation`
      */
    ["com.affine.integration.readwise.connect.error-notify-title"](): string;
    /**
      * `The token could not access Readwise. Please verify access and try again.`
      */
    ["com.affine.integration.readwise.connect.error-notify-desc"](): string;
    /**
      * `Import`
      */
    ["com.affine.integration.readwise.import"](): string;
    /**
      * `Disconnect`
      */
    ["com.affine.integration.readwise.disconnect"](): string;
    /**
      * `Disconnect Readwise?`
      */
    ["com.affine.integration.readwise.disconnect.title"](): string;
    /**
      * `Once disconnected, content will no longer be imported. Do you want to keep your existing highlights in LocalMind?`
      */
    ["com.affine.integration.readwise.disconnect.desc"](): string;
    /**
      * `Keep`
      */
    ["com.affine.integration.readwise.disconnect.keep"](): string;
    /**
      * `Delete`
      */
    ["com.affine.integration.readwise.disconnect.delete"](): string;
    /**
      * `Highlights to be imported this time`
      */
    ["com.affine.integration.readwise.import.title"](): string;
    /**
      * `Importing everything from the start`
      */
    ["com.affine.integration.readwise.import.desc-from-start"](): string;
    /**
      * `Content`
      */
    ["com.affine.integration.readwise.import.cell-h-content"](): string;
    /**
      * `Todo`
      */
    ["com.affine.integration.readwise.import.cell-h-todo"](): string;
    /**
      * `Last update on Readwise`
      */
    ["com.affine.integration.readwise.import.cell-h-time"](): string;
    /**
      * `New`
      */
    ["com.affine.integration.readwise.import.todo-new"](): string;
    /**
      * `Skip`
      */
    ["com.affine.integration.readwise.import.todo-skip"](): string;
    /**
      * `Updated`
      */
    ["com.affine.integration.readwise.import.todo-update"](): string;
    /**
      * `No highlights needs to be imported`
      */
    ["com.affine.integration.readwise.import.empty"](): string;
    /**
      * `Importing...`
      */
    ["com.affine.integration.readwise.import.importing"](): string;
    /**
      * `Please keep this app active until it's finished`
      */
    ["com.affine.integration.readwise.import.importing-desc"](): string;
    /**
      * `Stop Importing`
      */
    ["com.affine.integration.readwise.import.importing-stop"](): string;
    /**
      * `Importing aborted`
      */
    ["com.affine.integration.readwise.import.abort-notify-title"](): string;
    /**
      * `Import aborted, with {{finished}} highlights processed`
      */
    ["com.affine.integration.readwise.import.abort-notify-desc"](options: {
        readonly finished: string;
    }): string;
    /**
      * `Configuration`
      */
    ["com.affine.integration.readwise.setting.caption"](): string;
    /**
      * `New Readwise highlights will be imported to LocalMind `
      */
    ["com.affine.integration.readwise.setting.sync-new-name"](): string;
    /**
      * `New highlights in Readwise will be synced to LocalMind `
      */
    ["com.affine.integration.readwise.setting.sync-new-desc"](): string;
    /**
      * `Updates to Readwise highlights will be imported`
      */
    ["com.affine.integration.readwise.setting.update-name"](): string;
    /**
      * `Enable this, so that we will process updates of existing highlights from Readwise `
      */
    ["com.affine.integration.readwise.setting.update-desc"](): string;
    /**
      * `How do we handle updates`
      */
    ["com.affine.integration.readwise.setting.update-strategy"](): string;
    /**
      * `Append new version to the end`
      */
    ["com.affine.integration.readwise.setting.update-append-name"](): string;
    /**
      * `Cited or modified highlights will have future versions added to the end of them`
      */
    ["com.affine.integration.readwise.setting.update-append-desc"](): string;
    /**
      * `Overwrite with new version`
      */
    ["com.affine.integration.readwise.setting.update-override-name"](): string;
    /**
      * `Cited or modified highlights will be overwritten if there are future updates`
      */
    ["com.affine.integration.readwise.setting.update-override-desc"](): string;
    /**
      * `Start Importing`
      */
    ["com.affine.integration.readwise.setting.start-import-name"](): string;
    /**
      * `Using the settings above`
      */
    ["com.affine.integration.readwise.setting.start-import-desc"](): string;
    /**
      * `Import`
      */
    ["com.affine.integration.readwise.setting.start-import-button"](): string;
    /**
      * `Apply tags to highlight imports`
      */
    ["com.affine.integration.readwise.setting.tags-label"](): string;
    /**
      * `Click to add tags`
      */
    ["com.affine.integration.readwise.setting.tags-placeholder"](): string;
    /**
      * `Author`
      */
    ["com.affine.integration.readwise-prop.author"](): string;
    /**
      * `Source`
      */
    ["com.affine.integration.readwise-prop.source"](): string;
    /**
      * `Created`
      */
    ["com.affine.integration.readwise-prop.created"](): string;
    /**
      * `Updated`
      */
    ["com.affine.integration.readwise-prop.updated"](): string;
    /**
      * `Integration properties`
      */
    ["com.affine.integration.properties"](): string;
    /**
      * `Calendar`
      */
    ["com.affine.integration.calendar.name"](): string;
    /**
      * `New events will be scheduled in LocalMind’s journal`
      */
    ["com.affine.integration.calendar.desc"](): string;
    /**
      * `Subscribe`
      */
    ["com.affine.integration.calendar.new-subscription"](): string;
    /**
      * `Unsubscribe`
      */
    ["com.affine.integration.calendar.unsubscribe"](): string;
    /**
      * `Add a calendar by URL`
      */
    ["com.affine.integration.calendar.new-title"](): string;
    /**
      * `Calendar URL`
      */
    ["com.affine.integration.calendar.new-url-label"](): string;
    /**
      * `An error occurred while saving the calendar settings`
      */
    ["com.affine.integration.calendar.save-error"](): string;
    /**
      * `All day`
      */
    ["com.affine.integration.calendar.all-day"](): string;
    /**
      * `Failed to load calendar accounts`
      */
    ["com.affine.integration.calendar.account.load-error"](): string;
    /**
      * `Failed to load calendar providers`
      */
    ["com.affine.integration.calendar.provider.load-error"](): string;
    /**
      * `Failed to start calendar authorization`
      */
    ["com.affine.integration.calendar.auth.start-error"](): string;
    /**
      * `Failed to unlink calendar account`
      */
    ["com.affine.integration.calendar.account.unlink-error"](): string;
    /**
      * `Unlink`
      */
    ["com.affine.integration.calendar.account.unlink"](): string;
    /**
      * `Link`
      */
    ["com.affine.integration.calendar.account.link"](): string;
    /**
      * `No calendar accounts linked yet.`
      */
    ["com.affine.integration.calendar.account.linked-empty"](): string;
    /**
      * `Authorization failed: {{error}}`
      */
    ["com.affine.integration.calendar.account.status.failed"](options: {
        readonly error: string;
    }): string;
    /**
      * `Authorization failed. Please reconnect your account.`
      */
    ["com.affine.integration.calendar.account.status.failed-reconnect"](): string;
    /**
      * `{{count}} calendar`
      */
    ["com.affine.integration.calendar.account.count"](options: {
        readonly count: string;
    }): string;
    /**
      * `Link CalDAV account`
      */
    ["com.affine.integration.calendar.caldav.link.title"](): string;
    /**
      * `Failed to link CalDAV account`
      */
    ["com.affine.integration.calendar.caldav.link.failed"](): string;
    /**
      * `Provider`
      */
    ["com.affine.integration.calendar.caldav.field.provider"](): string;
    /**
      * `Select provider`
      */
    ["com.affine.integration.calendar.caldav.field.provider.placeholder"](): string;
    /**
      * `Please select a provider.`
      */
    ["com.affine.integration.calendar.caldav.field.provider.error"](): string;
    /**
      * `Username`
      */
    ["com.affine.integration.calendar.caldav.field.username"](): string;
    /**
      * `email@example.com`
      */
    ["com.affine.integration.calendar.caldav.field.username.placeholder"](): string;
    /**
      * `Username is required.`
      */
    ["com.affine.integration.calendar.caldav.field.username.error"](): string;
    /**
      * `Password`
      */
    ["com.affine.integration.calendar.caldav.field.password"](): string;
    /**
      * `Password or app-specific password`
      */
    ["com.affine.integration.calendar.caldav.field.password.placeholder"](): string;
    /**
      * `Password is required.`
      */
    ["com.affine.integration.calendar.caldav.field.password.error"](): string;
    /**
      * `Display name (optional)`
      */
    ["com.affine.integration.calendar.caldav.field.displayName"](): string;
    /**
      * `My CalDAV`
      */
    ["com.affine.integration.calendar.caldav.field.displayName.placeholder"](): string;
    /**
      * `App-specific password required.`
      */
    ["com.affine.integration.calendar.caldav.hint.app-password"](): string;
    /**
      * `Learn more`
      */
    ["com.affine.integration.calendar.caldav.hint.learn-more"](): string;
    /**
      * `Provider setup guide`
      */
    ["com.affine.integration.calendar.caldav.hint.guide"](): string;
    /**
      * `New doc`
      */
    ["com.affine.integration.calendar.new-doc"](): string;
    /**
      * `Show calendar events`
      */
    ["com.affine.integration.calendar.show-events"](): string;
    /**
      * `Enabling this setting allows you to connect your calendar events to your Journal in LocalMind`
      */
    ["com.affine.integration.calendar.show-events-desc"](): string;
    /**
      * `Show all day event`
      */
    ["com.affine.integration.calendar.show-all-day-events"](): string;
    /**
      * `Are you sure you want to unsubscribe "{{name}}"? Unsubscribing this account will remove its data from Journal.`
      */
    ["com.affine.integration.calendar.unsubscribe-content"](options: {
        readonly name: string;
    }): string;
    /**
      * `No journal page found for {{date}}. Please create a journal page first.`
      */
    ["com.affine.integration.calendar.no-journal"](options: {
        readonly date: string;
    }): string;
    /**
      * `No subscribed calendars yet.`
      */
    ["com.affine.integration.calendar.no-calendar"](): string;
    /**
      * `SparkClaw`
      */
    ["com.affine.integration.sparkclaw.name"](): string;
    /**
      * `Connect`
      */
    ["com.affine.integration.sparkclaw.connect"](): string;
    /**
      * `Connect SparkClaw`
      */
    ["com.affine.integration.sparkclaw.connect-title"](): string;
    /**
      * `SparkClaw device`
      */
    ["com.affine.integration.sparkclaw.device"](): string;
    /**
      * `Disconnect`
      */
    ["com.affine.integration.sparkclaw.disconnect"](): string;
    /**
      * `No SparkClaw devices connected yet.`
      */
    ["com.affine.integration.sparkclaw.empty"](): string;
    /**
      * `Failed to load SparkClaw devices`
      */
    ["com.affine.integration.sparkclaw.load-error"](): string;
    /**
      * `Failed to start SparkClaw pairing`
      */
    ["com.affine.integration.sparkclaw.connect-error"](): string;
    /**
      * `Failed to disconnect SparkClaw`
      */
    ["com.affine.integration.sparkclaw.disconnect-error"](): string;
    /**
      * `MCP Server`
      */
    ["com.affine.integration.mcp-server.name"](): string;
    /**
      * `Delegate workspace tasks from external AI clients to LocalMind's built-in AI.`
      */
    ["com.affine.integration.mcp-server.desc"](): string;
    /**
      * `The MCP token is shown only once. Delete and recreate it to copy the JSON configuration.`
      */
    ["com.affine.integration.mcp-server.copy-json.disabled-hint"](): string;
    /**
      * `Credentials`
      */
    ["com.affine.integration.mcp-server.credentials.title"](): string;
    /**
      * `Use a separate credential for each MCP client so it can be revoked independently.`
      */
    ["com.affine.integration.mcp-server.credentials.description"](): string;
    /**
      * `Create credential`
      */
    ["com.affine.integration.mcp-server.action.create"](): string;
    /**
      * `Rotate`
      */
    ["com.affine.integration.mcp-server.action.rotate"](): string;
    /**
      * `Revoke credential`
      */
    ["com.affine.integration.mcp-server.action.revoke"](): string;
    /**
      * `Copy token`
      */
    ["com.affine.integration.mcp-server.action.copy-token"](): string;
    /**
      * `Copy callback secret`
      */
    ["com.affine.integration.mcp-server.action.copy-callback-secret"](): string;
    /**
      * `Copy JSON`
      */
    ["com.affine.integration.mcp-server.action.copy-json"](): string;
    /**
      * `Done`
      */
    ["com.affine.integration.mcp-server.action.done"](): string;
    /**
      * `Failed to load MCP credentials.`
      */
    ["com.affine.integration.mcp-server.load-error"](): string;
    /**
      * `No MCP credentials`
      */
    ["com.affine.integration.mcp-server.empty.title"](): string;
    /**
      * `Create a workspace-bound credential to connect an MCP client.`
      */
    ["com.affine.integration.mcp-server.empty.description"](): string;
    /**
      * `Read only`
      */
    ["com.affine.integration.mcp-server.access.read-only"](): string;
    /**
      * `Can read and search documents in this workspace using your current permissions.`
      */
    ["com.affine.integration.mcp-server.access.read-only-desc"](): string;
    /**
      * `Read and write`
      */
    ["com.affine.integration.mcp-server.access.read-write"](): string;
    /**
      * `Expires {{date}}`
      */
    ["com.affine.integration.mcp-server.meta.expires"](options: {
        readonly date: string;
    }): string;
    /**
      * `Created {{date}}`
      */
    ["com.affine.integration.mcp-server.meta.created"](options: {
        readonly date: string;
    }): string;
    /**
      * `Last used {{date}}`
      */
    ["com.affine.integration.mcp-server.meta.last-used"](options: {
        readonly date: string;
    }): string;
    /**
      * `Never used`
      */
    ["com.affine.integration.mcp-server.meta.never-used"](): string;
    /**
      * `Old token valid until {{date}}`
      */
    ["com.affine.integration.mcp-server.meta.grace-until"](options: {
        readonly date: string;
    }): string;
    /**
      * `Result notifications configured`
      */
    ["com.affine.integration.mcp-server.meta.callback-configured"](): string;
    /**
      * `Result notifications not configured`
      */
    ["com.affine.integration.mcp-server.meta.callback-not-configured"](): string;
    /**
      * `Active`
      */
    ["com.affine.integration.mcp-server.status.active"](): string;
    /**
      * `Rotating`
      */
    ["com.affine.integration.mcp-server.status.rotating"](): string;
    /**
      * `Expiring`
      */
    ["com.affine.integration.mcp-server.status.expiring"](): string;
    /**
      * `Expired`
      */
    ["com.affine.integration.mcp-server.status.expired"](): string;
    /**
      * `Revoked`
      */
    ["com.affine.integration.mcp-server.status.revoked"](): string;
    /**
      * `Create MCP credential`
      */
    ["com.affine.integration.mcp-server.create.title"](): string;
    /**
      * `This credential is limited to the selected LocalMind AI tools and this workspace.`
      */
    ["com.affine.integration.mcp-server.create.description"](): string;
    /**
      * `Label`
      */
    ["com.affine.integration.mcp-server.field.label"](): string;
    /**
      * `Allowed AI tools`
      */
    ["com.affine.integration.mcp-server.field.access"](): string;
    /**
      * `Expires in`
      */
    ["com.affine.integration.mcp-server.field.expiry"](): string;
    /**
      * `Result notification URL`
      */
    ["com.affine.integration.mcp-server.field.callback-url"](): string;
    /**
      * `{{days}} days`
      */
    ["com.affine.integration.mcp-server.expiry.days"](options: {
        readonly days: string;
    }): string;
    /**
      * `MCP credential created`
      */
    ["com.affine.integration.mcp-server.reveal.title"](): string;
    /**
      * `Copy this credential now. You won’t be able to see it again.`
      */
    ["com.affine.integration.mcp-server.reveal.warning"](): string;
    /**
      * `The old token remains valid until {{date}}.`
      */
    ["com.affine.integration.mcp-server.reveal.old-valid-until"](options: {
        readonly date: string;
    }): string;
    /**
      * `Credential`
      */
    ["com.affine.integration.mcp-server.reveal.token"](): string;
    /**
      * `Callback signing secret`
      */
    ["com.affine.integration.mcp-server.reveal.callback-secret"](): string;
    /**
      * `MCP configuration`
      */
    ["com.affine.integration.mcp-server.reveal.config"](): string;
    /**
      * `Rotate this credential?`
      */
    ["com.affine.integration.mcp-server.rotate.title"](): string;
    /**
      * `A new token will be created immediately. The old token remains valid for up to 24 hours so you can update the MCP client.`
      */
    ["com.affine.integration.mcp-server.rotate.description"](): string;
    /**
      * `Revoke “{{name}}”?`
      */
    ["com.affine.integration.mcp-server.revoke.title"](options: {
        readonly name: string;
    }): string;
    /**
      * `All generations of this credential will stop working immediately. This cannot be undone.`
      */
    ["com.affine.integration.mcp-server.revoke.description"](): string;
    /**
      * `LocalMind AI tool permissions`
      */
    ["com.affine.integration.mcp-server.capabilities.title"](): string;
    /**
      * `Read documents`
      */
    ["com.affine.integration.mcp-server.capabilities.read"](): string;
    /**
      * `Keyword search`
      */
    ["com.affine.integration.mcp-server.capabilities.keyword-search"](): string;
    /**
      * `Semantic search`
      */
    ["com.affine.integration.mcp-server.capabilities.semantic-search"](): string;
    /**
      * `Create and update documents`
      */
    ["com.affine.integration.mcp-server.capabilities.write"](): string;
    /**
      * `Allow`
      */
    ["com.affine.integration.mcp-server.capability.allow"](): string;
    /**
      * `Upload attachments`
      */
    ["com.affine.integration.mcp-server.capability.attachment"](): string;
    /**
      * `Upload task-bound files for LocalMind AI to process.`
      */
    ["com.affine.integration.mcp-server.capability.attachment.description"](): string;
    /**
      * `Delegate tasks`
      */
    ["com.affine.integration.mcp-server.capability.delegate"](): string;
    /**
      * `Send complete natural-language tasks to the built-in LocalMind AI.`
      */
    ["com.affine.integration.mcp-server.capability.delegate.description"](): string;
    /**
      * `Query task state`
      */
    ["com.affine.integration.mcp-server.capability.query"](): string;
    /**
      * `Read persisted plans, progress, results, and artifacts.`
      */
    ["com.affine.integration.mcp-server.capability.query.description"](): string;
    /**
      * `Cancel tasks`
      */
    ["com.affine.integration.mcp-server.capability.control"](): string;
    /**
      * `Cancel unfinished delegated tasks through LocalMind Agent Runtime.`
      */
    ["com.affine.integration.mcp-server.capability.control.description"](): string;
    /**
      * `Enterprise collaboration`
      */
    ["com.affine.integration.enterprise.name"](): string;
    /**
      * `Let LocalMind AI use authorized WeCom, Lark, and DingTalk CLI capabilities.`
      */
    ["com.affine.integration.enterprise.desc"](): string;
    /**
      * `Failed to load enterprise connections.`
      */
    ["com.affine.integration.enterprise.load-error"](): string;
    /**
      * `No enterprise accounts connected.`
      */
    ["com.affine.integration.enterprise.empty"](): string;
    /**
      * `Add connection`
      */
    ["com.affine.integration.enterprise.connect.title"](): string;
    /**
      * `You authorize your own account. Provider and tool availability is managed by your LocalMind administrator.`
      */
    ["com.affine.integration.enterprise.connect.description"](): string;
    /**
      * `Enterprise connections are disabled by your LocalMind administrator.`
      */
    ["com.affine.integration.enterprise.policy.disabled"](): string;
    /**
      * `No enterprise providers are available for user connections.`
      */
    ["com.affine.integration.enterprise.policy.no-providers"](): string;
    /**
      * `This provider is no longer allowed by the LocalMind administrator. You can still disable or remove the connection.`
      */
    ["com.affine.integration.enterprise.policy.provider-blocked"](): string;
    /**
      * `WeCom`
      */
    ["com.affine.integration.enterprise.provider.wecom"](): string;
    /**
      * `Lark`
      */
    ["com.affine.integration.enterprise.provider.lark"](): string;
    /**
      * `DingTalk`
      */
    ["com.affine.integration.enterprise.provider.dingtalk"](): string;
    /**
      * `Connection name (optional)`
      */
    ["com.affine.integration.enterprise.field.name"](): string;
    /**
      * `Connect`
      */
    ["com.affine.integration.enterprise.action.connect"](): string;
    /**
      * `Authorize`
      */
    ["com.affine.integration.enterprise.action.authorize"](): string;
    /**
      * `Refresh tools`
      */
    ["com.affine.integration.enterprise.action.refresh"](): string;
    /**
      * `Disable`
      */
    ["com.affine.integration.enterprise.action.disable"](): string;
    /**
      * `Official account authorization`
      */
    ["com.affine.integration.enterprise.authorization.description"](): string;
    /**
      * `Waiting for the official authorization challenge...`
      */
    ["com.affine.integration.enterprise.authorization.waiting"](): string;
    /**
      * `The CLI data access request was sent to a DingTalk organization super admin. Waiting for approval...`
      */
    ["com.affine.integration.enterprise.authorization.admin-approval-pending"](): string;
    /**
      * `Open official page`
      */
    ["com.affine.integration.enterprise.authorization.open"](): string;
    /**
      * `Step 1 of 2: Configure or select a Lark CLI app.`
      */
    ["com.affine.integration.enterprise.authorization.lark.configure-ready"](): string;
    /**
      * `Step 2 of 2: Authorize the Lark CLI app.`
      */
    ["com.affine.integration.enterprise.authorization.lark.authorize-ready"](): string;
    /**
      * `Configure Lark CLI app`
      */
    ["com.affine.integration.enterprise.authorization.lark.configure-action"](): string;
    /**
      * `Authorize Lark CLI`
      */
    ["com.affine.integration.enterprise.authorization.lark.authorize-action"](): string;
    /**
      * `Step 3 of 3: Authorize DingTalk CLI permissions for this account.`
      */
    ["com.affine.integration.enterprise.authorization.dingtalk.authorize-ready"](): string;
    /**
      * `Authorize DingTalk CLI`
      */
    ["com.affine.integration.enterprise.authorization.dingtalk.authorize-action"](): string;
    /**
      * `Copy authorization code`
      */
    ["com.affine.integration.enterprise.authorization.copy-code"](): string;
    /**
      * `Authorization code copied`
      */
    ["com.affine.integration.enterprise.authorization.code-copied"](): string;
    /**
      * `Official authorization QR code`
      */
    ["com.affine.integration.enterprise.authorization.qrcode"](): string;
    /**
      * `Enterprise account connected`
      */
    ["com.affine.integration.enterprise.authorization.success"](): string;
    /**
      * `Queued`
      */
    ["com.affine.integration.enterprise.authorization.status.pending"](): string;
    /**
      * `Starting`
      */
    ["com.affine.integration.enterprise.authorization.status.starting"](): string;
    /**
      * `Waiting`
      */
    ["com.affine.integration.enterprise.authorization.status.waiting"](): string;
    /**
      * `Authorized`
      */
    ["com.affine.integration.enterprise.authorization.status.authorized"](): string;
    /**
      * `Failed`
      */
    ["com.affine.integration.enterprise.authorization.status.failed"](): string;
    /**
      * `Expired`
      */
    ["com.affine.integration.enterprise.authorization.status.expired"](): string;
    /**
      * `Cancelled`
      */
    ["com.affine.integration.enterprise.authorization.status.cancelled"](): string;
    /**
      * `Connected`
      */
    ["com.affine.integration.enterprise.status.active"](): string;
    /**
      * `Connecting`
      */
    ["com.affine.integration.enterprise.status.connecting"](): string;
    /**
      * `Degraded`
      */
    ["com.affine.integration.enterprise.status.degraded"](): string;
    /**
      * `Authorization required`
      */
    ["com.affine.integration.enterprise.status.reauth-required"](): string;
    /**
      * `Disabled`
      */
    ["com.affine.integration.enterprise.status.disabled"](): string;
    /**
      * `Authorized identity`
      */
    ["com.affine.integration.enterprise.meta.identity"](): string;
    /**
      * `Last checked`
      */
    ["com.affine.integration.enterprise.meta.last-checked"](): string;
    /**
      * `Available to AI`
      */
    ["com.affine.integration.enterprise.tool.enabled"](): string;
    /**
      * `Allowed by administrator`
      */
    ["com.affine.integration.enterprise.tool.admin-managed"](): string;
    /**
      * `Refresh required`
      */
    ["com.affine.integration.enterprise.tool.refresh-required"](): string;
    /**
      * `Read`
      */
    ["com.affine.integration.enterprise.tool.risk.read"](): string;
    /**
      * `Write`
      */
    ["com.affine.integration.enterprise.tool.risk.write"](): string;
    /**
      * `High risk`
      */
    ["com.affine.integration.enterprise.tool.risk.high"](): string;
    /**
      * `Remove “{{name}}”?`
      */
    ["com.affine.integration.enterprise.delete.title"](options: {
        readonly name: string;
    }): string;
    /**
      * `LocalMind will erase this cloud CLI profile and its authorization credentials.`
      */
    ["com.affine.integration.enterprise.delete.description"](): string;
    /**
      * `SparkClaw MCP`
      */
    ["com.affine.integration.external-mcp.name"](): string;
    /**
      * `Connect this workspace to SparkClaw and make allowlisted capabilities available to LocalMind AI.`
      */
    ["com.affine.integration.external-mcp.desc"](): string;
    /**
      * `Failed to load the SparkClaw MCP connection.`
      */
    ["com.affine.integration.external-mcp.load-error"](): string;
    /**
      * `Connection`
      */
    ["com.affine.integration.external-mcp.connection.title"](): string;
    /**
      * `The access ticket is used only for initialization and is never stored.`
      */
    ["com.affine.integration.external-mcp.connection.description"](): string;
    /**
      * `Name`
      */
    ["com.affine.integration.external-mcp.field.name"](): string;
    /**
      * `Protocol`
      */
    ["com.affine.integration.external-mcp.field.protocol"](): string;
    /**
      * `Endpoint`
      */
    ["com.affine.integration.external-mcp.field.endpoint"](): string;
    /**
      * `One-time access ticket`
      */
    ["com.affine.integration.external-mcp.field.ticket"](): string;
    /**
      * `Server`
      */
    ["com.affine.integration.external-mcp.meta.server"](): string;
    /**
      * `Session fingerprint`
      */
    ["com.affine.integration.external-mcp.meta.session"](): string;
    /**
      * `Last checked`
      */
    ["com.affine.integration.external-mcp.meta.last-checked"](): string;
    /**
      * `Connected`
      */
    ["com.affine.integration.external-mcp.status.active"](): string;
    /**
      * `Connecting`
      */
    ["com.affine.integration.external-mcp.status.connecting"](): string;
    /**
      * `Degraded`
      */
    ["com.affine.integration.external-mcp.status.degraded"](): string;
    /**
      * `Reauthentication required`
      */
    ["com.affine.integration.external-mcp.status.reauth-required"](): string;
    /**
      * `Disabled`
      */
    ["com.affine.integration.external-mcp.status.disabled"](): string;
    /**
      * `SparkClaw MCP connected`
      */
    ["com.affine.integration.external-mcp.connected"](): string;
    /**
      * `Connect and test`
      */
    ["com.affine.integration.external-mcp.action.connect"](): string;
    /**
      * `Use new ticket`
      */
    ["com.affine.integration.external-mcp.action.reauthenticate"](): string;
    /**
      * `Disable`
      */
    ["com.affine.integration.external-mcp.action.disable"](): string;
    /**
      * `Refresh tools`
      */
    ["com.affine.integration.external-mcp.action.refresh"](): string;
    /**
      * `Run test`
      */
    ["com.affine.integration.external-mcp.action.test"](): string;
    /**
      * `Tools`
      */
    ["com.affine.integration.external-mcp.tools.title"](): string;
    /**
      * `Enabled tools are available in LocalMind AI Chat and delegated tasks. Write access still requires a direct user request.`
      */
    ["com.affine.integration.external-mcp.tools.description"](): string;
    /**
      * `No tools are available from this server.`
      */
    ["com.affine.integration.external-mcp.tools.empty"](): string;
    /**
      * `Available to AI`
      */
    ["com.affine.integration.external-mcp.tool.enabled"](): string;
    /**
      * `Read`
      */
    ["com.affine.integration.external-mcp.tool.risk.read"](): string;
    /**
      * `Write`
      */
    ["com.affine.integration.external-mcp.tool.risk.write"](): string;
    /**
      * `High risk`
      */
    ["com.affine.integration.external-mcp.tool.risk.high"](): string;
    /**
      * `Explicit user request required`
      */
    ["com.affine.integration.external-mcp.tool.explicit-request"](): string;
    /**
      * `Enable “{{name}}” for LocalMind AI?`
      */
    ["com.affine.integration.external-mcp.tool.enable-risk.title"](options: {
        readonly name: string;
    }): string;
    /**
      * `This is a {{risk}} SparkClaw capability. LocalMind will require a direct user request before execution and will record an auditable, idempotent result.`
      */
    ["com.affine.integration.external-mcp.tool.enable-risk.description"](options: {
        readonly risk: string;
    }): string;
    /**
      * `Conversation test`
      */
    ["com.affine.integration.external-mcp.test.title"](): string;
    /**
      * `Query`
      */
    ["com.affine.integration.external-mcp.test.query"](): string;
    /**
      * `Remove the SparkClaw MCP connection?`
      */
    ["com.affine.integration.external-mcp.delete.title"](): string;
    /**
      * `LocalMind will erase the encrypted session. A new SparkClaw ticket will be required to connect again.`
      */
    ["com.affine.integration.external-mcp.delete.description"](): string;
    /**
      * `Notes`
      */
    ["com.affine.audio.notes"](): string;
    /**
      * `Transcribing`
      */
    ["com.affine.audio.transcribing"](): string;
    /**
      * `Unable to retrieve AI results for others`
      */
    ["com.affine.audio.transcribe.non-owner.confirm.title"](): string;
    /**
      * `Audio activity`
      */
    ["com.affine.recording.new"](): string;
    /**
      * `Importing...`
      */
    ["com.affine.recording.importing.prompt"](): string;
    /**
      * `Finished`
      */
    ["com.affine.recording.success.prompt"](): string;
    /**
      * `Open app`
      */
    ["com.affine.recording.success.button"](): string;
    /**
      * `Failed to save`
      */
    ["com.affine.recording.failed.prompt"](): string;
    /**
      * `Open file`
      */
    ["com.affine.recording.failed.button"](): string;
    /**
      * `{{appName}}'s audio`
      */
    ["com.affine.recording.recording"](options: {
        readonly appName: string;
    }): string;
    /**
      * `Audio recording`
      */
    ["com.affine.recording.recording.unnamed"](): string;
    /**
      * `Start`
      */
    ["com.affine.recording.start"](): string;
    /**
      * `Dismiss`
      */
    ["com.affine.recording.dismiss"](): string;
    /**
      * `Stop`
      */
    ["com.affine.recording.stop"](): string;
    /**
      * `Migrate Data to Enhance User Experience`
      */
    ["com.affine.migration-all-docs-notification.header"](): string;
    /**
      * `We are updating the local data to facilitate the recording and filtering of created by and Last edited by information. Please click the “Migrate Data” button and ensure a stable network connection during the process.`
      */
    ["com.affine.migration-all-docs-notification.desc"](): string;
    /**
      * `Migration failed: {{errorMessage}}`
      */
    ["com.affine.migration-all-docs-notification.error"](options: {
        readonly errorMessage: string;
    }): string;
    /**
      * `Migrate data`
      */
    ["com.affine.migration-all-docs-notification.button"](): string;
    /**
      * `Comments`
      */
    ["com.affine.comment.comments"](): string;
    /**
      * `No comments yet, select content to add comment to`
      */
    ["com.affine.comment.no-comments"](): string;
    /**
      * `Delete the thread?`
      */
    ["com.affine.comment.delete.confirm.title"](): string;
    /**
      * `All comments will also be deleted, and this action cannot be undone.`
      */
    ["com.affine.comment.delete.confirm.description"](): string;
    /**
      * `Delete this reply?`
      */
    ["com.affine.comment.reply.delete.confirm.title"](): string;
    /**
      * `Delete this reply? This action cannot be undone.`
      */
    ["com.affine.comment.reply.delete.confirm.description"](): string;
    /**
      * `Show {{count}} more replies`
      */
    ["com.affine.comment.reply.show-more"](options: {
        readonly count: string;
    }): string;
    /**
      * `Show resolved comments`
      */
    ["com.affine.comment.filter.show-resolved"](): string;
    /**
      * `Only my replies and mentions`
      */
    ["com.affine.comment.filter.only-my-replies"](): string;
    /**
      * `Only current mode`
      */
    ["com.affine.comment.filter.only-current-mode"](): string;
    /**
      * `Unlock more features`
      */
    ["com.affine.payment.subscription.title"](): string;
    /**
      * `The universal editor that lets you work, play, present or create just about anything.`
      */
    ["com.affine.payment.subscription.description"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.payment.subscription.button"](): string;
    /**
      * `Reply`
      */
    ["com.affine.comment.reply"](): string;
    /**
      * `Copy link`
      */
    ["com.affine.comment.copy-link"](): string;
    /**
      * `Copy`
      */
    ["com.affine.context-menu.copy"](): string;
    /**
      * `Paste`
      */
    ["com.affine.context-menu.paste"](): string;
    /**
      * `Cut`
      */
    ["com.affine.context-menu.cut"](): string;
    /**
      * `Add icon`
      */
    ["com.affine.docIconPicker.placeholder"](): string;
    /**
      * `Devices`
      */
    ["com.affine.settings.devices.title"](): string;
    /**
      * `Devices with an active sign-in session`
      */
    ["com.affine.settings.devices.description"](): string;
    /**
      * `current`
      */
    ["com.affine.settings.devices.current"](): string;
    /**
      * `Last used {{time}}`
      */
    ["com.affine.settings.devices.last-used"](options: {
        readonly time: string;
    }): string;
    /**
      * `Loading…`
      */
    ["com.affine.settings.devices.loading"](): string;
    /**
      * `Sign out`
      */
    ["com.affine.settings.devices.sign-out"](): string;
    /**
      * `Sign out all devices`
      */
    ["com.affine.settings.devices.sign-out-all"](): string;
    /**
      * `Sign out {{device}}?`
      */
    ["com.affine.settings.devices.confirm"](options: {
        readonly device: string;
    }): string;
    /**
      * `Sign out every device?`
      */
    ["com.affine.settings.devices.confirm-all"](): string;
    /**
      * `Failed to load devices`
      */
    ["com.affine.settings.devices.load-failed"](): string;
    /**
      * `Failed to sign out device`
      */
    ["com.affine.settings.devices.sign-out-failed"](): string;
    /**
      * `Failed to sign out devices`
      */
    ["com.affine.settings.devices.sign-out-all-failed"](): string;
    /**
      * `Real-time connection failed`
      */
    ["com.affine.realtime.connection-error.title"](): string;
    /**
      * `Check that your server proxy forwards /socket.io over WebSocket or HTTP polling.`
      */
    ["com.affine.realtime.connection-error.message"](): string;
    /**
      * `Help & guide`
      */
    ["com.affine.localmind.help.title"](): string;
    /**
      * `LOCALMIND HELP CENTER`
      */
    ["com.affine.localmind.help.eyebrow"](): string;
    /**
      * `AI context`
      */
    ["com.affine.localmind.aiContext.title"](): string;
    /**
      * `Document updated`
      */
    ["com.affine.localmind.documentUpdate.title"](): string;
    /**
      * `Untitled document`
      */
    ["com.affine.localmind.documentUpdate.untitled"](): string;
    /**
      * `{{first}} and {{second}}`
      */
    ["com.affine.localmind.documentUpdate.list.two"](options: Readonly<{
        first: string;
        second: string;
    }>): string;
    /**
      * `{{documents}} and {{remaining}} more`
      */
    ["com.affine.localmind.documentUpdate.list.more"](options: Readonly<{
        documents: string;
        remaining: string;
    }>): string;
    /**
      * `{{documents}} has changed since it was added. This chat still uses the earlier version.`
      */
    ["com.affine.localmind.documentUpdate.description.one"](options: {
        readonly documents: string;
    }): string;
    /**
      * `{{documents}} have changed since they were added. This chat still uses the earlier version.`
      */
    ["com.affine.localmind.documentUpdate.description.many"](options: {
        readonly documents: string;
    }): string;
    /**
      * `New chat`
      */
    ["com.affine.localmind.documentUpdate.newChat"](): string;
    /**
      * `Dismiss document update warning`
      */
    ["com.affine.localmind.documentUpdate.dismiss"](): string;
    /**
      * `Dismiss`
      */
    ["com.affine.localmind.documentUpdate.dismissShort"](): string;
    /**
      * `Manage your private AI memory and where it can be used.`
      */
    ["com.affine.localmind.aiContext.subtitle"](): string;
    /**
      * `Untitled`
      */
    ["com.affine.localmind.aiContext.untitled"](): string;
    /**
      * `Description`
      */
    ["com.affine.localmind.aiContext.description"](): string;
    /**
      * `Keywords, comma separated`
      */
    ["com.affine.localmind.aiContext.keywordsPlaceholder"](): string;
    /**
      * `Match all groups`
      */
    ["com.affine.localmind.aiContext.matchAll"](): string;
    /**
      * `Match any group`
      */
    ["com.affine.localmind.aiContext.matchAny"](): string;
    /**
      * `Documents`
      */
    ["com.affine.localmind.aiContext.documents"](): string;
    /**
      * `{{count}} documents`
      */
    ["com.affine.localmind.aiContext.documentsCount"](options: {
        readonly count: string;
    }): string;
    /**
      * `{{count}} projects`
      */
    ["com.affine.localmind.aiContext.projectsCount"](options: {
        readonly count: string;
    }): string;
    /**
      * `Clear projects`
      */
    ["com.affine.localmind.aiContext.clearProjects"](): string;
    /**
      * `Rule`
      */
    ["com.affine.localmind.aiContext.kind.rule"](): string;
    /**
      * `Automatic memory`
      */
    ["com.affine.localmind.aiContext.kind.autoMemory"](): string;
    /**
      * `Project summary`
      */
    ["com.affine.localmind.aiContext.kind.projectSummary"](): string;
    /**
      * `Every workspace`
      */
    ["com.affine.localmind.aiContext.scope.everyWorkspace"](): string;
    /**
      * `This team`
      */
    ["com.affine.localmind.aiContext.scope.thisTeam"](): string;
    /**
      * `Document`
      */
    ["com.affine.localmind.aiContext.scope.document"](): string;
    /**
      * `Project`
      */
    ["com.affine.localmind.aiContext.scope.project"](): string;
    /**
      * `All`
      */
    ["com.affine.localmind.aiContext.filter.all"](): string;
    /**
      * `Automatic`
      */
    ["com.affine.localmind.aiContext.filter.automatic"](): string;
    /**
      * `Summaries`
      */
    ["com.affine.localmind.aiContext.filter.summaries"](): string;
    /**
      * `Always`
      */
    ["com.affine.localmind.aiContext.mode.always"](): string;
    /**
      * `When relevant`
      */
    ["com.affine.localmind.aiContext.mode.relevant"](): string;
    /**
      * `Manual`
      */
    ["com.affine.localmind.aiContext.mode.manual"](): string;
    /**
      * `Manual`
      */
    ["com.affine.localmind.aiContext.capture.manual"](): string;
    /**
      * `Explicit`
      */
    ["com.affine.localmind.aiContext.capture.explicit"](): string;
    /**
      * `Automatic`
      */
    ["com.affine.localmind.aiContext.capture.implicit"](): string;
    /**
      * `Legacy`
      */
    ["com.affine.localmind.aiContext.capture.legacy"](): string;
    /**
      * `Added`
      */
    ["com.affine.localmind.aiContext.operation.add"](): string;
    /**
      * `Updated`
      */
    ["com.affine.localmind.aiContext.operation.update"](): string;
    /**
      * `Deleted`
      */
    ["com.affine.localmind.aiContext.operation.delete"](): string;
    /**
      * `Undone`
      */
    ["com.affine.localmind.aiContext.operation.undo"](): string;
    /**
      * `AI context update failed`
      */
    ["com.affine.localmind.aiContext.updateFailed"](): string;
    /**
      * `Select up to {{count}} documents`
      */
    ["com.affine.localmind.aiContext.selectUpToDocuments"](options: {
        readonly count: string;
    }): string;
    /**
      * `Select between {{min}} and {{max}} documents`
      */
    ["com.affine.localmind.aiContext.selectDocumentRange"](options: Readonly<{
        min: string;
        max: string;
    }>): string;
    /**
      * `Delete`
      */
    ["com.affine.localmind.aiContext.delete"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.localmind.aiContext.cancel"](): string;
    /**
      * `Delete context project?`
      */
    ["com.affine.localmind.aiContext.deleteProject.title"](): string;
    /**
      * `The project must be empty of personal memories. This cannot be undone.`
      */
    ["com.affine.localmind.aiContext.deleteProject.description"](): string;
    /**
      * `Delete project`
      */
    ["com.affine.localmind.aiContext.deleteProject.action"](): string;
    /**
      * `Delete rule?`
      */
    ["com.affine.localmind.aiContext.deleteRule.title"](): string;
    /**
      * `Delete rule`
      */
    ["com.affine.localmind.aiContext.deleteRule.action"](): string;
    /**
      * `Delete workspace policy?`
      */
    ["com.affine.localmind.aiContext.deletePolicy.title"](): string;
    /**
      * `Delete policy`
      */
    ["com.affine.localmind.aiContext.deletePolicy.action"](): string;
    /**
      * `Delete AI memory?`
      */
    ["com.affine.localmind.aiContext.deleteMemory.title"](): string;
    /**
      * `AI context did not load`
      */
    ["com.affine.localmind.aiContext.loadFailed.title"](): string;
    /**
      * `Check the server connection and your workspace permission.`
      */
    ["com.affine.localmind.aiContext.loadFailed.description"](): string;
    /**
      * `Retry`
      */
    ["com.affine.localmind.aiContext.retry"](): string;
    /**
      * `Ownership and scope`
      */
    ["com.affine.localmind.aiContext.ownership.title"](): string;
    /**
      * `Memory ownership`
      */
    ["com.affine.localmind.aiContext.ownership.memory.name"](): string;
    /**
      * `Rules, summaries, and automatic memories belong only to your account.`
      */
    ["com.affine.localmind.aiContext.ownership.memory.description"](): string;
    /**
      * `Team boundary`
      */
    ["com.affine.localmind.aiContext.ownership.team.name"](): string;
    /**
      * `Team-scoped memories are used only inside this workspace.`
      */
    ["com.affine.localmind.aiContext.ownership.team.description"](): string;
    /**
      * `Only you`
      */
    ["com.affine.localmind.aiContext.onlyYou"](): string;
    /**
      * `Manage members`
      */
    ["com.affine.localmind.aiContext.manageMembers"](): string;
    /**
      * `Automatic memory`
      */
    ["com.affine.localmind.aiContext.automaticMemory"](): string;
    /**
      * `Sync this workspace before using automatic memory.`
      */
    ["com.affine.localmind.aiContext.autoMemory.syncRequired"](): string;
    /**
      * `Save durable preferences and decisions from AI conversations.`
      */
    ["com.affine.localmind.aiContext.autoMemory.description"](): string;
    /**
      * `Automatic memory enabled`
      */
    ["com.affine.localmind.aiContext.autoMemory.enabled"](): string;
    /**
      * `Context engine`
      */
    ["com.affine.localmind.aiContext.engine.name"](): string;
    /**
      * `Rolling summaries and scoped memory selection`
      */
    ["com.affine.localmind.aiContext.engine.description"](): string;
    /**
      * `Unavailable`
      */
    ["com.affine.localmind.aiContext.unavailable"](): string;
    /**
      * `Active`
      */
    ["com.affine.localmind.aiContext.active"](): string;
    /**
      * `Archived`
      */
    ["com.affine.localmind.aiContext.archived"](): string;
    /**
      * `{{count}} plans traced`
      */
    ["com.affine.localmind.aiContext.plansTraced"](options: {
        readonly count: string;
    }): string;
    /**
      * `{{count}} previous retained`
      */
    ["com.affine.localmind.aiContext.previousStrategies"](options: {
        readonly count: string;
    }): string;
    /**
      * `Context projects`
      */
    ["com.affine.localmind.aiContext.projects.title"](): string;
    /**
      * `Project name`
      */
    ["com.affine.localmind.aiContext.projectName"](): string;
    /**
      * `Select documents`
      */
    ["com.affine.localmind.aiContext.selectDocuments"](): string;
    /**
      * `Create project`
      */
    ["com.affine.localmind.aiContext.createProject"](): string;
    /**
      * `{{name}} active`
      */
    ["com.affine.localmind.aiContext.projectEnabled"](options: {
        readonly name: string;
    }): string;
    /**
      * `Save project`
      */
    ["com.affine.localmind.aiContext.saveProject"](): string;
    /**
      * `Sync this workspace to create context projects`
      */
    ["com.affine.localmind.aiContext.projects.syncRequired"](): string;
    /**
      * `No context projects`
      */
    ["com.affine.localmind.aiContext.projects.empty"](): string;
    /**
      * `No accessible context projects`
      */
    ["com.affine.localmind.aiContext.projects.emptyAccessible"](): string;
    /**
      * `Your rules`
      */
    ["com.affine.localmind.aiContext.rules.title"](): string;
    /**
      * `Rule name`
      */
    ["com.affine.localmind.aiContext.ruleName"](): string;
    /**
      * `Rule priority`
      */
    ["com.affine.localmind.aiContext.rulePriority"](): string;
    /**
      * `Select project`
      */
    ["com.affine.localmind.aiContext.selectProject"](): string;
    /**
      * `Current project`
      */
    ["com.affine.localmind.aiContext.currentProject"](): string;
    /**
      * `Approve access`
      */
    ["com.affine.localmind.accessNotification.approve"](): string;
    /**
      * `Reject request`
      */
    ["com.affine.localmind.accessNotification.reject"](): string;
    /**
      * `Read`
      */
    ["com.affine.localmind.accessNotification.read"](): string;
    /**
      * `Read and write`
      */
    ["com.affine.localmind.accessNotification.write"](): string;
    /**
      * `Awaiting decision`
      */
    ["com.affine.localmind.accessNotification.pending"](): string;
    /**
      * `Approved`
      */
    ["com.affine.localmind.accessNotification.approved"](): string;
    /**
      * `Rejected`
      */
    ["com.affine.localmind.accessNotification.rejected"](): string;
    /**
      * `Withdrawn`
      */
    ["com.affine.localmind.accessNotification.withdrawn"](): string;
    /**
      * `Expired`
      */
    ["com.affine.localmind.accessNotification.expired"](): string;
    /**
      * `No longer accessible`
      */
    ["com.affine.localmind.accessNotification.unavailable"](): string;
    /**
      * `Personal access request`
      */
    ["com.affine.localmind.accessNotification.personal"](): string;
    /**
      * `Requested permission: {{level}}. Approving allows a copy in Project {{project}} that all its members can access. Approval cannot be withdrawn; the Project manages the independent copy.`
      */
    ["com.affine.localmind.accessNotification.projectConfirmation"](options: Readonly<{
        level: string;
        project: string;
    }>): string;
    /**
      * `Requested personal permission: {{level}}. Confirm your decision for this applicant.`
      */
    ["com.affine.localmind.accessNotification.personalConfirmation"](options: {
        readonly level: string;
    }): string;
    /**
      * `Reason for rejection (optional)`
      */
    ["com.affine.localmind.accessNotification.reason"](): string;
    /**
      * `Rule instruction`
      */
    ["com.affine.localmind.aiContext.ruleInstruction"](): string;
    /**
      * `Create rule`
      */
    ["com.affine.localmind.aiContext.createRule"](): string;
    /**
      * `{{name}} priority`
      */
    ["com.affine.localmind.aiContext.namedPriority"](options: {
        readonly name: string;
    }): string;
    /**
      * `{{name}} content`
      */
    ["com.affine.localmind.aiContext.namedContent"](options: {
        readonly name: string;
    }): string;
    /**
      * `{{name}} enabled`
      */
    ["com.affine.localmind.aiContext.namedEnabled"](options: {
        readonly name: string;
    }): string;
    /**
      * `{{count}} recent hits`
      */
    ["com.affine.localmind.aiContext.recentHits"](options: {
        readonly count: string;
    }): string;
    /**
      * `Revision {{revision}}`
      */
    ["com.affine.localmind.aiContext.revision"](options: {
        readonly revision: string;
    }): string;
    /**
      * `Save rule`
      */
    ["com.affine.localmind.aiContext.saveRule"](): string;
    /**
      * `No rules`
      */
    ["com.affine.localmind.aiContext.rules.empty"](): string;
    /**
      * `Workspace policies`
      */
    ["com.affine.localmind.aiContext.policies.title"](): string;
    /**
      * `Policy name`
      */
    ["com.affine.localmind.aiContext.policyName"](): string;
    /**
      * `Policy priority`
      */
    ["com.affine.localmind.aiContext.policyPriority"](): string;
    /**
      * `Enforced policy instruction`
      */
    ["com.affine.localmind.aiContext.policyInstruction"](): string;
    /**
      * `Create policy`
      */
    ["com.affine.localmind.aiContext.createPolicy"](): string;
    /**
      * `Workspace policy`
      */
    ["com.affine.localmind.aiContext.workspacePolicy"](): string;
    /**
      * `Save policy`
      */
    ["com.affine.localmind.aiContext.savePolicy"](): string;
    /**
      * `No workspace policies`
      */
    ["com.affine.localmind.aiContext.policies.empty"](): string;
    /**
      * `Memories and project summaries`
      */
    ["com.affine.localmind.aiContext.memories.title"](): string;
    /**
      * `Project summary`
      */
    ["com.affine.localmind.aiContext.projectSummary"](): string;
    /**
      * `Add project summary`
      */
    ["com.affine.localmind.aiContext.addProjectSummary"](): string;
    /**
      * `Search`
      */
    ["com.affine.localmind.aiContext.search"](): string;
    /**
      * `Confidence {{percent}}%`
      */
    ["com.affine.localmind.aiContext.confidence"](options: {
        readonly percent: string;
    }): string;
    /**
      * `Expires {{date}}`
      */
    ["com.affine.localmind.aiContext.expires"](options: {
        readonly date: string;
    }): string;
    /**
      * `Used {{count}} times`
      */
    ["com.affine.localmind.aiContext.usedTimes"](options: {
        readonly count: string;
    }): string;
    /**
      * `Archived project`
      */
    ["com.affine.localmind.aiContext.archivedProject"](): string;
    /**
      * `Updated {{date}}`
      */
    ["com.affine.localmind.aiContext.updated"](options: {
        readonly date: string;
    }): string;
    /**
      * `{{kind}} enabled: {{content}}`
      */
    ["com.affine.localmind.aiContext.memoryEnabled"](options: Readonly<{
        kind: string;
        content: string;
    }>): string;
    /**
      * `Save`
      */
    ["com.affine.localmind.aiContext.save"](): string;
    /**
      * `No matching memories`
      */
    ["com.affine.localmind.aiContext.memories.emptySearch"](): string;
    /**
      * `No saved memories`
      */
    ["com.affine.localmind.aiContext.memories.empty"](): string;
    /**
      * `Automatic memory history`
      */
    ["com.affine.localmind.aiContext.history.title"](): string;
    /**
      * `Undo`
      */
    ["com.affine.localmind.aiContext.undo"](): string;
    /**
      * `No automatic memory changes`
      */
    ["com.affine.localmind.aiContext.history.empty"](): string;
    /**
      * `Sign in to manage AI context`
      */
    ["com.affine.localmind.aiContext.signIn.title"](): string;
    /**
      * `Memory controls are tied to your account and workspace permissions.`
      */
    ["com.affine.localmind.aiContext.signIn.description"](): string;
    /**
      * `Sign in`
      */
    ["com.affine.localmind.aiContext.signIn.action"](): string;
    /**
      * `LocalMind guide`
      */
    ["com.affine.localmind.help.pageTitle"](): string;
    /**
      * `Learn how to organize workspace sources, AI Chat, personal memory, and project context into a reliable, reviewable workflow.`
      */
    ["com.affine.localmind.help.intro"](): string;
    /**
      * `Open AI Chat`
      */
    ["com.affine.localmind.help.openChat"](): string;
    /**
      * `Manage AI context`
      */
    ["com.affine.localmind.help.manageContext"](): string;
    /**
      * `Open Embedding settings`
      */
    ["com.affine.localmind.help.openEmbedding"](): string;
    /**
      * `Search the guide`
      */
    ["com.affine.localmind.help.search.placeholder"](): string;
    /**
      * `Clear search`
      */
    ["com.affine.localmind.help.search.clear"](): string;
    /**
      * `AI Chat will prompt you to start a new chat after a document changes`
      */
    ["com.affine.localmind.help.alert.title"](): string;
    /**
      * `Existing chats use the document snapshot saved when the source was read and do not pull later edits automatically. After saving the document, a dismissible notice appears above the composer. Choose New Chat, then select or reference the document again. Dismissal applies only to that saved version; a later save shows the notice again.`
      */
    ["com.affine.localmind.help.alert.description"](): string;
    /**
      * `Guide contents`
      */
    ["com.affine.localmind.help.toc.label"](): string;
    /**
      * `Contents`
      */
    ["com.affine.localmind.help.toc.title"](): string;
    /**
      * `No matching content`
      */
    ["com.affine.localmind.help.empty.title"](): string;
    /**
      * `Try searching for document updates, Automatic Memory, or permissions.`
      */
    ["com.affine.localmind.help.empty.description"](): string;
    /**
      * `Quick start`
      */
    ["com.affine.localmind.help.section.start.title"](): string;
    /**
      * `Go from prepared sources to a verifiable answer.`
      */
    ["com.affine.localmind.help.section.start.summary"](): string;
    /**
      * `Document updates and snapshots`
      */
    ["com.affine.localmind.help.section.snapshots.title"](): string;
    /**
      * `Understand why an existing chat does not automatically read an edited document.`
      */
    ["com.affine.localmind.help.section.snapshots.summary"](): string;
    /**
      * `AI Chat`
      */
    ["com.affine.localmind.help.section.chat.title"](): string;
    /**
      * `Add sources, manage conversations, and ask questions with clear boundaries.`
      */
    ["com.affine.localmind.help.section.chat.summary"](): string;
    /**
      * `Rules and memory`
      */
    ["com.affine.localmind.help.section.memory.title"](): string;
    /**
      * `Manage personal rules, automatic memory, and project summaries.`
      */
    ["com.affine.localmind.help.section.memory.summary"](): string;
    /**
      * `Projects and teams`
      */
    ["com.affine.localmind.help.section.projects.title"](): string;
    /**
      * `Create Context Projects and understand member and project boundaries.`
      */
    ["com.affine.localmind.help.section.projects.summary"](): string;
    /**
      * `Permissions and privacy`
      */
    ["com.affine.localmind.help.section.permissions.title"](): string;
    /**
      * `Understand permission filtering, personal ownership, and team policy boundaries.`
      */
    ["com.affine.localmind.help.section.permissions.summary"](): string;
    /**
      * `Indexing and search`
      */
    ["com.affine.localmind.help.section.search.title"](): string;
    /**
      * `Manage Embedding and diagnose empty search results.`
      */
    ["com.affine.localmind.help.section.search.summary"](): string;
    /**
      * `Troubleshooting`
      */
    ["com.affine.localmind.help.section.troubleshooting.title"](): string;
    /**
      * `Quickly diagnose Automatic Memory, project, and search issues.`
      */
    ["com.affine.localmind.help.section.troubleshooting.summary"](): string;
    /**
      * `Prepare sources`
      */
    ["com.affine.localmind.help.quickStart.prepare.title"](): string;
    /**
      * `Open or create the workspace documents that AI should use.`
      */
    ["com.affine.localmind.help.quickStart.prepare.description"](): string;
    /**
      * `Add context`
      */
    ["com.affine.localmind.help.quickStart.context.title"](): string;
    /**
      * `Open AI Chat and use the + next to the composer to select documents or files.`
      */
    ["com.affine.localmind.help.quickStart.context.description"](): string;
    /**
      * `Define the task`
      */
    ["com.affine.localmind.help.quickStart.task.title"](): string;
    /**
      * `State the source boundary, output format, and what must not be guessed.`
      */
    ["com.affine.localmind.help.quickStart.task.description"](): string;
    /**
      * `Keep durable guidance`
      */
    ["com.affine.localmind.help.quickStart.memory.title"](): string;
    /**
      * `Save stable constraints as Rules and review Automatic Memory regularly.`
      */
    ["com.affine.localmind.help.quickStart.memory.description"](): string;
    /**
      * `Suggested prompt`
      */
    ["com.affine.localmind.help.quickStart.promptLabel"](): string;
    /**
      * `Using only Release plan and Risk list, create next week's checklist grouped by owner. Mark anything the sources do not confirm as Needs confirmation and do not invent missing details.`
      */
    ["com.affine.localmind.help.quickStart.promptExample"](): string;
    /**
      * `Why snapshots are used`
      */
    ["com.affine.localmind.help.snapshots.why.title"](): string;
    /**
      * `A chat preserves the source version it read so prior answers remain reproducible instead of silently changing when the source document is edited.`
      */
    ["com.affine.localmind.help.snapshots.why.description"](): string;
    /**
      * `Read the latest version`
      */
    ["com.affine.localmind.help.snapshots.latest.title"](): string;
    /**
      * `Save the document and wait for sync to finish.`
      */
    ["com.affine.localmind.help.snapshots.latest.step1"](): string;
    /**
      * `Wait for the update notice above the current chat composer.`
      */
    ["com.affine.localmind.help.snapshots.latest.step2"](): string;
    /**
      * `Choose New Chat in the notice.`
      */
    ["com.affine.localmind.help.snapshots.latest.step3"](): string;
    /**
      * `Select or reference the document again in the new chat.`
      */
    ["com.affine.localmind.help.snapshots.latest.step4"](): string;
    /**
      * `Ask AI to answer from the latest version.`
      */
    ["com.affine.localmind.help.snapshots.latest.step5"](): string;
    /**
      * `The notice can be dismissed. It does not repeat for the same saved version and returns after the document is saved again.`
      */
    ["com.affine.localmind.help.snapshots.latest.note"](): string;
    /**
      * `Add sources`
      */
    ["com.affine.localmind.help.chat.add.title"](): string;
    /**
      * `Choose + next to the composer to add workspace documents, tags, collections, PDFs, TXT or CSV files, and images. Prefer a small set of authoritative sources.`
      */
    ["com.affine.localmind.help.chat.add.description"](): string;
    /**
      * `Manage sessions`
      */
    ["com.affine.localmind.help.chat.sessions.title"](): string;
    /**
      * `Use New Chat for a clean session and Chat History to return to earlier sessions. Keep each chat focused on one continuing topic when possible.`
      */
    ["com.affine.localmind.help.chat.sessions.description"](): string;
    /**
      * `Long conversations`
      */
    ["com.affine.localmind.help.chat.long.title"](): string;
    /**
      * `LocalMind keeps recent messages and compresses older content. Start a new chat when the goal, sources, or assumptions change substantially.`
      */
    ["com.affine.localmind.help.chat.long.description"](): string;
    /**
      * `Prompt check:`
      */
    ["com.affine.localmind.help.chat.check.label"](): string;
    /**
      * `task, source boundary, output format, content that must be retained, and content that must not be guessed.`
      */
    ["com.affine.localmind.help.chat.check.description"](): string;
    /**
      * `Type`
      */
    ["com.affine.localmind.help.memory.table.type"](): string;
    /**
      * `Purpose`
      */
    ["com.affine.localmind.help.memory.table.purpose"](): string;
    /**
      * `Management`
      */
    ["com.affine.localmind.help.memory.table.management"](): string;
    /**
      * `Rule`
      */
    ["com.affine.localmind.help.memory.rule.name"](): string;
    /**
      * `Explicitly constrain answer format and working style`
      */
    ["com.affine.localmind.help.memory.rule.purpose"](): string;
    /**
      * `Create, edit, disable, or delete`
      */
    ["com.affine.localmind.help.memory.rule.management"](): string;
    /**
      * `Automatic Memory`
      */
    ["com.affine.localmind.help.memory.automatic.name"](): string;
    /**
      * `Keep the current user's stable preferences and decisions`
      */
    ["com.affine.localmind.help.memory.automatic.purpose"](): string;
    /**
      * `Created automatically and available for review and editing`
      */
    ["com.affine.localmind.help.memory.automatic.management"](): string;
    /**
      * `Project Summary`
      */
    ["com.affine.localmind.help.memory.project.name"](): string;
    /**
      * `Keep the current user's stable project background`
      */
    ["com.affine.localmind.help.memory.project.purpose"](): string;
    /**
      * `Managed by Context Project`
      */
    ["com.affine.localmind.help.memory.project.management"](): string;
    /**
      * `Rolling Summary`
      */
    ["com.affine.localmind.help.memory.rolling.name"](): string;
    /**
      * `Compress older content in the current long conversation`
      */
    ["com.affine.localmind.help.memory.rolling.purpose"](): string;
    /**
      * `Belongs only to the current chat`
      */
    ["com.affine.localmind.help.memory.rolling.management"](): string;
    /**
      * `Good to save`
      */
    ["com.affine.localmind.help.memory.save.label"](): string;
    /**
      * `Remember: show me the conclusion before the detailed evidence.`
      */
    ["com.affine.localmind.help.memory.save.example1"](): string;
    /**
      * `Use YYYY-MM-DD for every date.`
      */
    ["com.affine.localmind.help.memory.save.example2"](): string;
    /**
      * `Do not save`
      */
    ["com.affine.localmind.help.memory.skip.label"](): string;
    /**
      * `One-time tasks, ordinary questions, passwords, tokens, API keys, or private keys.`
      */
    ["com.affine.localmind.help.memory.skip.description"](): string;
    /**
      * `Create a project`
      */
    ["com.affine.localmind.help.projects.create.title"](): string;
    /**
      * `Owners and admins can create a Context Project in AI context and select between 1 and 100 workspace documents.`
      */
    ["com.affine.localmind.help.projects.create.description"](): string;
    /**
      * `Project memory`
      */
    ["com.affine.localmind.help.projects.memory.title"](): string;
    /**
      * `Each user can save their own Project Summary or project Rule. The scope is the project, but ownership remains with the person who created it.`
      */
    ["com.affine.localmind.help.projects.memory.description"](): string;
    /**
      * `Archive and delete`
      */
    ["com.affine.localmind.help.projects.archive.title"](): string;
    /**
      * `Archive a project when work ends. It can be deleted only after it is archived and no personal project memory refers to it.`
      */
    ["com.affine.localmind.help.projects.archive.description"](): string;
    /**
      * `Check permissions before relevance ranking`
      */
    ["com.affine.localmind.help.permissions.lead"](): string;
    /**
      * `Users can search and use only documents they can read. A Context Project never bypasses existing document permissions.`
      */
    ["com.affine.localmind.help.permissions.description"](): string;
    /**
      * `Rules, Automatic Memory, and Project Summaries belong only to the current user.`
      */
    ["com.affine.localmind.help.permissions.item1"](): string;
    /**
      * `Team or project scope controls where private memory is used; it does not make that memory shared.`
      */
    ["com.affine.localmind.help.permissions.item2"](): string;
    /**
      * `Disabling memory does not delete it, and turning off Automatic Memory does not remove existing records.`
      */
    ["com.affine.localmind.help.permissions.item3"](): string;
    /**
      * `Put shared team requirements in an authoritative permission-controlled document instead of personal memory.`
      */
    ["com.affine.localmind.help.permissions.item4"](): string;
    /**
      * `Build the index`
      */
    ["com.affine.localmind.help.search.index.title"](): string;
    /**
      * `Open Workspace settings > Embedding to enable semantic indexing, inspect progress, upload supporting files, or ignore documents.`
      */
    ["com.affine.localmind.help.search.index.description"](): string;
    /**
      * `When results are empty`
      */
    ["com.affine.localmind.help.search.empty.title"](): string;
    /**
      * `Check document read permission, the Embedding switch, indexing progress, the ignore list, and whether the current chat selected the right sources.`
      */
    ["com.affine.localmind.help.search.empty.description"](): string;
    /**
      * `Why can't I enable Automatic Memory?`
      */
    ["com.affine.localmind.help.faq.autoMemory.question"](): string;
    /**
      * `Sign in and sync the current workspace, then confirm the server has Copilot enabled. Automatic Memory is disabled for unsynced local workspaces.`
      */
    ["com.affine.localmind.help.faq.autoMemory.answer"](): string;
    /**
      * `Why does AI still reference old document content?`
      */
    ["com.affine.localmind.help.faq.snapshot.question"](): string;
    /**
      * `This is expected snapshot behavior. Choose New Chat and select the updated document again. Switching to another old chat does not refresh an old snapshot.`
      */
    ["com.affine.localmind.help.faq.snapshot.answer"](): string;
    /**
      * `Why is old memory still present after I turn off Automatic Memory?`
      */
    ["com.affine.localmind.help.faq.oldMemory.question"](): string;
    /**
      * `The switch only stops creating new memory. Disable or delete existing records individually from the Automatic list.`
      */
    ["com.affine.localmind.help.faq.oldMemory.answer"](): string;
    /**
      * `Why can't a regular member create a Context Project?`
      */
    ["com.affine.localmind.help.faq.projectAccess.question"](): string;
    /**
      * `A Context Project changes workspace-level document grouping, so only owners and admins can manage it. Regular members can still use projects they can access.`
      */
    ["com.affine.localmind.help.faq.projectAccess.answer"](): string;
    /**
      * `Why can't I delete a project?`
      */
    ["com.affine.localmind.help.faq.projectDelete.question"](): string;
    /**
      * `The project must be archived and no user's private project memory may still refer to it.`
      */
    ["com.affine.localmind.help.faq.projectDelete.answer"](): string;
    /**
      * `Why can't search find an existing document?`
      */
    ["com.affine.localmind.help.faq.search.question"](): string;
    /**
      * `Check permission, the Embedding switch, indexing progress, the ignore list, and the current query scope.`
      */
    ["com.affine.localmind.help.faq.search.answer"](): string;
    /**
      * `Directory permissions`
      */
    ["com.affine.localmind.directoryPermissions.title"](): string;
    /**
      * `Control who may read, write, organize, or create folders at each workspace location.`
      */
    ["com.affine.localmind.directoryPermissions.subtitle"](): string;
    /**
      * `Permission override`
      */
    ["com.affine.localmind.directoryPermissions.overrideTitle"](): string;
    /**
      * `Directory`
      */
    ["com.affine.localmind.directoryPermissions.directory"](): string;
    /**
      * `Applies to`
      */
    ["com.affine.localmind.directoryPermissions.principal"](): string;
    /**
      * `Workspace root`
      */
    ["com.affine.localmind.directoryPermissions.root"](): string;
    /**
      * `All workspace members`
      */
    ["com.affine.localmind.directoryPermissions.allMembers"](): string;
    /**
      * `Read`
      */
    ["com.affine.localmind.directoryPermissions.read"](): string;
    /**
      * `Write`
      */
    ["com.affine.localmind.directoryPermissions.write"](): string;
    /**
      * `Organize`
      */
    ["com.affine.localmind.directoryPermissions.organize"](): string;
    /**
      * `Create folders`
      */
    ["com.affine.localmind.directoryPermissions.createFolder"](): string;
    /**
      * `This explicit override is evaluated with its ancestor policies. A member-specific override takes precedence over the all-members override at the same directory.`
      */
    ["com.affine.localmind.directoryPermissions.overrideHint"](): string;
    /**
      * `No explicit override exists for this selection. Saving creates one; until then, ancestor and all-members policies apply.`
      */
    ["com.affine.localmind.directoryPermissions.inheritedHint"](): string;
    /**
      * `Save override`
      */
    ["com.affine.localmind.directoryPermissions.save"](): string;
    /**
      * `Clear override`
      */
    ["com.affine.localmind.directoryPermissions.clear"](): string;
    /**
      * `Directory permission saved`
      */
    ["com.affine.localmind.directoryPermissions.saved"](): string;
    /**
      * `Directory permission cleared`
      */
    ["com.affine.localmind.directoryPermissions.cleared"](): string;
    /**
      * `Directory permission was not changed`
      */
    ["com.affine.localmind.directoryPermissions.saveFailed"](): string;
    /**
      * `Current overrides`
      */
    ["com.affine.localmind.directoryPermissions.currentTitle"](): string;
    /**
      * `No directory overrides have been configured.`
      */
    ["com.affine.localmind.directoryPermissions.emptyPolicies"](): string;
    /**
      * `No rights`
      */
    ["com.affine.localmind.directoryPermissions.noRights"](): string;
    /**
      * `Audit history`
      */
    ["com.affine.localmind.directoryPermissions.auditTitle"](): string;
    /**
      * `No directory permission changes have been recorded.`
      */
    ["com.affine.localmind.directoryPermissions.emptyAudit"](): string;
    /**
      * `Set override for`
      */
    ["com.affine.localmind.directoryPermissions.auditSet"](): string;
    /**
      * `Cleared override for`
      */
    ["com.affine.localmind.directoryPermissions.auditClear"](): string;
    /**
      * `Load more`
      */
    ["com.affine.localmind.directoryPermissions.loadMore"](): string;
    /**
      * `Loading directory permissions…`
      */
    ["com.affine.localmind.directoryPermissions.loading"](): string;
    /**
      * `Retry`
      */
    ["com.affine.localmind.directoryPermissions.retry"](): string;
    /**
      * `Directory permissions are available to active workspace owners and administrators in synced workspaces.`
      */
    ["com.affine.localmind.directoryPermissions.unavailable"](): string;
    /**
      * `Optional for local endpoints`
      */
    ["com.affine.admin.optional-for-local-endpoints"](): string;
    /**
      * `Office task revision sequence evidence does not match.`
      */
    ["com.affine.office.office-task-revision-sequence-evidence-does-not-match"](): string;
    /**
      * `Prepared route available`
      */
    ["com.affine.ui.prepared-route-available"](): string;
    /**
      * `Create User`
      */
    ["com.affine.admin.create-user"](): string;
    /**
      * `No step behavior flag pairs`
      */
    ["com.affine.admin.no-step-behavior-flag-pairs"](): string;
    /**
      * `Run, workflow, source, failure, lease, or fingerprint`
      */
    ["com.affine.admin.run-workflow-source-failure-lease-or-fingerprint"](): string;
    /**
      * `Provider secrets stay encrypted on the server and are never copied to user records.`
      */
    ["com.affine.admin.provider-secrets-stay-encrypted-on-the-server-and-are-never-copied-to-user-records"](): string;
    /**
      * `Changes to this workspace will not be saved.`
      */
    ["com.affine.admin.changes-to-this-workspace-will-not-be-saved"](): string;
    /**
      * `Registry unavailable`
      */
    ["com.affine.ui.registry-unavailable"](): string;
    /**
      * `Repair execution request error`
      */
    ["com.affine.admin.repair-execution-request-error"](): string;
    /**
      * `Rectangle`
      */
    ["com.affine.office.rectangle"](): string;
    /**
      * `Request`
      */
    ["com.affine.admin.request"](): string;
    /**
      * `Attachment source not supported`
      */
    ["com.affine.ui.attachment-source-not-supported"](): string;
    /**
      * `No step dimension evidence`
      */
    ["com.affine.admin.no-step-dimension-evidence"](): string;
    /**
      * `{{count}} page`
      */
    ["com.affine.office.page-count_one"](options: {
        readonly count: (string | number | bigint) & (string | number | bigint);
    }): string;
    /**
      * `Text {{name}} ({{start}}–{{end}})`
      */
    ["com.affine.office.text-range"](options: Readonly<{
        name: string;
        start: string;
        end: string;
    }>): string;
    /**
      * `Copy as Image`
      */
    ["com.affine.ui.copy-as-image"](): string;
    /**
      * `Could not reload Project BYOK.`
      */
    ["com.affine.admin.could-not-reload-project-byok"](): string;
    /**
      * `A matched candidate did not appear in the prepared route list.`
      */
    ["com.affine.ui.a-matched-candidate-did-not-appear-in-the-prepared-route-list"](): string;
    /**
      * `All runs`
      */
    ["com.affine.admin.all-runs"](): string;
    /**
      * `{{operation}} saved in revision {{version}}`
      */
    ["com.affine.office.operation-saved"](options: Readonly<{
        operation: string;
        version: string;
    }>): string;
    /**
      * `Page width (pt)`
      */
    ["com.affine.office.page-width-pt"](): string;
    /**
      * `Write a blog post about this`
      */
    ["com.affine.ai.action-label.write-a-blog-post-about-this"](): string;
    /**
      * `New shape type`
      */
    ["com.affine.office.new-shape-type"](): string;
    /**
      * `Last used`
      */
    ["com.affine.admin.last-used"](): string;
    /**
      * `Registry selected`
      */
    ["com.affine.ui.registry-selected"](): string;
    /**
      * `No members or invitations.`
      */
    ["com.affine.admin.no-members-or-invitations"](): string;
    /**
      * `AI disabled`
      */
    ["com.affine.admin.ai-disabled"](): string;
    /**
      * `Series`
      */
    ["com.affine.office.series"](): string;
    /**
      * `Agent runtime run status gaps none`
      */
    ["com.affine.admin.agent-runtime-run-status-gaps-none"](): string;
    /**
      * `Choose image`
      */
    ["com.affine.office.choose-image"](): string;
    /**
      * `Select an option`
      */
    ["com.affine.admin.select-an-option"](): string;
    /**
      * `Built-in default`
      */
    ["com.affine.admin.built-in-default"](): string;
    /**
      * `Started`
      */
    ["com.affine.admin.started"](): string;
    /**
      * `Provider credentials`
      */
    ["com.affine.admin.provider-credentials"](): string;
    /**
      * `Go to Workspaces`
      */
    ["com.affine.admin.go-to-workspaces"](): string;
    /**
      * `No`
      */
    ["com.affine.admin.no"](): string;
    /**
      * `Delete shape`
      */
    ["com.affine.office.delete-shape"](): string;
    /**
      * `Keep saved key`
      */
    ["com.affine.admin.keep-saved-key"](): string;
    /**
      * `Network not available`
      */
    ["com.affine.ui.network-not-available"](): string;
    /**
      * `Allowed providers, blocked providers, workspace policy, and feature policy.`
      */
    ["com.affine.ui.allowed-providers-blocked-providers-workspace-policy-and-feature-policy"](): string;
    /**
      * `Default AI Profile`
      */
    ["com.affine.admin.default-ai-profile"](): string;
    /**
      * `Allowed privacy Any`
      */
    ["com.affine.admin.allowed-privacy-any"](): string;
    /**
      * `Prompt`
      */
    ["com.affine.admin.prompt"](): string;
    /**
      * `Coming soon...`
      */
    ["com.affine.ui.coming-soon"](): string;
    /**
      * `Ledger`
      */
    ["com.affine.admin.ledger"](): string;
    /**
      * `Load error`
      */
    ["com.affine.ui.load-error"](): string;
    /**
      * `Profile model matched`
      */
    ["com.affine.ui.profile-model-matched"](): string;
    /**
      * `Immutable Office revisions`
      */
    ["com.affine.office.immutable-office-revisions"](): string;
    /**
      * `Route reasons`
      */
    ["com.affine.admin.route-reasons"](): string;
    /**
      * `Size`
      */
    ["com.affine.office.size"](): string;
    /**
      * `Loading chat history`
      */
    ["com.affine.office.loading-chat-history"](): string;
    /**
      * `Recommendation`
      */
    ["com.affine.admin.recommendation"](): string;
    /**
      * `animated`
      */
    ["com.affine.office.animated"](): string;
    /**
      * `The matched candidate produced a prepared native route.`
      */
    ["com.affine.ui.the-matched-candidate-produced-a-prepared-native-route"](): string;
    /**
      * `Download native Office file`
      */
    ["com.affine.office.download-native-office-file"](): string;
    /**
      * `Column width`
      */
    ["com.affine.office.column-width"](): string;
    /**
      * `Leave blank to keep the current key`
      */
    ["com.affine.admin.leave-blank-to-keep-the-current-key"](): string;
    /**
      * `Select template`
      */
    ["com.affine.ai.action-label.select-template"](): string;
    /**
      * `No Office AI changes yet`
      */
    ["com.affine.office.no-office-ai-changes-yet"](): string;
    /**
      * `Primary`
      */
    ["com.affine.admin.primary"](): string;
    /**
      * `Free text`
      */
    ["com.affine.office.annotation-type.FreeText"](): string;
    /**
      * `Width (pt)`
      */
    ["com.affine.office.width-pt"](): string;
    /**
      * `Global Project BYOK`
      */
    ["com.affine.admin.global-project-byok"](): string;
    /**
      * `Latest control`
      */
    ["com.affine.admin.latest-control"](): string;
    /**
      * `Select a shape on the slide.`
      */
    ["com.affine.office.select-a-shape-on-the-slide"](): string;
    /**
      * `Model registry`
      */
    ["com.affine.ui.model-registry"](): string;
    /**
      * `Action run route trace`
      */
    ["com.affine.admin.action-run-route-trace"](): string;
    /**
      * `Copilot storage`
      */
    ["com.affine.admin.copilot-storage"](): string;
    /**
      * `Provider profiles`
      */
    ["com.affine.ui.provider-profiles"](): string;
    /**
      * `Edited Content`
      */
    ["com.affine.ai.action-label.edited-content"](): string;
    /**
      * `Failed to process file`
      */
    ["com.affine.admin.failed-to-process-file"](): string;
    /**
      * `Import cancelled`
      */
    ["com.affine.ui.import-cancelled"](): string;
    /**
      * `These revisions have the same native semantic state.`
      */
    ["com.affine.office.these-revisions-have-the-same-native-semantic-state"](): string;
    /**
      * `Make it real`
      */
    ["com.affine.ai.action-label.make-it-real"](): string;
    /**
      * `Optional compatible endpoint`
      */
    ["com.affine.admin.optional-compatible-endpoint"](): string;
    /**
      * `Actions`
      */
    ["com.affine.admin.actions"](): string;
    /**
      * `Capability mismatch`
      */
    ["com.affine.ui.capability-mismatch"](): string;
    /**
      * `Selection removed from AI context.`
      */
    ["com.affine.office.selection-removed-from-ai-context"](): string;
    /**
      * `Step`
      */
    ["com.affine.admin.step"](): string;
    /**
      * `Workspace options:`
      */
    ["com.affine.admin.workspace-options"](): string;
    /**
      * `Verify and save`
      */
    ["com.affine.admin.verify-and-save"](): string;
    /**
      * `OpenAI-compatible base URL is required when an API key is set.`
      */
    ["com.affine.admin.openai-compatible-base-url-is-required-when-an-api-key-is-set"](): string;
    /**
      * `Repair execution approval decision error`
      */
    ["com.affine.admin.repair-execution-approval-decision-error"](): string;
    /**
      * `Categories`
      */
    ["com.affine.office.categories"](): string;
    /**
      * `Allowed tool names`
      */
    ["com.affine.admin.allowed-tool-names"](): string;
    /**
      * ` / disabled`
      */
    ["com.affine.admin.disabled"](): string;
    /**
      * `Review`
      */
    ["com.affine.office.review"](): string;
    /**
      * `Changes will not be saved.`
      */
    ["com.affine.admin.changes-will-not-be-saved"](): string;
    /**
      * `OpenAI-compatible`
      */
    ["com.affine.admin.openai-compatible"](): string;
    /**
      * `Signing key deleted`
      */
    ["com.affine.admin.signing-key-deleted"](): string;
    /**
      * `Agent runtime timeline entries none`
      */
    ["com.affine.admin.agent-runtime-timeline-entries-none"](): string;
    /**
      * `Failed to import users`
      */
    ["com.affine.admin.failed-to-import-users"](): string;
    /**
      * `All categories`
      */
    ["com.affine.admin.all-categories"](): string;
    /**
      * `blocking`
      */
    ["com.affine.admin.blocking-2"](): string;
    /**
      * `AI configuration is up to date`
      */
    ["com.affine.admin.ai-configuration-is-up-to-date"](): string;
    /**
      * `Regenerate mind map`
      */
    ["com.affine.ai.action-label.regenerate-mind-map"](): string;
    /**
      * `No request layers`
      */
    ["com.affine.admin.no-request-layers"](): string;
    /**
      * `PDF page {{number}}, {{count}} annotations`
      */
    ["com.affine.office.pdf-page-label_other"](options: Readonly<{
        number: (string & string) & string;
        count: (string | number | bigint) & (string | number | bigint);
    }>): string;
    /**
      * `Reject execution`
      */
    ["com.affine.admin.reject-execution"](): string;
    /**
      * `password strength`
      */
    ["com.affine.ui.password-strength"](): string;
    /**
      * `Copied to clipboard.`
      */
    ["com.affine.ui.copied-to-clipboard-2"](): string;
    /**
      * `Paste an action run id`
      */
    ["com.affine.admin.paste-an-action-run-id"](): string;
    /**
      * `The sanitized prepare error category points to model or alias resolution.`
      */
    ["com.affine.ui.the-sanitized-prepare-error-category-points-to-model-or-alias-resolution"](): string;
    /**
      * `Logged out successfully`
      */
    ["com.affine.admin.logged-out-successfully"](): string;
    /**
      * `From revision`
      */
    ["com.affine.office.from-revision"](): string;
    /**
      * `Upgrade to Pro`
      */
    ["com.affine.ui.upgrade-to-pro"](): string;
    /**
      * `Return to latest Office revision v{{version}}`
      */
    ["com.affine.office.return-latest"](options: {
        readonly version: string;
    }): string;
    /**
      * `Form fields`
      */
    ["com.affine.office.form-fields"](): string;
    /**
      * `Agent runtime target timeline event types none`
      */
    ["com.affine.admin.agent-runtime-target-timeline-event-types-none"](): string;
    /**
      * `PDF pages`
      */
    ["com.affine.office.pdf-pages"](): string;
    /**
      * `Repair execution request`
      */
    ["com.affine.admin.repair-execution-request"](): string;
    /**
      * `Rotate key`
      */
    ["com.affine.admin.rotate-key"](): string;
    /**
      * `Output not supported`
      */
    ["com.affine.ui.output-not-supported"](): string;
    /**
      * `Cannot pin a chat while generating an answer`
      */
    ["com.affine.ui.cannot-pin-a-chat-while-generating-an-answer"](): string;
    /**
      * `Search PDF`
      */
    ["com.affine.office.search-pdf"](): string;
    /**
      * `Enable workspace BYOK`
      */
    ["com.affine.admin.enable-workspace-byok"](): string;
    /**
      * `Heading 2`
      */
    ["com.affine.office.heading-2"](): string;
    /**
      * `Enabled`
      */
    ["com.affine.admin.enabled"](): string;
    /**
      * `Save as block`
      */
    ["com.affine.ui.save-as-block"](): string;
    /**
      * `Test connection`
      */
    ["com.affine.admin.test-connection"](): string;
    /**
      * `Rotate signing key?`
      */
    ["com.affine.admin.rotate-signing-key"](): string;
    /**
      * `Add User`
      */
    ["com.affine.admin.add-user"](): string;
    /**
      * `Repair gate manifest artifact`
      */
    ["com.affine.admin.repair-gate-manifest-artifact"](): string;
    /**
      * `No requested model sources`
      */
    ["com.affine.admin.no-requested-model-sources"](): string;
    /**
      * `Account created successfully`
      */
    ["com.affine.admin.account-created-successfully"](): string;
    /**
      * `Insert rows`
      */
    ["com.affine.office.insert-rows"](): string;
    /**
      * `Failed to create workspace`
      */
    ["com.affine.ui.failed-to-create-workspace"](): string;
    /**
      * `More`
      */
    ["com.affine.admin.more"](): string;
    /**
      * `Agent runtime target schema components none`
      */
    ["com.affine.admin.agent-runtime-target-schema-components-none"](): string;
    /**
      * `Copy manifest metadata`
      */
    ["com.affine.admin.copy-manifest-metadata"](): string;
    /**
      * `Department routing policy or ownership notes`
      */
    ["com.affine.admin.department-routing-policy-or-ownership-notes"](): string;
    /**
      * `AI chat block`
      */
    ["com.affine.ai.action-label.ai-chat-block"](): string;
    /**
      * `Heading 3`
      */
    ["com.affine.office.heading-3"](): string;
    /**
      * `The provider privacy class matches a preferred route policy.`
      */
    ["com.affine.ui.the-provider-privacy-class-matches-a-preferred-route-policy"](): string;
    /**
      * `Paragraph style`
      */
    ["com.affine.office.paragraph-style"](): string;
    /**
      * `copilot.prompts.defaults: text, structured, image, and transcript default model policies.`
      */
    ["com.affine.admin.copilot-prompts-defaults-text-structured-image-and-transcript-default-model-policies"](): string;
    /**
      * `Model ID`
      */
    ["com.affine.admin.model-id"](): string;
    /**
      * `The maximum size per file is 100MB`
      */
    ["com.affine.ui.the-maximum-size-per-file-is-100mb"](): string;
    /**
      * `Reload Project BYOK`
      */
    ["com.affine.admin.reload-project-byok"](): string;
    /**
      * `No Selection`
      */
    ["com.affine.ui.no-selection"](): string;
    /**
      * `Please send this recovery link to the user and instruct them to complete it.`
      */
    ["com.affine.admin.please-send-this-recovery-link-to-the-user-and-instruct-them-to-complete-it"](): string;
    /**
      * `Discard the AI result`
      */
    ["com.affine.ui.discard-the-ai-result"](): string;
    /**
      * `Simplified Chinese`
      */
    ["com.affine.ai.action-label.simplified-chinese"](): string;
    /**
      * `Prompt default unavailable`
      */
    ["com.affine.ui.prompt-default-unavailable"](): string;
    /**
      * `Get Started`
      */
    ["com.affine.ui.get-started"](): string;
    /**
      * `Lets instance administrators assign approved server credentials to department workspaces.`
      */
    ["com.affine.admin.lets-instance-administrators-assign-approved-server-credentials-to-department-workspaces"](): string;
    /**
      * `Requested`
      */
    ["com.affine.admin.requested"](): string;
    /**
      * `selected`
      */
    ["com.affine.ui.selected"](): string;
    /**
      * `Go to first page`
      */
    ["com.affine.admin.go-to-first-page"](): string;
    /**
      * `Successfully imported a native Office document.`
      */
    ["com.affine.ui.successfully-imported-a-native-office-document"](): string;
    /**
      * `Page deletion`
      */
    ["com.affine.office.page-deletion"](): string;
    /**
      * `Refreshing`
      */
    ["com.affine.admin.refreshing"](): string;
    /**
      * `Document pages`
      */
    ["com.affine.office.document-pages"](): string;
    /**
      * `Agent Runtime run status`
      */
    ["com.affine.admin.agent-runtime-run-status"](): string;
    /**
      * `Save cell`
      */
    ["com.affine.office.save-cell"](): string;
    /**
      * `Unsplash key`
      */
    ["com.affine.admin.unsplash-key"](): string;
    /**
      * `Gate remediations`
      */
    ["com.affine.admin.gate-remediations"](): string;
    /**
      * `Issued At`
      */
    ["com.affine.admin.issued-at"](): string;
    /**
      * `AI enabled`
      */
    ["com.affine.admin.ai-enabled"](): string;
    /**
      * `unchanged`
      */
    ["com.affine.office.unchanged"](): string;
    /**
      * `License Ends At`
      */
    ["com.affine.admin.license-ends-at"](): string;
    /**
      * `Prompt default model, default policy, category defaults, overrides, and prompt catalog metadata.`
      */
    ["com.affine.ui.prompt-default-model-default-policy-category-defaults-overrides-and-prompt-catalog-metadata"](): string;
    /**
      * `Input color`
      */
    ["com.affine.ui.input-color"](): string;
    /**
      * `Provider runtime unavailable`
      */
    ["com.affine.ui.provider-runtime-unavailable"](): string;
    /**
      * `step`
      */
    ["com.affine.admin.step-2"](): string;
    /**
      * `Merge`
      */
    ["com.affine.office.merge"](): string;
    /**
      * `Move worksheet right`
      */
    ["com.affine.office.move-worksheet-right"](): string;
    /**
      * `Prompt and task models`
      */
    ["com.affine.admin.prompt-and-task-models"](): string;
    /**
      * `Check code error`
      */
    ["com.affine.ai.action-label.check-code-error"](): string;
    /**
      * `No search matches`
      */
    ["com.affine.office.no-search-matches"](): string;
    /**
      * `No canonical model keys`
      */
    ["com.affine.admin.no-canonical-model-keys"](): string;
    /**
      * `Revision fingerprint`
      */
    ["com.affine.admin.revision-fingerprint"](): string;
    /**
      * `Phase trace`
      */
    ["com.affine.admin.phase-trace"](): string;
    /**
      * `Select a workspace scope before viewing repair executions.`
      */
    ["com.affine.admin.select-a-workspace-scope-before-viewing-repair-executions"](): string;
    /**
      * `Page {{number}} / {{name}}`
      */
    ["com.affine.office.page-annotation"](options: Readonly<{
        number: string;
        name: string;
    }>): string;
    /**
      * `Select a workspace scope before viewing Agent Runtime runs.`
      */
    ["com.affine.admin.select-a-workspace-scope-before-viewing-agent-runtime-runs"](): string;
    /**
      * `Recent changes`
      */
    ["com.affine.admin.recent-changes"](): string;
    /**
      * `Agent runtime timeline gaps none`
      */
    ["com.affine.admin.agent-runtime-timeline-gaps-none"](): string;
    /**
      * `No prepared route trace`
      */
    ["com.affine.admin.no-prepared-route-trace"](): string;
    /**
      * `Capability matched`
      */
    ["com.affine.ui.capability-matched"](): string;
    /**
      * `AI outputs can be misleading or wrong`
      */
    ["com.affine.ai.action-label.ai-outputs-can-be-misleading-or-wrong"](): string;
    /**
      * `Failed to unpin the chat`
      */
    ["com.affine.ui.failed-to-unpin-the-chat"](): string;
    /**
      * `Document not found`
      */
    ["com.affine.office.document-not-found"](): string;
    /**
      * `The provider model does not support the requested input type.`
      */
    ["com.affine.ui.the-provider-model-does-not-support-the-requested-input-type"](): string;
    /**
      * `Copied link to clipboard`
      */
    ["com.affine.ui.copied-link-to-clipboard"](): string;
    /**
      * `Test route`
      */
    ["com.affine.admin.test-route"](): string;
    /**
      * `Download manifest metadata JSON`
      */
    ["com.affine.admin.download-manifest-metadata-json"](): string;
    /**
      * `Page height (pt)`
      */
    ["com.affine.office.page-height-pt"](): string;
    /**
      * `settings`
      */
    ["com.affine.admin.settings"](): string;
    /**
      * `Failed to disable user: `
      */
    ["com.affine.admin.failed-to-disable-user"](): string;
    /**
      * `Enter an action run ID or select a recent run to inspect prepared route diagnostics.`
      */
    ["com.affine.admin.enter-an-action-run-id-or-select-a-recent-run-to-inspect-prepared-route-diagnostics"](): string;
    /**
      * `Prompt registry`
      */
    ["com.affine.ui.prompt-registry"](): string;
    /**
      * `Runtime metadata`
      */
    ["com.affine.admin.runtime-metadata"](): string;
    /**
      * `Worksheet deletion`
      */
    ["com.affine.office.worksheet-deletion"](): string;
    /**
      * `Cost`
      */
    ["com.affine.admin.cost"](): string;
    /**
      * `Update failed. Reload the settings and check the provider connection.`
      */
    ["com.affine.admin.update-failed-reload-the-settings-and-check-the-provider-connection"](): string;
    /**
      * `Office task revision evidence could not be verified.`
      */
    ["com.affine.office.office-task-revision-evidence-could-not-be-verified"](): string;
    /**
      * `go forward`
      */
    ["com.affine.ui.go-forward"](): string;
    /**
      * `Provider, revision, request, profile, or result fingerprint`
      */
    ["com.affine.admin.provider-revision-request-profile-or-result-fingerprint"](): string;
    /**
      * `Legacy platform route disabled`
      */
    ["com.affine.ui.legacy-platform-route-disabled"](): string;
    /**
      * `Delete slide`
      */
    ["com.affine.office.delete-slide"](): string;
    /**
      * `Action route dry-run not checked`
      */
    ["com.affine.admin.action-route-dry-run-not-checked"](): string;
    /**
      * `Copy`
      */
    ["com.affine.ai.action-label.copy"](): string;
    /**
      * `Access token signing keys`
      */
    ["com.affine.admin.access-token-signing-keys"](): string;
    /**
      * `Enter at least one chart category.`
      */
    ["com.affine.office.enter-at-least-one-chart-category"](): string;
    /**
      * `Odd page section`
      */
    ["com.affine.office.odd-page-section"](): string;
    /**
      * `Rotation`
      */
    ["com.affine.office.rotation"](): string;
    /**
      * `Incorrect import format`
      */
    ["com.affine.admin.incorrect-import-format"](): string;
    /**
      * `Persisted repair request state, audit history, and side-effect ledger`
      */
    ["com.affine.admin.persisted-repair-request-state-audit-history-and-side-effect-ledger"](): string;
    /**
      * `Diagnostics text`
      */
    ["com.affine.admin.diagnostics-text"](): string;
    /**
      * `active members`
      */
    ["com.affine.admin.active-members-2"](): string;
    /**
      * `Enable experimental edgeless turbo renderer`
      */
    ["com.affine.ui.enable-experimental-edgeless-turbo-renderer"](): string;
    /**
      * `added`
      */
    ["com.affine.office.added"](): string;
    /**
      * `Heading 1`
      */
    ["com.affine.office.heading-1"](): string;
    /**
      * `Cloud`
      */
    ["com.affine.ui.cloud"](): string;
    /**
      * `Document font`
      */
    ["com.affine.office.document-font"](): string;
    /**
      * `Custom endpoints are disabled`
      */
    ["com.affine.admin.custom-endpoints-are-disabled"](): string;
    /**
      * `No fallback order`
      */
    ["com.affine.admin.no-fallback-order"](): string;
    /**
      * `Failed to create admin`
      */
    ["com.affine.admin.failed-to-create-admin"](): string;
    /**
      * `Failed to load invoices`
      */
    ["com.affine.ui.failed-to-load-invoices"](): string;
    /**
      * `Provider registry`
      */
    ["com.affine.ui.provider-registry"](): string;
    /**
      * `Managed by`
      */
    ["com.affine.admin.managed-by"](): string;
    /**
      * `PDF page {{number}}, {{count}} annotation`
      */
    ["com.affine.office.pdf-page-label_one"](options: Readonly<{
        number: string;
        count: string | number | bigint;
    }>): string;
    /**
      * `Shared on`
      */
    ["com.affine.admin.shared-on"](): string;
    /**
      * `Page type`
      */
    ["com.affine.office.page-type"](): string;
    /**
      * `Workspace indexing model alias`
      */
    ["com.affine.admin.workspace-indexing-model-alias"](): string;
    /**
      * `Prompt model candidates`
      */
    ["com.affine.admin.prompt-model-candidates"](): string;
    /**
      * `Deleted user`
      */
    ["com.affine.ui.deleted-user"](): string;
    /**
      * `copilot.providers.geminiVertex: location, project, baseURL, and googleAuthOptions.`
      */
    ["com.affine.admin.copilot-providers-geminivertex-location-project-baseurl-and-googleauthoptions"](): string;
    /**
      * `No prepared routes returned.`
      */
    ["com.affine.admin.no-prepared-routes-returned"](): string;
    /**
      * `Agent runtime steps none`
      */
    ["com.affine.admin.agent-runtime-steps-none"](): string;
    /**
      * `Shape geometry`
      */
    ["com.affine.office.shape-geometry"](): string;
    /**
      * `paragraph(s),`
      */
    ["com.affine.office.paragraph-s"](): string;
    /**
      * `Edit Office comment reply`
      */
    ["com.affine.office.edit-office-comment-reply"](): string;
    /**
      * `Add a comment for this page`
      */
    ["com.affine.office.add-a-comment-for-this-page"](): string;
    /**
      * `Download metadata JSON`
      */
    ["com.affine.admin.download-metadata-json"](): string;
    /**
      * `Apply permanent redaction to this page? The page will be flattened and its original text and objects removed in a new revision.`
      */
    ["com.affine.office.apply-permanent-redaction-to-this-page-the-page-will-be-flattened-and-its-original-text-and-objects-"](): string;
    /**
      * `Saved revision has no editable Office state`
      */
    ["com.affine.office.saved-revision-has-no-editable-office-state"](): string;
    /**
      * `Latest v{{version}}`
      */
    ["com.affine.office.latest-version"](options: {
        readonly version: string;
    }): string;
    /**
      * `CSV file includes username, email, and password.`
      */
    ["com.affine.admin.csv-file-includes-username-email-and-password"](): string;
    /**
      * `Snapshot Size`
      */
    ["com.affine.admin.snapshot-size-2"](): string;
    /**
      * `Even pages`
      */
    ["com.affine.office.even-pages"](): string;
    /**
      * `Delete expired key`
      */
    ["com.affine.admin.delete-expired-key"](): string;
    /**
      * `Experimental export PDFs support, it may contain the wrong style.`
      */
    ["com.affine.ui.experimental-export-pdfs-support-it-may-contain-the-wrong-style"](): string;
    /**
      * `Reset Password`
      */
    ["com.affine.admin.reset-password"](): string;
    /**
      * `edit text`
      */
    ["com.affine.ai.action-label.edit-text"](): string;
    /**
      * `Cleaning`
      */
    ["com.affine.admin.cleaning"](): string;
    /**
      * `Edit Description`
      */
    ["com.affine.ui.edit-description"](): string;
    /**
      * `page(s)`
      */
    ["com.affine.office.page-s"](): string;
    /**
      * `Underline`
      */
    ["com.affine.office.annotation-type.Underline"](): string;
    /**
      * `Subtitle`
      */
    ["com.affine.office.subtitle"](): string;
    /**
      * `No provider health probe attempts returned.`
      */
    ["com.affine.admin.no-provider-health-probe-attempts-returned"](): string;
    /**
      * `Attachment kind not supported`
      */
    ["com.affine.ui.attachment-kind-not-supported"](): string;
    /**
      * `Executor payload JSON is invalid.`
      */
    ["com.affine.admin.executor-payload-json-is-invalid"](): string;
    /**
      * `shapes`
      */
    ["com.affine.office.shapes"](): string;
    /**
      * `The provider model satisfies the requested capability.`
      */
    ["com.affine.ui.the-provider-model-satisfies-the-requested-capability"](): string;
    /**
      * `Failed to copy users`
      */
    ["com.affine.admin.failed-to-copy-users"](): string;
    /**
      * `BYOK private endpoints`
      */
    ["com.affine.admin.byok-private-endpoints"](): string;
    /**
      * `Explain this image`
      */
    ["com.affine.ai.action-label.explain-this-image"](): string;
    /**
      * `PDF annotations and forms`
      */
    ["com.affine.office.pdf-annotations-and-forms"](): string;
    /**
      * `Provider health probes`
      */
    ["com.affine.admin.provider-health-probes"](): string;
    /**
      * `PDF document viewer`
      */
    ["com.affine.office.pdf-document-viewer"](): string;
    /**
      * `PDF is fixed-layout. AI changes are limited to annotations, forms, page operations, signature appearances, and redaction.`
      */
    ["com.affine.office.pdf-is-fixed-layout-ai-changes-are-limited-to-annotations-forms-page-operations-signature-appearance"](): string;
    /**
      * `Inspect`
      */
    ["com.affine.admin.inspect"](): string;
    /**
      * `Model route not checked`
      */
    ["com.affine.admin.model-route-not-checked"](): string;
    /**
      * `[Edgeless]`
      */
    ["com.affine.ui.edgeless"](): string;
    /**
      * `Failed to reset password: `
      */
    ["com.affine.admin.failed-to-reset-password"](): string;
    /**
      * `Filter by feature`
      */
    ["com.affine.admin.filter-by-feature"](): string;
    /**
      * `Signature name is required`
      */
    ["com.affine.office.signature-name-is-required"](): string;
    /**
      * `Beta`
      */
    ["com.affine.ui.beta"](): string;
    /**
      * `Provider profile model IDs, aliases, task defaults, and model allowlists.`
      */
    ["com.affine.ui.provider-profile-model-ids-aliases-task-defaults-and-model-allowlists"](): string;
    /**
      * `Project AI disabled.`
      */
    ["com.affine.admin.project-ai-disabled"](): string;
    /**
      * `Import results`
      */
    ["com.affine.admin.import-results"](): string;
    /**
      * `Priority`
      */
    ["com.affine.admin.priority"](): string;
    /**
      * `Print PDF`
      */
    ["com.affine.office.print-pdf"](): string;
    /**
      * `Provider prepare returned empty`
      */
    ["com.affine.ui.provider-prepare-returned-empty"](): string;
    /**
      * `Revision status`
      */
    ["com.affine.admin.revision-status"](): string;
    /**
      * `Allowed privacy`
      */
    ["com.affine.admin.allowed-privacy"](): string;
    /**
      * `Enables chat, actions, search, indexing, rerank, and runtime workers.`
      */
    ["com.affine.admin.enables-chat-actions-search-indexing-rerank-and-runtime-workers"](): string;
    /**
      * `Move worksheet left`
      */
    ["com.affine.office.move-worksheet-left"](): string;
    /**
      * `Gate issues`
      */
    ["com.affine.admin.gate-issues"](): string;
    /**
      * `Provider verified.`
      */
    ["com.affine.admin.provider-verified"](): string;
    /**
      * `Top`
      */
    ["com.affine.office.top"](): string;
    /**
      * `Page height`
      */
    ["com.affine.office.page-height"](): string;
    /**
      * `Blob count`
      */
    ["com.affine.admin.blob-count"](): string;
    /**
      * `Blocked providers None`
      */
    ["com.affine.admin.blocked-providers-none"](): string;
    /**
      * `Manual workspace ID`
      */
    ["com.affine.admin.manual-workspace-id"](): string;
    /**
      * `Notes for {{name}}`
      */
    ["com.affine.office.slide-notes"](options: {
        readonly name: string;
    }): string;
    /**
      * `The server returned an unsupported Office state`
      */
    ["com.affine.office.the-server-returned-an-unsupported-office-state"](): string;
    /**
      * `Form field {{name}}`
      */
    ["com.affine.office.named-form-field"](options: {
        readonly name: string;
    }): string;
    /**
      * `Deleted`
      */
    ["com.affine.ai.action-label.deleted"](): string;
    /**
      * `No data`
      */
    ["com.affine.admin.no-data"](): string;
    /**
      * `Different first page`
      */
    ["com.affine.office.different-first-page"](): string;
    /**
      * `Row height`
      */
    ["com.affine.office.row-height"](): string;
    /**
      * `Prompt catalog diagnostics`
      */
    ["com.affine.admin.prompt-catalog-diagnostics"](): string;
    /**
      * `Document header`
      */
    ["com.affine.ui.document-header"](): string;
    /**
      * `Search workspace name, owner, or ID`
      */
    ["com.affine.admin.search-workspace-name-owner-or-id"](): string;
    /**
      * `Header position`
      */
    ["com.affine.office.header-position"](): string;
    /**
      * `Active prompt`
      */
    ["com.affine.admin.active-prompt"](): string;
    /**
      * `Select a workspace scope before creating or viewing support bundles.`
      */
    ["com.affine.admin.select-a-workspace-scope-before-creating-or-viewing-support-bundles"](): string;
    /**
      * `Add appearance`
      */
    ["com.affine.office.add-appearance"](): string;
    /**
      * `error`
      */
    ["com.affine.ui.error"](): string;
    /**
      * `Humorous`
      */
    ["com.affine.ai.action-label.humorous"](): string;
    /**
      * `Instance policy is the maximum capability. Users authorize and manage only their own platform connections.`
      */
    ["com.affine.admin.instance-policy-is-the-maximum-capability-users-authorize-and-manage-only-their-own-platform-connect"](): string;
    /**
      * `Empty history`
      */
    ["com.affine.ai.action-label.empty-history"](): string;
    /**
      * `Provider model identifier`
      */
    ["com.affine.admin.provider-model-identifier"](): string;
    /**
      * `This registry branch produced a selected route candidate.`
      */
    ["com.affine.ui.this-registry-branch-produced-a-selected-route-candidate"](): string;
    /**
      * `Do you want to discard the results the AI just generated?`
      */
    ["com.affine.ui.do-you-want-to-discard-the-results-the-ai-just-generated"](): string;
    /**
      * `Chart`
      */
    ["com.affine.office.chart"](): string;
    /**
      * `Write a tweet about this`
      */
    ["com.affine.ai.action-label.write-a-tweet-about-this"](): string;
    /**
      * `Workspace scope`
      */
    ["com.affine.admin.workspace-scope"](): string;
    /**
      * `Project content changed; compare or discard the local draft`
      */
    ["com.affine.ui.project-content-changed-compare-or-discard-the-local-draft"](): string;
    /**
      * `Capability matching failed before route preparation.`
      */
    ["com.affine.ui.capability-matching-failed-before-route-preparation"](): string;
    /**
      * `Highlight`
      */
    ["com.affine.office.annotation-type.highlight"](): string;
    /**
      * `Unsupported comment content`
      */
    ["com.affine.office.unsupported-comment-content"](): string;
    /**
      * `Base URL`
      */
    ["com.affine.admin.base-url"](): string;
    /**
      * `All run statuses`
      */
    ["com.affine.admin.all-run-statuses"](): string;
    /**
      * `Failed to save chat to a block`
      */
    ["com.affine.ui.failed-to-save-chat-to-a-block"](): string;
    /**
      * `Syncing...`
      */
    ["com.affine.ui.syncing"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.ai.action-label.upgrade"](): string;
    /**
      * `Provider prepare succeeded`
      */
    ["com.affine.ui.provider-prepare-succeeded"](): string;
    /**
      * `All Project conversations`
      */
    ["com.affine.admin.all-project-conversations"](): string;
    /**
      * `Bottom`
      */
    ["com.affine.office.bottom"](): string;
    /**
      * `Experimental Features`
      */
    ["com.affine.ui.experimental-features"](): string;
    /**
      * `Go to previous page`
      */
    ["com.affine.admin.go-to-previous-page"](): string;
    /**
      * `Privacy not preferred`
      */
    ["com.affine.ui.privacy-not-preferred"](): string;
    /**
      * `Slide canvas`
      */
    ["com.affine.office.slide-canvas"](): string;
    /**
      * `Image processing`
      */
    ["com.affine.ai.action-label.image-processing"](): string;
    /**
      * `Workspace AI credential deleted.`
      */
    ["com.affine.admin.workspace-ai-credential-deleted"](): string;
    /**
      * `Add a file or image`
      */
    ["com.affine.ui.add-a-file-or-image"](): string;
    /**
      * `Reason`
      */
    ["com.affine.office.reason"](): string;
    /**
      * `Horizontal alignment`
      */
    ["com.affine.office.horizontal-alignment"](): string;
    /**
      * `Agent runtime schema readiness gaps none`
      */
    ["com.affine.admin.agent-runtime-schema-readiness-gaps-none"](): string;
    /**
      * `LocalMind brings docs, whiteboards and databases together in one workspace.`
      */
    ["com.affine.ui.onboarding-workspace"](): string;
    /**
      * `Provider unavailable`
      */
    ["com.affine.ui.provider-unavailable"](): string;
    /**
      * `{{count}} tracked change`
      */
    ["com.affine.office.tracked-change-count_one"](options: {
        readonly count: (string | number | bigint) & (string | number | bigint);
    }): string;
    /**
      * `Unable to open this document`
      */
    ["com.affine.office.unable-to-open-this-document"](): string;
    /**
      * `charts`
      */
    ["com.affine.office.charts"](): string;
    /**
      * `Agent runtime target run statuses none`
      */
    ["com.affine.admin.agent-runtime-target-run-statuses-none"](): string;
    /**
      * `Failed to clear history`
      */
    ["com.affine.ui.failed-to-clear-history"](): string;
    /**
      * `Storage Trend (Workspace + Blob)`
      */
    ["com.affine.admin.storage-trend-workspace-blob"](): string;
    /**
      * `Blob:`
      */
    ["com.affine.admin.blob-2"](): string;
    /**
      * `You are not an admin`
      */
    ["com.affine.admin.you-are-not-an-admin"](): string;
    /**
      * `Strikeout`
      */
    ["com.affine.office.annotation-type.Strikeout"](): string;
    /**
      * `The provider runtime prepare boundary produced a route.`
      */
    ["com.affine.ui.the-provider-runtime-prepare-boundary-produced-a-route"](): string;
    /**
      * `First page`
      */
    ["com.affine.office.first-page"](): string;
    /**
      * `Write an article about this`
      */
    ["com.affine.ai.action-label.write-an-article-about-this"](): string;
    /**
      * `Created time`
      */
    ["com.affine.admin.created-time"](): string;
    /**
      * `Snapshot Count`
      */
    ["com.affine.admin.snapshot-count-2"](): string;
    /**
      * `Worksheets`
      */
    ["com.affine.office.worksheets"](): string;
    /**
      * `Add shape`
      */
    ["com.affine.office.add-shape"](): string;
    /**
      * `Copilot storage JSON`
      */
    ["com.affine.admin.copilot-storage-json"](): string;
    /**
      * `Failed to copy link to clipboard`
      */
    ["com.affine.ui.failed-to-copy-link-to-clipboard"](): string;
    /**
      * `Bottom margin`
      */
    ["com.affine.office.bottom-margin"](): string;
    /**
      * `Pro models require a LocalMind AI subscription.`
      */
    ["com.affine.ui.pro-models-require-a-localmind-ai-subscription"](): string;
    /**
      * `Workspaces`
      */
    ["com.affine.admin.workspaces"](): string;
    /**
      * `Task routes 0`
      */
    ["com.affine.admin.task-routes-0"](): string;
    /**
      * `Logged in successfully`
      */
    ["com.affine.admin.logged-in-successfully"](): string;
    /**
      * `Self-host Document`
      */
    ["com.affine.admin.self-host-document"](): string;
    /**
      * `Office draft could not be saved`
      */
    ["com.affine.office.office-draft-could-not-be-saved"](): string;
    /**
      * `digital signatures`
      */
    ["com.affine.office.digital-signatures"](): string;
    /**
      * `Untitled workspace`
      */
    ["com.affine.admin.untitled-workspace"](): string;
    /**
      * `Route policy`
      */
    ["com.affine.ui.route-policy"](): string;
    /**
      * `Korean`
      */
    ["com.affine.ai.action-label.korean"](): string;
    /**
      * `No step route order`
      */
    ["com.affine.admin.no-step-route-order"](): string;
    /**
      * `Theme color`
      */
    ["com.affine.office.theme-color"](): string;
    /**
      * `Speaker notes`
      */
    ["com.affine.office.speaker-notes"](): string;
    /**
      * `No action required`
      */
    ["com.affine.admin.no-action-required"](): string;
    /**
      * `Rerank`
      */
    ["com.affine.admin.rerank"](): string;
    /**
      * `Profile name`
      */
    ["com.affine.admin.profile-name"](): string;
    /**
      * `Unsupported document object:`
      */
    ["com.affine.office.unsupported-document-object"](): string;
    /**
      * `Add image`
      */
    ["com.affine.office.add-image"](): string;
    /**
      * `Logout`
      */
    ["com.affine.admin.logout"](): string;
    /**
      * `Signature appearance (not cryptographic)`
      */
    ["com.affine.office.signature-appearance-not-cryptographic"](): string;
    /**
      * `Messages`
      */
    ["com.affine.admin.messages"](): string;
    /**
      * `Failed to reorder workspace AI credentials.`
      */
    ["com.affine.admin.failed-to-reorder-workspace-ai-credentials"](): string;
    /**
      * `Shape {{name}}`
      */
    ["com.affine.office.named-shape"](options: {
        readonly name: string;
    }): string;
    /**
      * `User name`
      */
    ["com.affine.admin.user-name"](): string;
    /**
      * `Allow pages in this workspace to be shared publicly`
      */
    ["com.affine.admin.allow-pages-in-this-workspace-to-be-shared-publicly"](): string;
    /**
      * `Go to Collection List`
      */
    ["com.affine.ui.go-to-collection-list"](): string;
    /**
      * `Failed to update account: `
      */
    ["com.affine.admin.failed-to-update-account"](): string;
    /**
      * `No publish gate verdict returned for`
      */
    ["com.affine.admin.no-publish-gate-verdict-returned-for"](): string;
    /**
      * `Signing key update failed`
      */
    ["com.affine.admin.signing-key-update-failed"](): string;
    /**
      * `Image insertion`
      */
    ["com.affine.office.image-insertion"](): string;
    /**
      * `New worksheet name`
      */
    ["com.affine.office.new-worksheet-name"](): string;
    /**
      * `Agent runtime projected timeline event types none`
      */
    ["com.affine.admin.agent-runtime-projected-timeline-event-types-none"](): string;
    /**
      * `The provider model does not support attachments for this route.`
      */
    ["com.affine.ui.the-provider-model-does-not-support-attachments-for-this-route"](): string;
    /**
      * `Control`
      */
    ["com.affine.admin.control"](): string;
    /**
      * `Prepared routes`
      */
    ["com.affine.admin.prepared-routes"](): string;
    /**
      * `Russian`
      */
    ["com.affine.ai.action-label.russian"](): string;
    /**
      * `Enable AI Button on mobile`
      */
    ["com.affine.ui.enable-ai-button-on-mobile"](): string;
    /**
      * `Enter a valid cell address before changing rows or columns.`
      */
    ["com.affine.office.enter-a-valid-cell-address-before-changing-rows-or-columns"](): string;
    /**
      * `Kind`
      */
    ["com.affine.admin.kind"](): string;
    /**
      * `Account updated successfully`
      */
    ["com.affine.admin.account-updated-successfully"](): string;
    /**
      * `Refresh Office changes`
      */
    ["com.affine.office.refresh-office-changes"](): string;
    /**
      * `The sanitized prepare error category points to schema, JSON, validation, or parsing.`
      */
    ["com.affine.ui.the-sanitized-prepare-error-category-points-to-schema-json-validation-or-parsing"](): string;
    /**
      * `Override`
      */
    ["com.affine.admin.override"](): string;
    /**
      * `Agent runtime timeline event types none`
      */
    ["com.affine.admin.agent-runtime-timeline-event-types-none"](): string;
    /**
      * `Invalid ({{reason}})`
      */
    ["com.affine.admin.import-invalid-reason"](options: {
        readonly reason: string;
    }): string;
    /**
      * `Loading changes`
      */
    ["com.affine.office.loading-changes"](): string;
    /**
      * `Unsaved AI configuration changes`
      */
    ["com.affine.admin.unsaved-ai-configuration-changes"](): string;
    /**
      * `Shared Links`
      */
    ["com.affine.admin.shared-links-2"](): string;
    /**
      * `Save failed. Check the endpoint, model and key, or reload if another administrator changed the settings.`
      */
    ["com.affine.admin.save-failed-check-the-endpoint-model-and-key-or-reload-if-another-administrator-changed-the-settings"](): string;
    /**
      * `Provider default model`
      */
    ["com.affine.admin.provider-default-model"](): string;
    /**
      * `Allowed privacy classes, preferred privacy classes, and local/cloud routing policy.`
      */
    ["com.affine.ui.allowed-privacy-classes-preferred-privacy-classes-and-local-cloud-routing-policy"](): string;
    /**
      * `All executions`
      */
    ["com.affine.admin.all-executions"](): string;
    /**
      * `{{hours}} hours, grouped by minute`
      */
    ["com.affine.admin.sync-window"](options: {
        readonly hours: string;
    }): string;
    /**
      * `Delete Account ?`
      */
    ["com.affine.admin.delete-account"](): string;
    /**
      * `Agent runtime unsupported run statuses none`
      */
    ["com.affine.admin.agent-runtime-unsupported-run-statuses-none"](): string;
    /**
      * `Enable sharing`
      */
    ["com.affine.admin.enable-sharing"](): string;
    /**
      * `Please select at least one user to export`
      */
    ["com.affine.admin.please-select-at-least-one-user-to-export"](): string;
    /**
      * `Update workspace avatar success`
      */
    ["com.affine.ui.update-workspace-avatar-success"](): string;
    /**
      * `The provider privacy class is allowed but not preferred.`
      */
    ["com.affine.ui.the-provider-privacy-class-is-allowed-but-not-preferred"](): string;
    /**
      * `Strikeout`
      */
    ["com.affine.office.strikeout"](): string;
    /**
      * `Prompt overrides`
      */
    ["com.affine.admin.prompt-overrides"](): string;
    /**
      * `Provider test failed.`
      */
    ["com.affine.admin.provider-test-failed"](): string;
    /**
      * `Users exported successfully`
      */
    ["com.affine.admin.users-exported-successfully"](): string;
    /**
      * `Workspace AI disabled`
      */
    ["com.affine.admin.workspace-ai-disabled"](): string;
    /**
      * `Delete comment`
      */
    ["com.affine.office.delete-comment"](): string;
    /**
      * `Updated at`
      */
    ["com.affine.admin.updated-at"](): string;
    /**
      * `The member has already been selected`
      */
    ["com.affine.ui.the-member-has-already-been-selected"](): string;
    /**
      * `The latest Office revision has no editable state.`
      */
    ["com.affine.office.the-latest-office-revision-has-no-editable-state"](): string;
    /**
      * `Select content to anchor this comment.`
      */
    ["com.affine.office.select-content-to-anchor-this-comment"](): string;
    /**
      * `Worksheet rename`
      */
    ["com.affine.office.worksheet-rename"](): string;
    /**
      * `Saving...`
      */
    ["com.affine.admin.saving"](): string;
    /**
      * `Select Icon`
      */
    ["com.affine.ui.select-icon"](): string;
    /**
      * `Unmerge`
      */
    ["com.affine.office.unmerge"](): string;
    /**
      * `Translation coverage: {{percent}}%`
      */
    ["com.affine.settings.language.coverage"](options: {
        readonly percent: string;
    }): string;
    /**
      * `Brazilian Portuguese`
      */
    ["com.affine.ai.action-label.brazilian-portuguese"](): string;
    /**
      * `Insert table`
      */
    ["com.affine.office.insert-table"](): string;
    /**
      * `{{count}} pages`
      */
    ["com.affine.office.page-count_other"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `All probe statuses`
      */
    ["com.affine.admin.all-probe-statuses"](): string;
    /**
      * `Repair execution control error`
      */
    ["com.affine.admin.repair-execution-control-error"](): string;
    /**
      * `License ID`
      */
    ["com.affine.admin.license-id"](): string;
    /**
      * `Office task {{action}} failed`
      */
    ["com.affine.office.task-action-failed"](options: {
        readonly action: string;
    }): string;
    /**
      * `All Settings Done`
      */
    ["com.affine.admin.all-settings-done"](): string;
    /**
      * `Active default`
      */
    ["com.affine.admin.active-default"](): string;
    /**
      * `Failed to delete user: `
      */
    ["com.affine.admin.failed-to-delete-user"](): string;
    /**
      * `Dimension mismatch`
      */
    ["com.affine.admin.dimension-mismatch"](): string;
    /**
      * `Office changes`
      */
    ["com.affine.office.office-changes"](): string;
    /**
      * `Use repair execution controls`
      */
    ["com.affine.admin.use-repair-execution-controls"](): string;
    /**
      * `Failed to load Workspace AI Profiles.`
      */
    ["com.affine.admin.failed-to-load-workspace-ai-profiles"](): string;
    /**
      * `The registry branch is unavailable for this request.`
      */
    ["com.affine.ui.the-registry-branch-is-unavailable-for-this-request"](): string;
    /**
      * `Unsupported Office state`
      */
    ["com.affine.office.unsupported-office-state"](): string;
    /**
      * `Sort:`
      */
    ["com.affine.admin.sort"](): string;
    /**
      * `Executor payload JSON must be an object.`
      */
    ["com.affine.admin.executor-payload-json-must-be-an-object"](): string;
    /**
      * `Switch Chat`
      */
    ["com.affine.ui.switch-chat"](): string;
    /**
      * `Office task result targets a different artifact.`
      */
    ["com.affine.office.office-task-result-targets-a-different-artifact"](): string;
    /**
      * `Default`
      */
    ["com.affine.office.default"](): string;
    /**
      * `Configure the server-side provider credentials inherited by each department workspace. Workspace members cannot read or change these secrets.`
      */
    ["com.affine.admin.configure-the-server-side-provider-credentials-inherited-by-each-department-workspace-workspace-memb"](): string;
    /**
      * `Blocked`
      */
    ["com.affine.admin.blocked"](): string;
    /**
      * `Insert`
      */
    ["com.affine.ui.insert"](): string;
    /**
      * `Height (pt)`
      */
    ["com.affine.office.height-pt"](): string;
    /**
      * `Remove table`
      */
    ["com.affine.office.remove-table"](): string;
    /**
      * `No Agent Runtime workflow adapters are registered for standalone execution.`
      */
    ["com.affine.admin.no-agent-runtime-workflow-adapters-are-registered-for-standalone-execution"](): string;
    /**
      * `Save chat to a block`
      */
    ["com.affine.ui.save-chat-to-a-block"](): string;
    /**
      * `Show All`
      */
    ["com.affine.ui.show-all"](): string;
    /**
      * `No persisted Agent Runtime runs have been created for this workspace.`
      */
    ["com.affine.admin.no-persisted-agent-runtime-runs-have-been-created-for-this-workspace"](): string;
    /**
      * `Slide deletion`
      */
    ["com.affine.office.slide-deletion"](): string;
    /**
      * `Insert columns`
      */
    ["com.affine.office.insert-columns"](): string;
    /**
      * `draft from text`
      */
    ["com.affine.ai.action-label.draft-from-text"](): string;
    /**
      * `Preview ready:`
      */
    ["com.affine.office.preview-ready"](): string;
    /**
      * `Default model route`
      */
    ["com.affine.admin.default-model-route"](): string;
    /**
      * `This feature is not available in the page editor. Switch to edgeless mode.`
      */
    ["com.affine.ui.this-feature-is-not-available-in-the-page-editor-switch-to-edgeless-mode"](): string;
    /**
      * `Task route policy source`
      */
    ["com.affine.admin.task-route-policy-source"](): string;
    /**
      * `Delete annotation`
      */
    ["com.affine.office.delete-annotation"](): string;
    /**
      * `Enter at least one series.`
      */
    ["com.affine.office.enter-at-least-one-series"](): string;
    /**
      * `Allowed providers`
      */
    ["com.affine.admin.allowed-providers"](): string;
    /**
      * `Resume with payload`
      */
    ["com.affine.admin.resume-with-payload"](): string;
    /**
      * `Setup Account`
      */
    ["com.affine.admin.setup-account"](): string;
    /**
      * `Trace`
      */
    ["com.affine.admin.trace"](): string;
    /**
      * `Thank you!`
      */
    ["com.affine.ui.thank-you"](): string;
    /**
      * `Answer`
      */
    ["com.affine.ai.action-label.answer"](): string;
    /**
      * `Stale`
      */
    ["com.affine.admin.stale"](): string;
    /**
      * `LocalMind will gradually support more file types for import.&nbsp;`
      */
    ["com.affine.ui.localmind-will-gradually-support-more-file-types-for-import-nbsp"](): string;
    /**
      * `Success`
      */
    ["com.affine.admin.success"](): string;
    /**
      * `Could not test Project BYOK.`
      */
    ["com.affine.admin.could-not-test-project-byok"](): string;
    /**
      * `Discard Changes`
      */
    ["com.affine.admin.discard-changes"](): string;
    /**
      * `Public`
      */
    ["com.affine.admin.public"](): string;
    /**
      * `Unknown error occurred`
      */
    ["com.affine.ui.unknown-error-occurred"](): string;
    /**
      * `Provider profiles JSON`
      */
    ["com.affine.admin.provider-profiles-json"](): string;
    /**
      * `Workspace ID`
      */
    ["com.affine.admin.workspace-id"](): string;
    /**
      * `Agent runtime step statuses none`
      */
    ["com.affine.admin.agent-runtime-step-statuses-none"](): string;
    /**
      * `Close sidebar`
      */
    ["com.affine.ui.close-sidebar"](): string;
    /**
      * `Project AI enabled.`
      */
    ["com.affine.admin.project-ai-enabled-2"](): string;
    /**
      * `slides`
      */
    ["com.affine.office.slides"](): string;
    /**
      * `The provider model has no declared capability metadata.`
      */
    ["com.affine.ui.the-provider-model-has-no-declared-capability-metadata"](): string;
    /**
      * `Explain selection`
      */
    ["com.affine.ai.action-label.explain-selection"](): string;
    /**
      * `Ask AI`
      */
    ["com.affine.ai.action-label.ask-ai"](): string;
    /**
      * `members`
      */
    ["com.affine.ui.members"](): string;
    /**
      * `Editable document paragraph`
      */
    ["com.affine.office.editable-document-paragraph"](): string;
    /**
      * `Runtime adapter registration, container networking, native prepare, and provider logs.`
      */
    ["com.affine.ui.runtime-adapter-registration-container-networking-native-prepare-and-provider-logs"](): string;
    /**
      * `Lets workspace BYOK profiles use custom compatible endpoints.`
      */
    ["com.affine.admin.lets-workspace-byok-profiles-use-custom-compatible-endpoints"](): string;
    /**
      * `Next page section`
      */
    ["com.affine.office.next-page-section"](): string;
    /**
      * `Replay`
      */
    ["com.affine.admin.replay"](): string;
    /**
      * `Prepare model error`
      */
    ["com.affine.ui.prepare-model-error"](): string;
    /**
      * `Provider health probe filter`
      */
    ["com.affine.admin.provider-health-probe-filter"](): string;
    /**
      * `Search result`
      */
    ["com.affine.ui.search-result"](): string;
    /**
      * `Could not load the language files. Please try again.`
      */
    ["com.affine.settings.language.load-failed"](): string;
    /**
      * `Username (optional): any text.`
      */
    ["com.affine.admin.username-optional-any-text"](): string;
    /**
      * `A profile with no credentials intentionally disables AI routing for users assigned to it.`
      */
    ["com.affine.admin.a-profile-with-no-credentials-intentionally-disables-ai-routing-for-users-assigned-to-it"](): string;
    /**
      * `Move page up`
      */
    ["com.affine.office.move-page-up"](): string;
    /**
      * `Left margin`
      */
    ["com.affine.office.left-margin"](): string;
    /**
      * `Preferred privacy Any`
      */
    ["com.affine.admin.preferred-privacy-any"](): string;
    /**
      * `Config fallback`
      */
    ["com.affine.admin.config-fallback"](): string;
    /**
      * `Retiring`
      */
    ["com.affine.admin.retiring"](): string;
    /**
      * `Prompt policy`
      */
    ["com.affine.admin.prompt-policy"](): string;
    /**
      * `Ink`
      */
    ["com.affine.office.annotation-type.ink"](): string;
    /**
      * `Apply permanent redaction`
      */
    ["com.affine.office.apply-permanent-redaction"](): string;
    /**
      * `Select a font`
      */
    ["com.affine.ui.select-a-font"](): string;
    /**
      * `copilot.providers.routePolicy: global, per-feature, and per-workspace allow/block/privacy routing policy.`
      */
    ["com.affine.admin.copilot-providers-routepolicy-global-per-feature-and-per-workspace-allow-block-privacy-routing-polic"](): string;
    /**
      * `No results.`
      */
    ["com.affine.admin.no-results"](): string;
    /**
      * `Repair recommendations`
      */
    ["com.affine.admin.repair-recommendations"](): string;
    /**
      * `Use the new Mermaid renderer backend. Web uses WASM, desktop uses native, and mobile always uses native. The native renderer is more than 10x faster, but its styling/aesthetic quality and the types of graphics it supports are not as good as the JS version.`
      */
    ["com.affine.ui.use-the-new-mermaid-renderer-backend-web-uses-wasm-desktop-uses-native-and-mobile-always-uses-native"](): string;
    /**
      * `Move page down`
      */
    ["com.affine.office.move-page-down"](): string;
    /**
      * `Selection preserved on revision {{version}}.`
      */
    ["com.affine.office.selection-preserved"](options: {
        readonly version: string;
    }): string;
    /**
      * `Account Recovery Link`
      */
    ["com.affine.admin.account-recovery-link"](): string;
    /**
      * `The test email has been successfully sent.`
      */
    ["com.affine.admin.the-test-email-has-been-successfully-sent"](): string;
    /**
      * `No active signing key is available. Restart the server to retry automatic initialization.`
      */
    ["com.affine.admin.no-active-signing-key-is-available-restart-the-server-to-retry-automatic-initialization"](): string;
    /**
      * `(pt)`
      */
    ["com.affine.office.pt"](): string;
    /**
      * `Issues`
      */
    ["com.affine.admin.issues"](): string;
    /**
      * `Enter password`
      */
    ["com.affine.admin.enter-password"](): string;
    /**
      * `Loading PDF document…`
      */
    ["com.affine.office.loading-pdf-document"](): string;
    /**
      * `No routes`
      */
    ["com.affine.admin.no-routes"](): string;
    /**
      * `The completed Office task artifact is unavailable.`
      */
    ["com.affine.office.the-completed-office-task-artifact-is-unavailable"](): string;
    /**
      * `Chart deletion`
      */
    ["com.affine.office.chart-deletion"](): string;
    /**
      * `Models returned for`
      */
    ["com.affine.admin.models-returned-for"](): string;
    /**
      * `Action run ID`
      */
    ["com.affine.admin.action-run-id"](): string;
    /**
      * `Disable & Delete data`
      */
    ["com.affine.admin.disable-delete-data"](): string;
    /**
      * `False`
      */
    ["com.affine.ui.false"](): string;
    /**
      * `New Version`
      */
    ["com.affine.admin.new-version"](): string;
    /**
      * `Enable mobile database editing`
      */
    ["com.affine.ui.enable-mobile-database-editing"](): string;
    /**
      * `Enables governed user connections for enterprise platforms.`
      */
    ["com.affine.admin.enables-governed-user-connections-for-enterprise-platforms"](): string;
    /**
      * `Prepare network error`
      */
    ["com.affine.ui.prepare-network-error"](): string;
    /**
      * `{{count}} matches`

      * - com.affine.office.match-count_other: `{{count}} matches`

      * - com.affine.office.match-count_one: `{{count}} match`
      */
    ["com.affine.office.match-count"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Artifact`
      */
    ["com.affine.admin.artifact"](): string;
    /**
      * `Edit AI Profile`
      */
    ["com.affine.admin.edit-ai-profile"](): string;
    /**
      * `Enable Email`
      */
    ["com.affine.admin.enable-email"](): string;
    /**
      * `Brainstorm ideas about this`
      */
    ["com.affine.ai.action-label.brainstorm-ideas-about-this"](): string;
    /**
      * `Provider metadata unavailable`
      */
    ["com.affine.admin.provider-metadata-unavailable"](): string;
    /**
      * `Provider credential verified.`
      */
    ["com.affine.admin.provider-credential-verified"](): string;
    /**
      * `rejection`
      */
    ["com.affine.office.task-action.reject"](): string;
    /**
      * `AI configuration saved.`
      */
    ["com.affine.admin.ai-configuration-saved"](): string;
    /**
      * `Use workspace default`
      */
    ["com.affine.admin.use-workspace-default"](): string;
    /**
      * `Please restart the app manually to upgrade.`
      */
    ["com.affine.ui.please-restart-the-app-manually-to-upgrade"](): string;
    /**
      * `Prompt registry publish gate`
      */
    ["com.affine.admin.prompt-registry-publish-gate"](): string;
    /**
      * `Square`
      */
    ["com.affine.office.annotation-type.Square"](): string;
    /**
      * `Underline`
      */
    ["com.affine.office.annotation-type.underline"](): string;
    /**
      * `Office dialog changes could not be saved`
      */
    ["com.affine.office.office-dialog-changes-could-not-be-saved"](): string;
    /**
      * `Prompt name`
      */
    ["com.affine.admin.prompt-name"](): string;
    /**
      * `Failed to delete Workspace AI Profile.`
      */
    ["com.affine.admin.failed-to-delete-workspace-ai-profile"](): string;
    /**
      * `Goto Admin Panel`
      */
    ["com.affine.admin.goto-admin-panel"](): string;
    /**
      * `Creating`
      */
    ["com.affine.admin.creating"](): string;
    /**
      * `Download JSON`
      */
    ["com.affine.admin.download-json"](): string;
    /**
      * `This account can also be used to log in to LocalMind.`
      */
    ["com.affine.admin.this-account-can-also-be-used-to-log-in-to-localmind"](): string;
    /**
      * `Page {{current}} of {{total}}`
      */
    ["com.affine.office.page-position"](options: Readonly<{
        current: string;
        total: string;
    }>): string;
    /**
      * `Enter your email below to login to your account`
      */
    ["com.affine.admin.enter-your-email-below-to-login-to-your-account"](): string;
    /**
      * `Previous slide`
      */
    ["com.affine.admin.previous-slide"](): string;
    /**
      * `Repair execution status`
      */
    ["com.affine.admin.repair-execution-status"](): string;
    /**
      * `Enable profile`
      */
    ["com.affine.admin.enable-profile"](): string;
    /**
      * `shared pages`
      */
    ["com.affine.admin.shared-pages"](): string;
    /**
      * `This workbook has no worksheets.`
      */
    ["com.affine.office.this-workbook-has-no-worksheets"](): string;
    /**
      * `Fingerprint`
      */
    ["com.affine.admin.fingerprint"](): string;
    /**
      * `New shape text`
      */
    ["com.affine.office.new-shape-text"](): string;
    /**
      * `The route policy allowed-provider list excludes this provider.`
      */
    ["com.affine.ui.the-route-policy-allowed-provider-list-excludes-this-provider"](): string;
    /**
      * `Use OpenAI legacy API style`
      */
    ["com.affine.admin.use-openai-legacy-api-style"](): string;
    /**
      * `Candidates`
      */
    ["com.affine.admin.candidates"](): string;
    /**
      * `Bookmarks`
      */
    ["com.affine.office.bookmarks"](): string;
    /**
      * `Model`
      */
    ["com.affine.admin.model"](): string;
    /**
      * `Delete {{type}} annotation`
      */
    ["com.affine.office.delete-typed-annotation"](options: {
        readonly type: string;
    }): string;
    /**
      * `API token`
      */
    ["com.affine.admin.api-token"](): string;
    /**
      * `Save text`
      */
    ["com.affine.office.save-text"](): string;
    /**
      * `Edit {{type}} annotation`
      */
    ["com.affine.office.edit-typed-annotation"](options: {
        readonly type: string;
    }): string;
    /**
      * `Search Email / UUID`
      */
    ["com.affine.admin.search-email-uuid"](): string;
    /**
      * `Continue writing`
      */
    ["com.affine.ai.action-label.continue-writing"](): string;
    /**
      * `Operation failed`
      */
    ["com.affine.ui.operation-failed"](): string;
    /**
      * `Auto-generated`
      */
    ["com.affine.admin.auto-generated"](): string;
    /**
      * `New Page`
      */
    ["com.affine.ui.new-page"](): string;
    /**
      * `No mail deliveries in this window`
      */
    ["com.affine.admin.no-mail-deliveries-in-this-window"](): string;
    /**
      * `Selection cleared because its stable target is not present in the new revision.`
      */
    ["com.affine.office.selection-cleared-because-its-stable-target-is-not-present-in-the-new-revision"](): string;
    /**
      * `Friendly`
      */
    ["com.affine.ai.action-label.friendly"](): string;
    /**
      * `Repair execution control`
      */
    ["com.affine.admin.repair-execution-control"](): string;
    /**
      * `Remove selection from AI context`
      */
    ["com.affine.office.remove-selection-from-ai-context"](): string;
    /**
      * `Enter a value or start a formula with =`
      */
    ["com.affine.office.enter-a-value-or-start-a-formula-with"](): string;
    /**
      * `Loading support bundle requests.`
      */
    ["com.affine.admin.loading-support-bundle-requests"](): string;
    /**
      * `Workspace indexing`
      */
    ["com.affine.admin.workspace-indexing"](): string;
    /**
      * `Choose a workspace.`
      */
    ["com.affine.ui.choose-a-workspace"](): string;
    /**
      * `Repair execution approval decision`
      */
    ["com.affine.admin.repair-execution-approval-decision"](): string;
    /**
      * `No prepared step targets`
      */
    ["com.affine.admin.no-prepared-step-targets"](): string;
    /**
      * `Sketch style`
      */
    ["com.affine.ai.action-label.sketch-style"](): string;
    /**
      * `copilot.providers.anthropicVertex: location, project, baseURL, and googleAuthOptions.`
      */
    ["com.affine.admin.copilot-providers-anthropicvertex-location-project-baseurl-and-googleauthoptions"](): string;
    /**
      * `{{count}} matches`
      */
    ["com.affine.office.match-count_other"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Task route`
      */
    ["com.affine.admin.task-route"](): string;
    /**
      * `The sanitized prepare error category points to an uncategorized provider runtime failure.`
      */
    ["com.affine.ui.the-sanitized-prepare-error-category-points-to-an-uncategorized-provider-runtime-failure"](): string;
    /**
      * `Apply and save`
      */
    ["com.affine.office.apply-and-save"](): string;
    /**
      * `Managed Storage`
      */
    ["com.affine.admin.managed-storage"](): string;
    /**
      * `Disable Account ?`
      */
    ["com.affine.admin.disable-account"](): string;
    /**
      * `Unable to load document contents`
      */
    ["com.affine.office.unable-to-load-document-contents"](): string;
    /**
      * `Annotation color`
      */
    ["com.affine.office.annotation-color"](): string;
    /**
      * `Filter values, comma separated`
      */
    ["com.affine.office.filter-values-comma-separated"](): string;
    /**
      * `Comparing against v{{version}}`
      */
    ["com.affine.office.comparing-version"](options: {
        readonly version: string;
    }): string;
    /**
      * `No configured profile model matched the requested capability.`
      */
    ["com.affine.ui.no-configured-profile-model-matched-the-requested-capability"](): string;
    /**
      * `approval`
      */
    ["com.affine.office.task-action.approve"](): string;
    /**
      * `Repair execution request not checked`
      */
    ["com.affine.admin.repair-execution-request-not-checked"](): string;
    /**
      * `Search prompts, actions, or models`
      */
    ["com.affine.admin.search-prompts-actions-or-models"](): string;
    /**
      * `Provider health probe retry error`
      */
    ["com.affine.admin.provider-health-probe-retry-error"](): string;
    /**
      * `The provider is not currently available for routing.`
      */
    ["com.affine.ui.the-provider-is-not-currently-available-for-routing"](): string;
    /**
      * `No persisted timeline events`
      */
    ["com.affine.admin.no-persisted-timeline-events"](): string;
    /**
      * `Member already exists`
      */
    ["com.affine.ui.member-already-exists"](): string;
    /**
      * `Success / failure`
      */
    ["com.affine.admin.success-failure"](): string;
    /**
      * `The expired key will be permanently removed.`
      */
    ["com.affine.admin.the-expired-key-will-be-permanently-removed"](): string;
    /**
      * `Blocked providers`
      */
    ["com.affine.admin.blocked-providers"](): string;
    /**
      * `Latest created bundle`
      */
    ["com.affine.admin.latest-created-bundle"](): string;
    /**
      * `Insert below`
      */
    ["com.affine.ai.action-label.insert-below"](): string;
    /**
      * `Success rate`
      */
    ["com.affine.admin.success-rate"](): string;
    /**
      * `Presentation editing`
      */
    ["com.affine.office.presentation-editing"](): string;
    /**
      * `Invalid email address.`
      */
    ["com.affine.admin.invalid-email-address"](): string;
    /**
      * `English`
      */
    ["com.affine.ai.action-label.english"](): string;
    /**
      * `Recommended checks`
      */
    ["com.affine.admin.recommended-checks"](): string;
    /**
      * `True`
      */
    ["com.affine.ui.true"](): string;
    /**
      * `Loading preview…`
      */
    ["com.affine.office.loading-preview"](): string;
    /**
      * `Report an Issue`
      */
    ["com.affine.admin.report-an-issue"](): string;
    /**
      * `Prev`
      */
    ["com.affine.ui.prev"](): string;
    /**
      * `Legacy quota candidate`
      */
    ["com.affine.ui.legacy-quota-candidate"](): string;
    /**
      * `Anime style`
      */
    ["com.affine.ai.action-label.anime-style"](): string;
    /**
      * `Official Website`
      */
    ["com.affine.ui.official-website"](): string;
    /**
      * `Allow URL previews in shared pages`
      */
    ["com.affine.admin.allow-url-previews-in-shared-pages"](): string;
    /**
      * `cells`
      */
    ["com.affine.office.cells"](): string;
    /**
      * `Failed to generate invitation link`
      */
    ["com.affine.ui.failed-to-generate-invitation-link"](): string;
    /**
      * `Document navigation`
      */
    ["com.affine.office.document-navigation"](): string;
    /**
      * `Add credential`
      */
    ["com.affine.admin.add-credential"](): string;
    /**
      * `Comma-separated exact tool names. Use * only to allow the full discovered catalog for this provider.`
      */
    ["com.affine.admin.comma-separated-exact-tool-names-use-only-to-allow-the-full-discovered-catalog-for-this-provider"](): string;
    /**
      * `Workspace:`
      */
    ["com.affine.admin.workspace"](): string;
    /**
      * `Search results`
      */
    ["com.affine.office.search-results"](): string;
    /**
      * `Workspace Global`
      */
    ["com.affine.admin.workspace-global"](): string;
    /**
      * `Stale check`
      */
    ["com.affine.admin.stale-check"](): string;
    /**
      * `Policy candidates`
      */
    ["com.affine.admin.policy-candidates"](): string;
    /**
      * `Generate a caption`
      */
    ["com.affine.ai.action-label.generate-a-caption"](): string;
    /**
      * `Repair execution filter`
      */
    ["com.affine.admin.repair-execution-filter"](): string;
    /**
      * `Add chart`
      */
    ["com.affine.office.add-chart"](): string;
    /**
      * `Update user avatar success`
      */
    ["com.affine.ui.update-user-avatar-success"](): string;
    /**
      * `OpenAI-compatible request API style`
      */
    ["com.affine.admin.openai-compatible-request-api-style"](): string;
    /**
      * `Discussion about this feature`
      */
    ["com.affine.ui.discussion-about-this-feature"](): string;
    /**
      * `No Result`
      */
    ["com.affine.ai.action-label.no-result"](): string;
    /**
      * `with your docs`
      */
    ["com.affine.ai.action-label.with-your-docs"](): string;
    /**
      * `Prepared route filtered`
      */
    ["com.affine.ui.prepared-route-filtered"](): string;
    /**
      * `No step canonical model pairs`
      */
    ["com.affine.admin.no-step-canonical-model-pairs"](): string;
    /**
      * `Failed to save AI configuration.`
      */
    ["com.affine.admin.failed-to-save-ai-configuration"](): string;
    /**
      * `Failed to preview license.`
      */
    ["com.affine.admin.failed-to-preview-license"](): string;
    /**
      * `Invalid Office package URL`
      */
    ["com.affine.office.invalid-office-package-url"](): string;
    /**
      * `Account created, but AI Profile assignment failed: `
      */
    ["com.affine.admin.account-created-but-ai-profile-assignment-failed"](): string;
    /**
      * `Prepare auth error`
      */
    ["com.affine.ui.prepare-auth-error"](): string;
    /**
      * `More pages`
      */
    ["com.affine.admin.more-pages"](): string;
    /**
      * `LocalMind is ready to use.`
      */
    ["com.affine.admin.localmind-is-ready-to-use"](): string;
    /**
      * `The attachment is being downloaded to your computer.`
      */
    ["com.affine.ui.the-attachment-is-being-downloaded-to-your-computer"](): string;
    /**
      * `Timeline`
      */
    ["com.affine.admin.timeline"](): string;
    /**
      * `Highest severity:`
      */
    ["com.affine.admin.highest-severity"](): string;
    /**
      * `Column`
      */
    ["com.affine.office.column"](): string;
    /**
      * `Select a variable to edit`
      */
    ["com.affine.ui.select-a-variable-to-edit"](): string;
    /**
      * `Group approved credentials into reusable routing profiles. A user assignment takes priority in this workspace, followed by the workspace default.`
      */
    ["com.affine.admin.group-approved-credentials-into-reusable-routing-profiles-a-user-assignment-takes-priority-in-this-w"](): string;
    /**
      * `Agent runtime target step types none`
      */
    ["com.affine.admin.agent-runtime-target-step-types-none"](): string;
    /**
      * `Copy metadata`
      */
    ["com.affine.admin.copy-metadata"](): string;
    /**
      * `Settings changed; please restart the app.`
      */
    ["com.affine.ui.settings-changed-please-restart-the-app"](): string;
    /**
      * `command(s)`
      */
    ["com.affine.office.command-s"](): string;
    /**
      * `Support bundle object-storage webhooks JSON`
      */
    ["com.affine.admin.support-bundle-object-storage-webhooks-json"](): string;
    /**
      * `Limits`
      */
    ["com.affine.admin.limits"](): string;
    /**
      * `Privacy Policy`
      */
    ["com.affine.ui.privacy-policy"](): string;
    /**
      * `New profile`
      */
    ["com.affine.admin.new-profile"](): string;
    /**
      * `Available`
      */
    ["com.affine.admin.available"](): string;
    /**
      * `Search, assets, storage, and support bundles`
      */
    ["com.affine.admin.search-assets-storage-and-support-bundles"](): string;
    /**
      * `The provider model does not support the requested output type.`
      */
    ["com.affine.ui.the-provider-model-does-not-support-the-requested-output-type"](): string;
    /**
      * `Pro models`
      */
    ["com.affine.admin.pro-models"](): string;
    /**
      * `Document selection across {{start}} and {{end}}`
      */
    ["com.affine.office.selection-span"](options: Readonly<{
        start: string;
        end: string;
    }>): string;
    /**
      * `Columns`
      */
    ["com.affine.office.columns"](): string;
    /**
      * `Profile`
      */
    ["com.affine.admin.profile"](): string;
    /**
      * `(optional)`
      */
    ["com.affine.admin.optional"](): string;
    /**
      * `Allow BYOK custom endpoint`
      */
    ["com.affine.admin.allow-byok-custom-endpoint"](): string;
    /**
      * `Add annotation`
      */
    ["com.affine.office.add-annotation"](): string;
    /**
      * `Agent runtime step types none`
      */
    ["com.affine.admin.agent-runtime-step-types-none"](): string;
    /**
      * `Free`
      */
    ["com.affine.ui.free"](): string;
    /**
      * `Signer name`
      */
    ["com.affine.office.signer-name"](): string;
    /**
      * `Historical revision, read only`
      */
    ["com.affine.office.historical-revision-read-only"](): string;
    /**
      * `Previous`
      */
    ["com.affine.admin.previous"](): string;
    /**
      * `Failed to upload attachment`
      */
    ["com.affine.ui.failed-to-upload-attachment"](): string;
    /**
      * `Run`
      */
    ["com.affine.admin.run"](): string;
    /**
      * `Not entitled`
      */
    ["com.affine.admin.not-entitled"](): string;
    /**
      * `Chat History`
      */
    ["com.affine.ai.action-label.chat-history"](): string;
    /**
      * `No candidate diagnostics returned.`
      */
    ["com.affine.admin.no-candidate-diagnostics-returned"](): string;
    /**
      * `Routes`
      */
    ["com.affine.admin.routes"](): string;
    /**
      * `Provider enablement, credentials, endpoint, health, privacy, and profile configuration.`
      */
    ["com.affine.ui.provider-enablement-credentials-endpoint-health-privacy-and-profile-configuration"](): string;
    /**
      * `User deleted successfully`
      */
    ["com.affine.admin.user-deleted-successfully"](): string;
    /**
      * `Traditional Chinese`
      */
    ["com.affine.ai.action-label.traditional-chinese"](): string;
    /**
      * `The sanitized prepare error category points to network, endpoint, timeout, or abort handling.`
      */
    ["com.affine.ui.the-sanitized-prepare-error-category-points-to-network-endpoint-timeout-or-abort-handling"](): string;
    /**
      * `Preferred privacy`
      */
    ["com.affine.ui.preferred-privacy"](): string;
    /**
      * `Update User`
      */
    ["com.affine.admin.update-user"](): string;
    /**
      * `Not delivered`
      */
    ["com.affine.admin.not-delivered"](): string;
    /**
      * `Slide image`
      */
    ["com.affine.office.slide-image"](): string;
    /**
      * `The provider privacy class is not allowed by route policy.`
      */
    ["com.affine.ui.the-provider-privacy-class-is-not-allowed-by-route-policy"](): string;
    /**
      * `Annotation comment`
      */
    ["com.affine.office.annotation-comment"](): string;
    /**
      * `Rows per page`
      */
    ["com.affine.admin.rows-per-page"](): string;
    /**
      * `Cannot insert in read-only mode`
      */
    ["com.affine.ui.cannot-insert-in-read-only-mode"](): string;
    /**
      * `Agent runtime step status gaps none`
      */
    ["com.affine.admin.agent-runtime-step-status-gaps-none"](): string;
    /**
      * `Configure prompt model defaults, prompt-specific overrides, embedding, workspace indexing, and rerank aliases.`
      */
    ["com.affine.admin.configure-prompt-model-defaults-prompt-specific-overrides-embedding-workspace-indexing-and-rerank-al"](): string;
    /**
      * `Agent runtime runs`
      */
    ["com.affine.admin.agent-runtime-runs"](): string;
    /**
      * `BYOK route selection, provider priority, model binding, and disabled legacy platform branches.`
      */
    ["com.affine.ui.byok-route-selection-provider-priority-model-binding-and-disabled-legacy-platform-branches"](): string;
    /**
      * `Rotate page clockwise`
      */
    ["com.affine.office.rotate-page-clockwise"](): string;
    /**
      * `The route policy explicitly blocks this provider.`
      */
    ["com.affine.ui.the-route-policy-explicitly-blocks-this-provider"](): string;
    /**
      * `Linear equation`
      */
    ["com.affine.office.linear-equation"](): string;
    /**
      * `Unexpected error occurred, please try again.`
      */
    ["com.affine.ui.unexpected-error-occurred-please-try-again"](): string;
    /**
      * `Switch Chat? Current chat is pinned`
      */
    ["com.affine.ui.switch-chat-current-chat-is-pinned"](): string;
    /**
      * `Parsing...`
      */
    ["com.affine.admin.parsing"](): string;
    /**
      * `pagination`
      */
    ["com.affine.admin.pagination"](): string;
    /**
      * `Highlight`
      */
    ["com.affine.office.annotation-type.Highlight"](): string;
    /**
      * `go back`
      */
    ["com.affine.ui.go-back"](): string;
    /**
      * `Generate headings`
      */
    ["com.affine.ai.action-label.generate-headings"](): string;
    /**
      * `Export PDF`
      */
    ["com.affine.office.export-pdf"](): string;
    /**
      * `Go to Tag List`
      */
    ["com.affine.ui.go-to-tag-list"](): string;
    /**
      * `Improve writing`
      */
    ["com.affine.ai.action-label.improve-writing"](): string;
    /**
      * `Permanent redaction`
      */
    ["com.affine.office.permanent-redaction"](): string;
    /**
      * `No Workspace AI credentials configured.`
      */
    ["com.affine.admin.no-workspace-ai-credentials-configured"](): string;
    /**
      * `Provider prepare error`
      */
    ["com.affine.ui.provider-prepare-error"](): string;
    /**
      * `Allow AI features in this workspace`
      */
    ["com.affine.admin.allow-ai-features-in-this-workspace"](): string;
    /**
      * `Requested model`
      */
    ["com.affine.admin.requested-model"](): string;
    /**
      * `AI is generating content. Do you want to stop generating?`
      */
    ["com.affine.ui.ai-is-generating-content-do-you-want-to-stop-generating"](): string;
    /**
      * `Successfully disabled`
      */
    ["com.affine.ui.successfully-disabled"](): string;
    /**
      * `This key can be deleted after its verification window ends.`
      */
    ["com.affine.admin.this-key-can-be-deleted-after-its-verification-window-ends"](): string;
    /**
      * `Top {{count}} links in the last {{days}} days`
      */
    ["com.affine.admin.top-links-window"](options: Readonly<{
        count: string;
        days: string;
    }>): string;
    /**
      * `No dimension evidence`
      */
    ["com.affine.admin.no-dimension-evidence"](): string;
    /**
      * `Account updated, but AI Profile assignment failed: `
      */
    ["com.affine.admin.account-updated-but-ai-profile-assignment-failed"](): string;
    /**
      * `Embedding disabled`
      */
    ["com.affine.admin.embedding-disabled"](): string;
    /**
      * `Upload your CSV file or drag it here`
      */
    ["com.affine.admin.upload-your-csv-file-or-drag-it-here"](): string;
    /**
      * `Drop to attach`
      */
    ["com.affine.ai.action-label.drop-to-attach"](): string;
    /**
      * `tracked change(s)`
      */
    ["com.affine.office.tracked-change-s"](): string;
    /**
      * `Enable Cloud`
      */
    ["com.affine.ui.enable-cloud"](): string;
    /**
      * `Header and footer`
      */
    ["com.affine.office.header-and-footer"](): string;
    /**
      * `Paragraph {{name}}, {{start}}–{{end}}`
      */
    ["com.affine.office.paragraph-range"](options: Readonly<{
        name: string;
        start: string;
        end: string;
    }>): string;
    /**
      * `Recover`
      */
    ["com.affine.ui.recover"](): string;
    /**
      * `{{days}} days, grouped by day`
      */
    ["com.affine.admin.storage-window"](options: {
        readonly days: string;
    }): string;
    /**
      * `Global policy`
      */
    ["com.affine.admin.global-policy"](): string;
    /**
      * `Attachment not supported`
      */
    ["com.affine.ui.attachment-not-supported"](): string;
    /**
      * `Failed to copy reset password link: `
      */
    ["com.affine.admin.failed-to-copy-reset-password-link"](): string;
    /**
      * `German`
      */
    ["com.affine.ai.action-label.german"](): string;
    /**
      * `copilot.storage: provider, bucket, and storage provider config used by copilot artifacts.`
      */
    ["com.affine.admin.copilot-storage-provider-bucket-and-storage-provider-config-used-by-copilot-artifacts"](): string;
    /**
      * `Workspace AI credential scope`
      */
    ["com.affine.admin.workspace-ai-credential-scope"](): string;
    /**
      * `No license file selected.`
      */
    ["com.affine.admin.no-license-file-selected"](): string;
    /**
      * `No step fallback order`
      */
    ["com.affine.admin.no-step-fallback-order"](): string;
    /**
      * `Copy to clipboard`
      */
    ["com.affine.ui.copy-to-clipboard"](): string;
    /**
      * `Rerank model alias`
      */
    ["com.affine.admin.rerank-model-alias"](): string;
    /**
      * `No step route counts`
      */
    ["com.affine.admin.no-step-route-counts"](): string;
    /**
      * `No step backend pairs`
      */
    ["com.affine.admin.no-step-backend-pairs"](): string;
    /**
      * `Stale reasons none`
      */
    ["com.affine.admin.stale-reasons-none"](): string;
    /**
      * `Circle`
      */
    ["com.affine.office.annotation-type.circle"](): string;
    /**
      * `Worksheet order`
      */
    ["com.affine.office.worksheet-order"](): string;
    /**
      * `Bar`
      */
    ["com.affine.office.bar"](): string;
    /**
      * `Enable Enterprise CLI`
      */
    ["com.affine.admin.enable-enterprise-cli"](): string;
    /**
      * `BYOK allowed providers`
      */
    ["com.affine.admin.byok-allowed-providers"](): string;
    /**
      * `Fix grammar`
      */
    ["com.affine.ai.action-label.fix-grammar"](): string;
    /**
      * `Activity`
      */
    ["com.affine.admin.activity"](): string;
    /**
      * `Comma-separated provider ids available for per-workspace BYOK routing.`
      */
    ["com.affine.admin.comma-separated-provider-ids-available-for-per-workspace-byok-routing"](): string;
    /**
      * `No prepared kinds`
      */
    ["com.affine.admin.no-prepared-kinds"](): string;
    /**
      * `Workspace metadata`
      */
    ["com.affine.admin.workspace-metadata"](): string;
    /**
      * `The sanitized prepare error category points to credentials or authorization.`
      */
    ["com.affine.ui.the-sanitized-prepare-error-category-points-to-credentials-or-authorization"](): string;
    /**
      * `Remove background`
      */
    ["com.affine.ai.action-label.remove-background"](): string;
    /**
      * `Copy manifest JSON`
      */
    ["com.affine.admin.copy-manifest-json"](): string;
    /**
      * `Download account information`
      */
    ["com.affine.admin.download-account-information"](): string;
    /**
      * `Checking request gate`
      */
    ["com.affine.admin.checking-request-gate"](): string;
    /**
      * `The provider runtime is unavailable for this candidate.`
      */
    ["com.affine.ui.the-provider-runtime-is-unavailable-for-this-candidate"](): string;
    /**
      * `Agent runtime unsupported step types none`
      */
    ["com.affine.admin.agent-runtime-unsupported-step-types-none"](): string;
    /**
      * `Open the doc you just created`
      */
    ["com.affine.ui.open-the-doc-you-just-created"](): string;
    /**
      * `copilot.supportBundles.objectStorageWebhooks: HMAC webhook definitions for support bundle direct-download notifications.`
      */
    ["com.affine.admin.copilot-supportbundles-objectstoragewebhooks-hmac-webhook-definitions-for-support-bundle-direct-down"](): string;
    /**
      * `Support bundle forwarding status`
      */
    ["com.affine.admin.support-bundle-forwarding-status"](): string;
    /**
      * `No configurable features.`
      */
    ["com.affine.admin.no-configurable-features"](): string;
    /**
      * `No comments yet.`
      */
    ["com.affine.office.no-comments-yet"](): string;
    /**
      * `Save profile`
      */
    ["com.affine.admin.save-profile"](): string;
    /**
      * `Not configured`
      */
    ["com.affine.admin.not-configured"](): string;
    /**
      * `Retry execution`
      */
    ["com.affine.admin.retry-execution"](): string;
    /**
      * `Page rotation`
      */
    ["com.affine.office.page-rotation"](): string;
    /**
      * `Could not update Project BYOK.`
      */
    ["com.affine.admin.could-not-update-project-byok"](): string;
    /**
      * `Right margin`
      */
    ["com.affine.office.right-margin"](): string;
    /**
      * `Prompt search`
      */
    ["com.affine.admin.prompt-search"](): string;
    /**
      * `Line`
      */
    ["com.affine.office.line"](): string;
    /**
      * `Page setup`
      */
    ["com.affine.office.page-setup"](): string;
    /**
      * `Provider defaults`
      */
    ["com.affine.admin.provider-defaults"](): string;
    /**
      * `Enable Account`
      */
    ["com.affine.admin.enable-account"](): string;
    /**
      * `Saved`
      */
    ["com.affine.admin.saved"](): string;
    /**
      * `Failed to save workspace AI credential.`
      */
    ["com.affine.admin.failed-to-save-workspace-ai-credential"](): string;
    /**
      * `Table {{name}}`
      */
    ["com.affine.office.table-name"](options: {
        readonly name: string;
    }): string;
    /**
      * `Add chat`
      */
    ["com.affine.ai.action-label.add-chat"](): string;
    /**
      * `No shared links.`
      */
    ["com.affine.admin.no-shared-links"](): string;
    /**
      * `Exa web search key`
      */
    ["com.affine.admin.exa-web-search-key"](): string;
    /**
      * `Views`
      */
    ["com.affine.admin.views"](): string;
    /**
      * `Global`
      */
    ["com.affine.admin.global"](): string;
    /**
      * `Search Docs, Collections`
      */
    ["com.affine.ui.search-docs-collections"](): string;
    /**
      * `Retention`
      */
    ["com.affine.admin.retention"](): string;
    /**
      * `Move slide down`
      */
    ["com.affine.office.move-slide-down"](): string;
    /**
      * `Validation list values`
      */
    ["com.affine.office.validation-list-values"](): string;
    /**
      * `Office change`
      */
    ["com.affine.office.office-change"](): string;
    /**
      * `Limit indexing and other compute-intensive tasks on this device, may experience longer loading time and latency in search and other features, in exchange for quietness.`
      */
    ["com.affine.ui.limit-indexing-and-other-compute-intensive-tasks-on-this-device-may-experience-longer-loading-time-a"](): string;
    /**
      * `Failed to open license file picker.`
      */
    ["com.affine.admin.failed-to-open-license-file-picker"](): string;
    /**
      * `Create Administrator Account`
      */
    ["com.affine.admin.create-administrator-account"](): string;
    /**
      * `This email is not available for sign in.`
      */
    ["com.affine.ui.this-email-is-not-available-for-sign-in"](): string;
    /**
      * `Check request gate`
      */
    ["com.affine.admin.check-request-gate"](): string;
    /**
      * `No route backends`
      */
    ["com.affine.admin.no-route-backends"](): string;
    /**
      * `No requested target pairs`
      */
    ["com.affine.admin.no-requested-target-pairs"](): string;
    /**
      * `Selected cell range`
      */
    ["com.affine.office.selected-cell-range"](): string;
    /**
      * `Copied markdown to clipboard`
      */
    ["com.affine.ui.copied-markdown-to-clipboard"](): string;
    /**
      * `Justify`
      */
    ["com.affine.office.justify"](): string;
    /**
      * `Definition`
      */
    ["com.affine.admin.definition"](): string;
    /**
      * `Circle`
      */
    ["com.affine.office.annotation-type.Circle"](): string;
    /**
      * `Policy candidate`
      */
    ["com.affine.admin.policy-candidate"](): string;
    /**
      * `Free text`
      */
    ["com.affine.office.annotation-type.freeText"](): string;
    /**
      * `Provider not allowed`
      */
    ["com.affine.ui.provider-not-allowed"](): string;
    /**
      * `Strikeout`
      */
    ["com.affine.office.annotation-type.strikeout"](): string;
    /**
      * `Update user avatar failed`
      */
    ["com.affine.ui.update-user-avatar-failed"](): string;
    /**
      * `Delete signing key?`
      */
    ["com.affine.admin.delete-signing-key"](): string;
    /**
      * `Next slide`
      */
    ["com.affine.admin.next-slide"](): string;
    /**
      * `Unknown`
      */
    ["com.affine.ui.unknown"](): string;
    /**
      * `Annotations`
      */
    ["com.affine.office.annotations"](): string;
    /**
      * `Generate presentation`
      */
    ["com.affine.ai.action-label.generate-presentation"](): string;
    /**
      * `Show the View analytics tab in the right sidebar.`
      */
    ["com.affine.ui.show-the-view-analytics-tab-in-the-right-sidebar"](): string;
    /**
      * `No results found.`
      */
    ["com.affine.ui.no-results-found"](): string;
    /**
      * `Open sidebar`
      */
    ["com.affine.ui.open-sidebar"](): string;
    /**
      * `Edit credential`
      */
    ["com.affine.admin.edit-credential"](): string;
    /**
      * `Shape properties`
      */
    ["com.affine.office.shape-properties"](): string;
    /**
      * `Allowed values, comma separated`
      */
    ["com.affine.office.allowed-values-comma-separated"](): string;
    /**
      * `No recent action runs returned for this workspace.`
      */
    ["com.affine.admin.no-recent-action-runs-returned-for-this-workspace"](): string;
    /**
      * `Test`
      */
    ["com.affine.admin.test"](): string;
    /**
      * `Go to next page`
      */
    ["com.affine.admin.go-to-next-page"](): string;
    /**
      * `Agent Runtime run filter`
      */
    ["com.affine.admin.agent-runtime-run-filter"](): string;
    /**
      * `Continue in AI Chat`
      */
    ["com.affine.ai.action-label.continue-in-ai-chat"](): string;
    /**
      * `Create as a linked doc`
      */
    ["com.affine.ui.create-as-a-linked-doc"](): string;
    /**
      * `Enter email address`
      */
    ["com.affine.admin.enter-email-address"](): string;
    /**
      * `Right Panel`
      */
    ["com.affine.admin.right-panel"](): string;
    /**
      * `Delete {{name}} chart`
      */
    ["com.affine.office.delete-named-chart"](options: {
        readonly name: string;
    }): string;
    /**
      * `Processing...`
      */
    ["com.affine.admin.processing"](): string;
    /**
      * `Professional`
      */
    ["com.affine.ai.action-label.professional"](): string;
    /**
      * `Top margin`
      */
    ["com.affine.office.top-margin"](): string;
    /**
      * `Slide duplication`
      */
    ["com.affine.office.slide-duplication"](): string;
    /**
      * `Capability not declared`
      */
    ["com.affine.ui.capability-not-declared"](): string;
    /**
      * `Data tools`
      */
    ["com.affine.office.data-tools"](): string;
    /**
      * `Could not load the latest settings. Reload before saving.`
      */
    ["com.affine.admin.could-not-load-the-latest-settings-reload-before-saving"](): string;
    /**
      * `Alt text`
      */
    ["com.affine.office.alt-text"](): string;
    /**
      * `Test email sent`
      */
    ["com.affine.admin.test-email-sent"](): string;
    /**
      * `Save notes`
      */
    ["com.affine.office.save-notes"](): string;
    /**
      * `This document changed in another session. Reload the latest revision and try again.`
      */
    ["com.affine.office.this-document-changed-in-another-session-reload-the-latest-revision-and-try-again"](): string;
    /**
      * `Download archive`
      */
    ["com.affine.admin.download-archive"](): string;
    /**
      * `favorite`
      */
    ["com.affine.ui.favorite"](): string;
    /**
      * `Recent action runs`
      */
    ["com.affine.admin.recent-action-runs"](): string;
    /**
      * `Office editor is not writable`
      */
    ["com.affine.office.office-editor-is-not-writable"](): string;
    /**
      * `Sheet {{name}}`
      */
    ["com.affine.office.sheet-name"](options: {
        readonly name: string;
    }): string;
    /**
      * `Open Office file`
      */
    ["com.affine.ui.open-office-file"](): string;
    /**
      * `Searching...`
      */
    ["com.affine.admin.searching"](): string;
    /**
      * `Rendering PDF page…`
      */
    ["com.affine.office.rendering-pdf-page"](): string;
    /**
      * `Informal`
      */
    ["com.affine.ai.action-label.informal"](): string;
    /**
      * `Text note`
      */
    ["com.affine.office.annotation-type.Text"](): string;
    /**
      * `{{count}} user detected in the CSV file. Confirm the list below to import.`
      */
    ["com.affine.admin.import-preview-count_one"](options: {
        readonly count: (string | number | bigint) & (string | number | bigint);
    }): string;
    /**
      * `Global Project BYOK saved.`
      */
    ["com.affine.admin.global-project-byok-saved"](): string;
    /**
      * `No route order`
      */
    ["com.affine.admin.no-route-order"](): string;
    /**
      * `Errors`
      */
    ["com.affine.admin.errors"](): string;
    /**
      * `Failed to load Workspace AI credential scopes.`
      */
    ["com.affine.admin.failed-to-load-workspace-ai-credential-scopes"](): string;
    /**
      * `No shared links in this window`
      */
    ["com.affine.admin.no-shared-links-in-this-window"](): string;
    /**
      * `Square`
      */
    ["com.affine.office.annotation-type.square"](): string;
    /**
      * `Optional shape text`
      */
    ["com.affine.office.optional-shape-text"](): string;
    /**
      * `Failed to update user name.`
      */
    ["com.affine.ui.failed-to-update-user-name"](): string;
    /**
      * `Critical`
      */
    ["com.affine.ai.action-label.critical"](): string;
    /**
      * `Model capability metadata, embedding dimensions, aliases, and output/input support.`
      */
    ["com.affine.ui.model-capability-metadata-embedding-dimensions-aliases-and-output-input-support"](): string;
    /**
      * `Agent runtime target step statuses none`
      */
    ["com.affine.admin.agent-runtime-target-step-statuses-none"](): string;
    /**
      * `{{count}} tracked changes`
      */
    ["com.affine.office.tracked-change-count_other"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Generate outline`
      */
    ["com.affine.ai.action-label.generate-outline"](): string;
    /**
      * `Valid`
      */
    ["com.affine.admin.valid"](): string;
    /**
      * `Model source`
      */
    ["com.affine.admin.model-source"](): string;
    /**
      * `Preview license`
      */
    ["com.affine.admin.preview-license"](): string;
    /**
      * `Select prompt`
      */
    ["com.affine.admin.select-prompt"](): string;
    /**
      * `Nothing here yet`
      */
    ["com.affine.ui.nothing-here-yet"](): string;
    /**
      * `Reset password link copied to clipboard`
      */
    ["com.affine.admin.reset-password-link-copied-to-clipboard"](): string;
    /**
      * `Enterprise CLI governance`
      */
    ["com.affine.admin.enterprise-cli-governance"](): string;
    /**
      * `Candidate models`
      */
    ["com.affine.admin.candidate-models"](): string;
    /**
      * `Footer`
      */
    ["com.affine.office.footer"](): string;
    /**
      * `Wait for the current save to finish before editing another paragraph.`
      */
    ["com.affine.office.wait-for-the-current-save-to-finish-before-editing-another-paragraph"](): string;
    /**
      * `Translate to`
      */
    ["com.affine.ai.action-label.translate-to"](): string;
    /**
      * `Blocking`
      */
    ["com.affine.admin.blocking"](): string;
    /**
      * `Rendered PDF page {{number}}`
      */
    ["com.affine.office.rendered-pdf-page"](options: {
        readonly number: string;
    }): string;
    /**
      * `Delete reply`
      */
    ["com.affine.office.delete-reply"](): string;
    /**
      * `Spanish`
      */
    ["com.affine.ai.action-label.spanish"](): string;
    /**
      * `Use this credential in routing`
      */
    ["com.affine.admin.use-this-credential-in-routing"](): string;
    /**
      * `Slide order`
      */
    ["com.affine.office.slide-order"](): string;
    /**
      * `An older diagnostic identified a platform route that is disabled under BYOK-only execution.`
      */
    ["com.affine.ui.an-older-diagnostic-identified-a-platform-route-that-is-disabled-under-byok-only-execution"](): string;
    /**
      * `Current Sync Active Users`
      */
    ["com.affine.admin.current-sync-active-users"](): string;
    /**
      * `Pie`
      */
    ["com.affine.office.pie"](): string;
    /**
      * `Header`
      */
    ["com.affine.office.header"](): string;
    /**
      * `For displaying additional information`
      */
    ["com.affine.admin.for-displaying-additional-information"](): string;
    /**
      * `Rounded rectangle`
      */
    ["com.affine.office.rounded-rectangle"](): string;
    /**
      * `Copied to clipboard`
      */
    ["com.affine.ui.copied-to-clipboard"](): string;
    /**
      * `No persisted repair execution requests have been created for this workspace.`
      */
    ["com.affine.admin.no-persisted-repair-execution-requests-have-been-created-for-this-workspace"](): string;
    /**
      * `Shape insertion`
      */
    ["com.affine.office.shape-insertion"](): string;
    /**
      * `Configure your self-hosted LocalMind with a few simple settings.`
      */
    ["com.affine.admin.configure-your-self-hosted-localmind-with-a-few-simple-settings"](): string;
    /**
      * `Blob Count`
      */
    ["com.affine.admin.blob-count-2"](): string;
    /**
      * `Copy link to block`
      */
    ["com.affine.ui.copy-link-to-block"](): string;
    /**
      * `Fill`
      */
    ["com.affine.office.fill"](): string;
    /**
      * `Unmerge cells`
      */
    ["com.affine.office.unmerge-cells"](): string;
    /**
      * `Chart category range`
      */
    ["com.affine.office.chart-category-range"](): string;
    /**
      * `Signature and payload format are valid.`
      */
    ["com.affine.admin.signature-and-payload-format-are-valid"](): string;
    /**
      * `Shape text`
      */
    ["com.affine.office.shape-text"](): string;
    /**
      * `Inserted to current doc`
      */
    ["com.affine.ui.inserted-to-current-doc"](): string;
    /**
      * `Make it longer`
      */
    ["com.affine.ai.action-label.make-it-longer"](): string;
    /**
      * `Prompt catalog`
      */
    ["com.affine.admin.prompt-catalog"](): string;
    /**
      * `Add slide`
      */
    ["com.affine.office.add-slide"](): string;
    /**
      * `Phase`
      */
    ["com.affine.admin.phase"](): string;
    /**
      * `Workspace Created`
      */
    ["com.affine.ui.workspace-created"](): string;
    /**
      * `No AI Profiles configured. Existing enabled credentials remain the compatibility fallback.`
      */
    ["com.affine.admin.no-ai-profiles-configured-existing-enabled-credentials-remain-the-compatibility-fallback"](): string;
    /**
      * `Workspace AI credentials`
      */
    ["com.affine.admin.workspace-ai-credentials"](): string;
    /**
      * `Preview ready: {{paragraphs}} paragraph(s), {{runs}} run(s)`
      */
    ["com.affine.office.preview-summary"](options: Readonly<{
        paragraphs: string;
        runs: string;
    }>): string;
    /**
      * `Document formatting`
      */
    ["com.affine.office.document-formatting"](): string;
    /**
      * `Failed to create account: `
      */
    ["com.affine.admin.failed-to-create-account"](): string;
    /**
      * `Latest retention cleanup`
      */
    ["com.affine.admin.latest-retention-cleanup"](): string;
    /**
      * `Switching will unpinned the current chat. This will change the active chat panel, allowing you to navigate between different conversation histories.`
      */
    ["com.affine.ui.switching-will-unpinned-the-current-chat-this-will-change-the-active-chat-panel-allowing-you-to-navi"](): string;
    /**
      * `Signing key rotated`
      */
    ["com.affine.admin.signing-key-rotated"](): string;
    /**
      * `Allow public access to workspace pages`
      */
    ["com.affine.admin.allow-public-access-to-workspace-pages"](): string;
    /**
      * `Run {{number}} in {{name}}`
      */
    ["com.affine.office.run-number"](options: Readonly<{
        number: string;
        name: string;
    }>): string;
    /**
      * `Set validation`
      */
    ["com.affine.office.set-validation"](): string;
    /**
      * `Compatibility quota evidence; runtime provider execution is BYOK-only and does not enforce platform quota.`
      */
    ["com.affine.ui.compatibility-quota-evidence-runtime-provider-execution-is-byok-only-and-does-not-enforce-platform-q"](): string;
    /**
      * `Repair recommendations 0`
      */
    ["com.affine.admin.repair-recommendations-0"](): string;
    /**
      * `Comment`
      */
    ["com.affine.office.comment"](): string;
    /**
      * `Cell address was reset to A1.`
      */
    ["com.affine.office.cell-address-was-reset-to-a1"](): string;
    /**
      * `Page {{number}}`
      */
    ["com.affine.office.page-number"](options: {
        readonly number: string;
    }): string;
    /**
      * `Inserted`
      */
    ["com.affine.ai.action-label.inserted"](): string;
    /**
      * `Detail`
      */
    ["com.affine.admin.detail"](): string;
    /**
      * `Failed to read redacted page`
      */
    ["com.affine.office.failed-to-read-redacted-page"](): string;
    /**
      * `Generate an image`
      */
    ["com.affine.ai.action-label.generate-an-image"](): string;
    /**
      * `Catalog category`
      */
    ["com.affine.admin.catalog-category"](): string;
    /**
      * `Provider default`
      */
    ["com.affine.admin.provider-default"](): string;
    /**
      * `Prompt defaults JSON`
      */
    ["com.affine.admin.prompt-defaults-json"](): string;
    /**
      * `Page order`
      */
    ["com.affine.office.page-order"](): string;
    /**
      * `Dimensions`
      */
    ["com.affine.admin.dimensions"](): string;
    /**
      * `The server returned an unsupported DOCX state`
      */
    ["com.affine.office.the-server-returned-an-unsupported-docx-state"](): string;
    /**
      * `The prepared native route resolved a model alias or raw model.`
      */
    ["com.affine.ui.the-prepared-native-route-resolved-a-model-alias-or-raw-model"](): string;
    /**
      * `Star LocalMind on GitHub`
      */
    ["com.affine.admin.star-localmind-on-github"](): string;
    /**
      * `Opening native document…`
      */
    ["com.affine.office.opening-native-document"](): string;
    /**
      * `Embedding enabled`
      */
    ["com.affine.admin.embedding-enabled"](): string;
    /**
      * `No prepared steps`
      */
    ["com.affine.admin.no-prepared-steps"](): string;
    /**
      * `cancellation`
      */
    ["com.affine.office.task-action.cancel"](): string;
    /**
      * `Registry source`
      */
    ["com.affine.admin.registry-source"](): string;
    /**
      * `Cell value or formula`
      */
    ["com.affine.office.cell-value-or-formula"](): string;
    /**
      * `No support bundle requests have been created for this workspace.`
      */
    ["com.affine.admin.no-support-bundle-requests-have-been-created-for-this-workspace"](): string;
    /**
      * `review code`
      */
    ["com.affine.ai.action-label.review-code"](): string;
    /**
      * `Gateway Timeout`
      */
    ["com.affine.ui.gateway-timeout"](): string;
    /**
      * `Redirecting to sign in...`
      */
    ["com.affine.ui.redirecting-to-sign-in"](): string;
    /**
      * `Apply format`
      */
    ["com.affine.office.apply-format"](): string;
    /**
      * `Provider blocked`
      */
    ["com.affine.ui.provider-blocked"](): string;
    /**
      * `Section {{number}}`
      */
    ["com.affine.office.section-number"](options: {
        readonly number: string;
    }): string;
    /**
      * `Fit to screen`
      */
    ["com.affine.ui.fit-to-screen"](): string;
    /**
      * `Native DOCX import requires a .docx file`
      */
    ["com.affine.office.native-docx-import-requires-a-docx-file"](): string;
    /**
      * `Issue`
      */
    ["com.affine.admin.issue"](): string;
    /**
      * `Input value to override`
      */
    ["com.affine.ui.input-value-to-override"](): string;
    /**
      * `Annotation deletion`
      */
    ["com.affine.office.annotation-deletion"](): string;
    /**
      * `Please upload a CSV file`
      */
    ["com.affine.admin.please-upload-a-csv-file"](): string;
    /**
      * `Admin`
      */
    ["com.affine.admin.admin"](): string;
    /**
      * `Latest transfer forwarding replay`
      */
    ["com.affine.admin.latest-transfer-forwarding-replay"](): string;
    /**
      * `This Office file changed in another session. Reload the latest revision and retry.`
      */
    ["com.affine.office.this-office-file-changed-in-another-session-reload-the-latest-revision-and-retry"](): string;
    /**
      * `Configure provider profiles, output defaults, route policy, and Vertex provider credentials.`
      */
    ["com.affine.admin.configure-provider-profiles-output-defaults-route-policy-and-vertex-provider-credentials"](): string;
    /**
      * `Signature reason`
      */
    ["com.affine.office.signature-reason"](): string;
    /**
      * `Target`
      */
    ["com.affine.admin.target"](): string;
    /**
      * `Experimental`
      */
    ["com.affine.ui.experimental"](): string;
    /**
      * `Embedding model alias`
      */
    ["com.affine.admin.embedding-model-alias"](): string;
    /**
      * `Project AI enabled`
      */
    ["com.affine.admin.project-ai-enabled"](): string;
    /**
      * `Page Not Found (TODO)`
      */
    ["com.affine.ui.page-not-found-todo"](): string;
    /**
      * `Orientation`
      */
    ["com.affine.office.orientation"](): string;
    /**
      * `Move slide up`
      */
    ["com.affine.office.move-slide-up"](): string;
    /**
      * `Agent runtime projection gaps none`
      */
    ["com.affine.admin.agent-runtime-projection-gaps-none"](): string;
    /**
      * `The saved state does not match this artifact type.`
      */
    ["com.affine.office.the-saved-state-does-not-match-this-artifact-type"](): string;
    /**
      * `Failed to sign in`
      */
    ["com.affine.ui.failed-to-sign-in"](): string;
    /**
      * `Provider registry and routing`
      */
    ["com.affine.admin.provider-registry-and-routing"](): string;
    /**
      * `Footer position`
      */
    ["com.affine.office.footer-position"](): string;
    /**
      * `Auto provider default`
      */
    ["com.affine.admin.auto-provider-default"](): string;
    /**
      * `Target fingerprint`
      */
    ["com.affine.admin.target-fingerprint"](): string;
    /**
      * `Office AI context`
      */
    ["com.affine.office.office-ai-context"](): string;
    /**
      * `v{{before}} to v{{after}}`
      */
    ["com.affine.office.compare-versions"](options: Readonly<{
        before: string;
        after: string;
    }>): string;
    /**
      * `Prompt category`
      */
    ["com.affine.admin.prompt-category"](): string;
    /**
      * `Settings have been saved successfully.`
      */
    ["com.affine.admin.settings-have-been-saved-successfully"](): string;
    /**
      * `Capabilities`
      */
    ["com.affine.admin.capabilities"](): string;
    /**
      * `License Preview`
      */
    ["com.affine.admin.license-preview"](): string;
    /**
      * `Flags`
      */
    ["com.affine.admin.flags"](): string;
    /**
      * `Repair executions`
      */
    ["com.affine.admin.repair-executions"](): string;
    /**
      * `Add another`
      */
    ["com.affine.admin.add-another"](): string;
    /**
      * `Provider runtime logs`
      */
    ["com.affine.ui.provider-runtime-logs"](): string;
    /**
      * `Public pages`
      */
    ["com.affine.admin.public-pages"](): string;
    /**
      * `generate from text`
      */
    ["com.affine.ai.action-label.generate-from-text"](): string;
    /**
      * `No prepared targets`
      */
    ["com.affine.admin.no-prepared-targets"](): string;
    /**
      * `Rows and columns`
      */
    ["com.affine.office.rows-and-columns"](): string;
    /**
      * `File Expires At`
      */
    ["com.affine.admin.file-expires-at"](): string;
    /**
      * `Are you sure you want to clear all history? This action will permanently delete all content, including all chat logs and data, and cannot be undone.`
      */
    ["com.affine.ui.are-you-sure-you-want-to-clear-all-history-this-action-will-permanently-delete-all-content-including"](): string;
    /**
      * `Registry record`
      */
    ["com.affine.admin.registry-record"](): string;
    /**
      * `{{count}} users detected in the CSV file. Confirm the list below to import.`
      */
    ["com.affine.admin.import-preview-count_other"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Confirm import`
      */
    ["com.affine.admin.confirm-import-2"](): string;
    /**
      * `History cleared`
      */
    ["com.affine.ui.history-cleared"](): string;
    /**
      * `Workspace updated successfully`
      */
    ["com.affine.admin.workspace-updated-successfully"](): string;
    /**
      * `Candidate`
      */
    ["com.affine.admin.candidate"](): string;
    /**
      * `Default provider endpoint`
      */
    ["com.affine.admin.default-provider-endpoint"](): string;
    /**
      * `Make it shorter`
      */
    ["com.affine.ai.action-label.make-it-shorter"](): string;
    /**
      * `Catalog results:`
      */
    ["com.affine.admin.catalog-results"](): string;
    /**
      * `breadcrumb`
      */
    ["com.affine.admin.breadcrumb"](): string;
    /**
      * `Please select at least one field to export`
      */
    ["com.affine.admin.please-select-at-least-one-field-to-export"](): string;
    /**
      * `Capability match error`
      */
    ["com.affine.ui.capability-match-error"](): string;
    /**
      * `Fonts`
      */
    ["com.affine.ui.fonts"](): string;
    /**
      * `Duplicate slide`
      */
    ["com.affine.office.duplicate-slide"](): string;
    /**
      * `Redirecting...`
      */
    ["com.affine.ui.redirecting"](): string;
    /**
      * `Save failed`
      */
    ["com.affine.office.save-failed"](): string;
    /**
      * `Create new doc`
      */
    ["com.affine.ai.action-label.create-new-doc"](): string;
    /**
      * `Users copied successfully`
      */
    ["com.affine.admin.users-copied-successfully"](): string;
    /**
      * `Annotation update`
      */
    ["com.affine.office.annotation-update"](): string;
    /**
      * `annotations`
      */
    ["com.affine.office.annotations-2"](): string;
    /**
      * `Redaction failed`
      */
    ["com.affine.office.redaction-failed"](): string;
    /**
      * `You can switch between Page and Edgeless mode at any point while creating content.`
      */
    ["com.affine.ui.onboarding-mode-switch"](): string;
    /**
      * `OpenAI-compatible headers`
      */
    ["com.affine.admin.openai-compatible-headers"](): string;
    /**
      * `modified`
      */
    ["com.affine.office.modified"](): string;
    /**
      * `Loading persisted Agent Runtime runs.`
      */
    ["com.affine.admin.loading-persisted-agent-runtime-runs"](): string;
    /**
      * `BYOK custom endpoint`
      */
    ["com.affine.admin.byok-custom-endpoint"](): string;
    /**
      * `Agent runtime step kinds none`
      */
    ["com.affine.admin.agent-runtime-step-kinds-none"](): string;
    /**
      * `Signature appearance`
      */
    ["com.affine.office.signature-appearance"](): string;
    /**
      * `Version evidence`
      */
    ["com.affine.admin.version-evidence"](): string;
    /**
      * `Area`
      */
    ["com.affine.office.area"](): string;
    /**
      * `Saved revision has no document state`
      */
    ["com.affine.office.saved-revision-has-no-document-state"](): string;
    /**
      * `PDF page {{number}}, no annotations`
      */
    ["com.affine.office.pdf-page-label_zero"](options: {
        readonly number: string;
    }): string;
    /**
      * `Welcome to LocalMind`
      */
    ["com.affine.admin.welcome-to-localmind"](): string;
    /**
      * `Reply to {{name}}`
      */
    ["com.affine.office.reply-to"](options: {
        readonly name: string;
    }): string;
    /**
      * `Agent runtime projected step types none`
      */
    ["com.affine.admin.agent-runtime-projected-step-types-none"](): string;
    /**
      * `CSV template`
      */
    ["com.affine.admin.csv-template"](): string;
    /**
      * `Task route diagnostics`
      */
    ["com.affine.admin.task-route-diagnostics"](): string;
    /**
      * `Update workspace avatar failed`
      */
    ["com.affine.ui.update-workspace-avatar-failed"](): string;
    /**
      * `{{window}}, grouped by day in UTC`
      */
    ["com.affine.admin.mail-bucket-day"](options: {
        readonly window: string;
    }): string;
    /**
      * `Workspace AI enabled`
      */
    ["com.affine.admin.workspace-ai-enabled"](): string;
    /**
      * `Global route diagnostics`
      */
    ["com.affine.admin.global-route-diagnostics"](): string;
    /**
      * `Failed to download attachment`
      */
    ["com.affine.ui.failed-to-download-attachment"](): string;
    /**
      * `The provider model does not allow remote attachment URLs.`
      */
    ["com.affine.ui.the-provider-model-does-not-allow-remote-attachment-urls"](): string;
    /**
      * `Loading revisions…`
      */
    ["com.affine.office.loading-revisions"](): string;
    /**
      * `Add a comment`
      */
    ["com.affine.office.add-a-comment"](): string;
    /**
      * `Select text to format`
      */
    ["com.affine.office.select-text-to-format"](): string;
    /**
      * `Convert to sticker`
      */
    ["com.affine.ai.action-label.convert-to-sticker"](): string;
    /**
      * `Agent Runtime control error`
      */
    ["com.affine.admin.agent-runtime-control-error"](): string;
    /**
      * `Even page section`
      */
    ["com.affine.office.even-page-section"](): string;
    /**
      * `Failed to enable user: `
      */
    ["com.affine.admin.failed-to-enable-user"](): string;
    /**
      * `Registry row`
      */
    ["com.affine.admin.registry-row"](): string;
    /**
      * `AI capability switches`
      */
    ["com.affine.admin.ai-capability-switches"](): string;
    /**
      * `Credential routing available`
      */
    ["com.affine.admin.credential-routing-available"](): string;
    /**
      * `Sync Active Users Trend`
      */
    ["com.affine.admin.sync-active-users-trend"](): string;
    /**
      * `Continuous section`
      */
    ["com.affine.office.continuous-section"](): string;
    /**
      * `Color for {{type}} annotation`
      */
    ["com.affine.office.color-typed-annotation"](options: {
        readonly type: string;
    }): string;
    /**
      * `Paragraph alignment`
      */
    ["com.affine.office.paragraph-alignment"](): string;
    /**
      * `Last Accessed`
      */
    ["com.affine.admin.last-accessed"](): string;
    /**
      * `Select a workspace scope before inspecting an action run.`
      */
    ["com.affine.admin.select-a-workspace-scope-before-inspecting-an-action-run"](): string;
    /**
      * `Shape deletion`
      */
    ["com.affine.office.shape-deletion"](): string;
    /**
      * `Clear`
      */
    ["com.affine.office.clear"](): string;
    /**
      * `Comments and collaborators`
      */
    ["com.affine.office.comments-and-collaborators"](): string;
    /**
      * `Any`
      */
    ["com.affine.admin.any"](): string;
    /**
      * `The provider runtime prepare boundary returned no route.`
      */
    ["com.affine.ui.the-provider-runtime-prepare-boundary-returned-no-route"](): string;
    /**
      * `Engineering default`
      */
    ["com.affine.admin.engineering-default"](): string;
    /**
      * `Matched route candidates, prepare candidates, sanitized prepare errors, and prepared native routes.`
      */
    ["com.affine.ui.matched-route-candidates-prepare-candidates-sanitized-prepare-errors-and-prepared-native-routes"](): string;
    /**
      * `days`
      */
    ["com.affine.admin.days"](): string;
    /**
      * `Snapshot size`
      */
    ["com.affine.admin.snapshot-size"](): string;
    /**
      * `prepared route`
      */
    ["com.affine.admin.prepared-route"](): string;
    /**
      * `Explain this code`
      */
    ["com.affine.ai.action-label.explain-this-code"](): string;
    /**
      * `Runtime`
      */
    ["com.affine.admin.runtime"](): string;
    /**
      * `Model route diagnostics`
      */
    ["com.affine.admin.model-route-diagnostics"](): string;
    /**
      * `Failed to delete workspace AI credential.`
      */
    ["com.affine.admin.failed-to-delete-workspace-ai-credential"](): string;
    /**
      * `Candidate trace`
      */
    ["com.affine.admin.candidate-trace"](): string;
    /**
      * `No profile model match`
      */
    ["com.affine.ui.no-profile-model-match"](): string;
    /**
      * `form fields`
      */
    ["com.affine.office.form-fields-2"](): string;
    /**
      * `Slides accepts PNG, JPEG, or GIF images.`
      */
    ["com.affine.office.slides-accepts-png-jpeg-or-gif-images"](): string;
    /**
      * `Add to edgeless as note`
      */
    ["com.affine.ui.add-to-edgeless-as-note"](): string;
    /**
      * `Checkout...`
      */
    ["com.affine.ui.checkout"](): string;
    /**
      * `Delete chart`
      */
    ["com.affine.office.delete-chart"](): string;
    /**
      * `Unnamed`
      */
    ["com.affine.ui.unnamed"](): string;
    /**
      * `Unsupported reply content`
      */
    ["com.affine.office.unsupported-reply-content"](): string;
    /**
      * `Loading emojis...`
      */
    ["com.affine.ui.loading-emojis"](): string;
    /**
      * `Filter values`
      */
    ["com.affine.office.filter-values"](): string;
    /**
      * `The provider runtime prepare boundary threw a sanitized error.`
      */
    ["com.affine.ui.the-provider-runtime-prepare-boundary-threw-a-sanitized-error"](): string;
    /**
      * `Verifying...`
      */
    ["com.affine.admin.verifying"](): string;
    /**
      * `Insert document object`
      */
    ["com.affine.office.insert-document-object"](): string;
    /**
      * `Delete worksheet`
      */
    ["com.affine.office.delete-worksheet"](): string;
    /**
      * `Legacy quota diagnostics`
      */
    ["com.affine.ui.legacy-quota-diagnostics"](): string;
    /**
      * `Default model`
      */
    ["com.affine.admin.default-model"](): string;
    /**
      * `Release mouse to upload file`
      */
    ["com.affine.admin.release-mouse-to-upload-file"](): string;
    /**
      * `Copy and Close`
      */
    ["com.affine.admin.copy-and-close"](): string;
    /**
      * `copilot.providers.profiles: provider ids, privacy, priority, middleware, models, modelDefinitions, and provider-specific config.`
      */
    ["com.affine.admin.copilot-providers-profiles-provider-ids-privacy-priority-middleware-models-modeldefinitions-and-prov"](): string;
    /**
      * `Test the provider configuration before saving`
      */
    ["com.affine.admin.test-the-provider-configuration-before-saving"](): string;
    /**
      * `No features`
      */
    ["com.affine.admin.no-features"](): string;
    /**
      * `Invalid JSON format`
      */
    ["com.affine.admin.invalid-json-format"](): string;
    /**
      * `Publish pages and collect traffic, then this table will rank links by views.`
      */
    ["com.affine.admin.publish-pages-and-collect-traffic-then-this-table-will-rank-links-by-views"](): string;
    /**
      * `Enable DOM renderer for graphics elements`
      */
    ["com.affine.ui.enable-dom-renderer-for-graphics-elements"](): string;
    /**
      * `Test failed. Check the configuration or reload the latest settings.`
      */
    ["com.affine.admin.test-failed-check-the-configuration-or-reload-the-latest-settings"](): string;
    /**
      * `Canvas rendering is unavailable`
      */
    ["com.affine.office.canvas-rendering-is-unavailable"](): string;
    /**
      * `Workspace default`
      */
    ["com.affine.admin.workspace-default"](): string;
    /**
      * `Save as doc`
      */
    ["com.affine.ui.save-as-doc"](): string;
    /**
      * `Provider-level API credentials and endpoints used by server-side AI routing.`
      */
    ["com.affine.admin.provider-level-api-credentials-and-endpoints-used-by-server-side-ai-routing"](): string;
    /**
      * `Saved revision has an invalid document state`
      */
    ["com.affine.office.saved-revision-has-an-invalid-document-state"](): string;
    /**
      * `Accounts`
      */
    ["com.affine.admin.accounts"](): string;
    /**
      * `No route reason diagnostics returned.`
      */
    ["com.affine.admin.no-route-reason-diagnostics-returned"](): string;
    /**
      * `Italian`
      */
    ["com.affine.ai.action-label.italian"](): string;
    /**
      * `reason`
      */
    ["com.affine.admin.reason"](): string;
    /**
      * `Prepared route not selected`
      */
    ["com.affine.ui.prepared-route-not-selected"](): string;
    /**
      * `Endnote`
      */
    ["com.affine.office.endnote"](): string;
    /**
      * `Workspace AI Profile saved.`
      */
    ["com.affine.admin.workspace-ai-profile-saved"](): string;
    /**
      * `Profile model not allowed`
      */
    ["com.affine.ui.profile-model-not-allowed"](): string;
    /**
      * `No provider metadata`
      */
    ["com.affine.admin.no-provider-metadata"](): string;
    /**
      * `Gemini Vertex JSON`
      */
    ["com.affine.admin.gemini-vertex-json"](): string;
    /**
      * `API key`
      */
    ["com.affine.admin.api-key"](): string;
    /**
      * `Sanitized prepared route diagnostics for persisted action runs`
      */
    ["com.affine.admin.sanitized-prepared-route-diagnostics-for-persisted-action-runs"](): string;
    /**
      * `Delete page`
      */
    ["com.affine.office.delete-page"](): string;
    /**
      * `Offline`
      */
    ["com.affine.ui.offline"](): string;
    /**
      * `No step layer pairs`
      */
    ["com.affine.admin.no-step-layer-pairs"](): string;
    /**
      * `Failed to export users`
      */
    ["com.affine.admin.failed-to-export-users"](): string;
    /**
      * `Revision history`
      */
    ["com.affine.office.revision-history"](): string;
    /**
      * `CSV file contains no valid user data`
      */
    ["com.affine.admin.csv-file-contains-no-valid-user-data"](): string;
    /**
      * `Could not save Project BYOK.`
      */
    ["com.affine.admin.could-not-save-project-byok"](): string;
    /**
      * `Credential name`
      */
    ["com.affine.admin.credential-name"](): string;
    /**
      * `Failed to load Workspace AI credentials.`
      */
    ["com.affine.admin.failed-to-load-workspace-ai-credentials"](): string;
    /**
      * `The provider model does not support the requested attachment kind.`
      */
    ["com.affine.ui.the-provider-model-does-not-support-the-requested-attachment-kind"](): string;
    /**
      * `Table`
      */
    ["com.affine.office.table"](): string;
    /**
      * `Exporting...`
      */
    ["com.affine.admin.exporting"](): string;
    /**
      * `Align`
      */
    ["com.affine.office.align"](): string;
    /**
      * `Chart type`
      */
    ["com.affine.office.chart-type"](): string;
    /**
      * `formulas`
      */
    ["com.affine.office.formulas"](): string;
    /**
      * `Status`
      */
    ["com.affine.admin.status"](): string;
    /**
      * `Department usage or ownership notes`
      */
    ["com.affine.admin.department-usage-or-ownership-notes"](): string;
    /**
      * `No route protocols`
      */
    ["com.affine.admin.no-route-protocols"](): string;
    /**
      * `Enable URL Preview`
      */
    ["com.affine.admin.enable-url-preview-2"](): string;
    /**
      * `Bundle, authorization, forwarding event, source, or fingerprint`
      */
    ["com.affine.admin.bundle-authorization-forwarding-event-source-or-fingerprint"](): string;
    /**
      * `Enter an equation.`
      */
    ["com.affine.office.enter-an-equation"](): string;
    /**
      * `margin`
      */
    ["com.affine.office.margin"](): string;
    /**
      * `Stop generating`
      */
    ["com.affine.ui.stop-generating"](): string;
    /**
      * `Failed to parse CSV file`
      */
    ["com.affine.admin.failed-to-parse-csv-file"](): string;
    /**
      * `Server AI`
      */
    ["com.affine.admin.server-ai"](): string;
    /**
      * `Cleanup retention`
      */
    ["com.affine.admin.cleanup-retention"](): string;
    /**
      * `Headers JSON`
      */
    ["com.affine.admin.headers-json"](): string;
    /**
      * `Latest artifact download authorization`
      */
    ["com.affine.admin.latest-artifact-download-authorization"](): string;
    /**
      * `Failed to send test email`
      */
    ["com.affine.admin.failed-to-send-test-email"](): string;
    /**
      * `Agent runtime projected run statuses none`
      */
    ["com.affine.admin.agent-runtime-projected-run-statuses-none"](): string;
    /**
      * `Go to last page`
      */
    ["com.affine.admin.go-to-last-page"](): string;
    /**
      * `The provider model does not support the requested attachment source.`
      */
    ["com.affine.ui.the-provider-model-does-not-support-the-requested-attachment-source"](): string;
    /**
      * `Model route candidates`
      */
    ["com.affine.admin.model-route-candidates"](): string;
    /**
      * `Privacy not allowed`
      */
    ["com.affine.ui.privacy-not-allowed"](): string;
    /**
      * `Clearer`
      */
    ["com.affine.ai.action-label.clearer"](): string;
    /**
      * `No headings`
      */
    ["com.affine.office.no-headings"](): string;
    /**
      * `You are not an admin, please login the admin account.`
      */
    ["com.affine.admin.you-are-not-an-admin-please-login-the-admin-account"](): string;
    /**
      * `The expired signing key was removed.`
      */
    ["com.affine.admin.the-expired-signing-key-was-removed"](): string;
    /**
      * `Enable`
      */
    ["com.affine.admin.enable"](): string;
    /**
      * `Optional models`
      */
    ["com.affine.admin.optional-models"](): string;
    /**
      * `Compare`
      */
    ["com.affine.office.compare"](): string;
    /**
      * `No prepared providers`
      */
    ["com.affine.admin.no-prepared-providers"](): string;
    /**
      * `Not signed in`
      */
    ["com.affine.ui.not-signed-in"](): string;
    /**
      * `No revisions are available.`
      */
    ["com.affine.office.no-revisions-are-available"](): string;
    /**
      * `Failed ({{reason}})`
      */
    ["com.affine.admin.import-failed-reason"](options: {
        readonly reason: string;
    }): string;
    /**
      * `Agent runtime timeline items none`
      */
    ["com.affine.admin.agent-runtime-timeline-items-none"](): string;
    /**
      * `Open LocalMind AI`
      */
    ["com.affine.office.open-localmind-ai"](): string;
    /**
      * `Manifest`
      */
    ["com.affine.admin.manifest"](): string;
    /**
      * `Manual ID, metadata unavailable`
      */
    ["com.affine.admin.manual-id-metadata-unavailable"](): string;
    /**
      * `Portrait`
      */
    ["com.affine.office.portrait"](): string;
    /**
      * `Active cell address`
      */
    ["com.affine.office.active-cell-address"](): string;
    /**
      * `All forwarding statuses`
      */
    ["com.affine.admin.all-forwarding-statuses"](): string;
    /**
      * `Verification unavailable`
      */
    ["com.affine.ui.verification-unavailable"](): string;
    /**
      * `Highlight`
      */
    ["com.affine.office.highlight"](): string;
    /**
      * `Enterprise CLI`
      */
    ["com.affine.admin.enterprise-cli"](): string;
    /**
      * `Agent runtime native trace events none`
      */
    ["com.affine.admin.agent-runtime-native-trace-events-none"](): string;
    /**
      * `Provider allowed`
      */
    ["com.affine.admin.provider-allowed"](): string;
    /**
      * `Current worksheet name`
      */
    ["com.affine.office.current-worksheet-name"](): string;
    /**
      * `Manage`
      */
    ["com.affine.admin.manage"](): string;
    /**
      * `Find actions`
      */
    ["com.affine.ai.action-label.find-actions"](): string;
    /**
      * `{{count}} package comments`
      */
    ["com.affine.office.comment-count_other"](options: {
        readonly count: (string | number | bigint) & (string | number | bigint);
    }): string;
    /**
      * `Preparing to upload...`
      */
    ["com.affine.admin.preparing-to-upload"](): string;
    /**
      * `This presentation has no slides.`
      */
    ["com.affine.office.this-presentation-has-no-slides"](): string;
    /**
      * `Legacy chat completions style`
      */
    ["com.affine.admin.legacy-chat-completions-style"](): string;
    /**
      * `Page break`
      */
    ["com.affine.office.page-break"](): string;
    /**
      * `Search workspace AI credential scopes`
      */
    ["com.affine.admin.search-workspace-ai-credential-scopes"](): string;
    /**
      * `review image`
      */
    ["com.affine.ai.action-label.review-image"](): string;
    /**
      * `Delete this comment and its replies?`
      */
    ["com.affine.office.delete-this-comment-and-its-replies"](): string;
    /**
      * `No prepared route steps returned.`
      */
    ["com.affine.admin.no-prepared-route-steps-returned"](): string;
    /**
      * `Agent runtime unsupported step statuses none`
      */
    ["com.affine.admin.agent-runtime-unsupported-step-statuses-none"](): string;
    /**
      * `others`
      */
    ["com.affine.ai.action-label.others"](): string;
    /**
      * `PDF print source`
      */
    ["com.affine.office.pdf-print-source"](): string;
    /**
      * `Reasons`
      */
    ["com.affine.admin.reasons"](): string;
    /**
      * `More changes exist beyond the bounded comparison result.`
      */
    ["com.affine.office.more-changes-exist-beyond-the-bounded-comparison-result"](): string;
    /**
      * `You are already in this chat`
      */
    ["com.affine.ui.you-are-already-in-this-chat"](): string;
    /**
      * `Slide insertion`
      */
    ["com.affine.office.slide-insertion"](): string;
    /**
      * `Model candidates diagnostics`
      */
    ["com.affine.admin.model-candidates-diagnostics"](): string;
    /**
      * `New Chat`
      */
    ["com.affine.ai.action-label.new-chat"](): string;
    /**
      * `Fallback none`
      */
    ["com.affine.admin.fallback-none"](): string;
    /**
      * `pages`
      */
    ["com.affine.office.pages"](): string;
    /**
      * `AI Profiles could not be loaded. Account details can still be edited.`
      */
    ["com.affine.admin.ai-profiles-could-not-be-loaded-account-details-can-still-be-edited"](): string;
    /**
      * `Sheet tools`
      */
    ["com.affine.office.sheet-tools"](): string;
    /**
      * `Send Test Email`
      */
    ["com.affine.admin.send-test-email"](): string;
    /**
      * `Goto Admin Panel failed, please try again.`
      */
    ["com.affine.admin.goto-admin-panel-failed-please-try-again"](): string;
    /**
      * `Agent runtime unsupported timeline event types none`
      */
    ["com.affine.admin.agent-runtime-unsupported-timeline-event-types-none"](): string;
    /**
      * `All execution statuses`
      */
    ["com.affine.admin.all-execution-statuses"](): string;
    /**
      * `copilot.prompts.overrides: per-prompt model, optionalModels, enabled state, and prompt config.`
      */
    ["com.affine.admin.copilot-prompts-overrides-per-prompt-model-optionalmodels-enabled-state-and-prompt-config"](): string;
    /**
      * `The provider candidate passed route policy checks.`
      */
    ["com.affine.ui.the-provider-candidate-passed-route-policy-checks"](): string;
    /**
      * `app icon`
      */
    ["com.affine.ui.app-icon"](): string;
    /**
      * `Search failed`
      */
    ["com.affine.office.search-failed"](): string;
    /**
      * `Download manifest JSON`
      */
    ["com.affine.admin.download-manifest-json"](): string;
    /**
      * `tables`
      */
    ["com.affine.office.tables"](): string;
    /**
      * `Reopen`
      */
    ["com.affine.office.reopen"](): string;
    /**
      * `Provider defaults JSON`
      */
    ["com.affine.admin.provider-defaults-json"](): string;
    /**
      * `member list only works in cloud`
      */
    ["com.affine.ui.member-list-only-works-in-cloud"](): string;
    /**
      * `Publish`
      */
    ["com.affine.admin.publish"](): string;
    /**
      * `User Detail`
      */
    ["com.affine.admin.user-detail"](): string;
    /**
      * `Allowed`
      */
    ["com.affine.admin.allowed"](): string;
    /**
      * `Refreshing...`
      */
    ["com.affine.admin.refreshing-2"](): string;
    /**
      * `Failed to load members`
      */
    ["com.affine.ui.failed-to-load-members"](): string;
    /**
      * `When enabled, you must confirm the journal before you can create a new journal.`
      */
    ["com.affine.ui.when-enabled-you-must-confirm-the-journal-before-you-can-create-a-new-journal"](): string;
    /**
      * `Search PDF text`
      */
    ["com.affine.office.search-pdf-text"](): string;
    /**
      * `Create bundle`
      */
    ["com.affine.admin.create-bundle"](): string;
    /**
      * `Prepared model resolved`
      */
    ["com.affine.ui.prepared-model-resolved"](): string;
    /**
      * `Export`
      */
    ["com.affine.ui.export"](): string;
    /**
      * `No protocol metadata`
      */
    ["com.affine.admin.no-protocol-metadata"](): string;
    /**
      * `No step requested model sources`
      */
    ["com.affine.admin.no-step-requested-model-sources"](): string;
    /**
      * `Inspect run`
      */
    ["com.affine.admin.inspect-run"](): string;
    /**
      * `Paragraph {{name}}`
      */
    ["com.affine.office.paragraph-name"](options: {
        readonly name: string;
    }): string;
    /**
      * `Theme color value`
      */
    ["com.affine.office.theme-color-value"](): string;
    /**
      * `No prepared route trace returned for action run`
      */
    ["com.affine.admin.no-prepared-route-trace-returned-for-action-run"](): string;
    /**
      * `Action`
      */
    ["com.affine.admin.action"](): string;
    /**
      * `Verified Client`
      */
    ["com.affine.ui.verified-client"](): string;
    /**
      * `Prepare runtime error`
      */
    ["com.affine.ui.prepare-runtime-error"](): string;
    /**
      * `Slide`
      */
    ["com.affine.office.slide"](): string;
    /**
      * `Support bundle object-storage webhooks`
      */
    ["com.affine.admin.support-bundle-object-storage-webhooks"](): string;
    /**
      * `Spreadsheet editing`
      */
    ["com.affine.office.spreadsheet-editing"](): string;
    /**
      * `Pixel style`
      */
    ["com.affine.ai.action-label.pixel-style"](): string;
    /**
      * `A new workspace will be created.`
      */
    ["com.affine.ui.a-new-workspace-will-be-created"](): string;
    /**
      * `All statuses`
      */
    ["com.affine.admin.all-statuses"](): string;
    /**
      * `Doc saved successfully! Would you like to open it now?`
      */
    ["com.affine.ui.doc-saved-successfully-would-you-like-to-open-it-now"](): string;
    /**
      * `Terms of Conditions`
      */
    ["com.affine.ui.terms-of-conditions"](): string;
    /**
      * `Member count`
      */
    ["com.affine.admin.member-count"](): string;
    /**
      * `Landscape`
      */
    ["com.affine.office.landscape"](): string;
    /**
      * `Previewing {{operation}}`
      */
    ["com.affine.office.previewing-operation"](options: {
        readonly operation: string;
    }): string;
    /**
      * `Clear History`
      */
    ["com.affine.ui.clear-history"](): string;
    /**
      * `{{count}} package comment`
      */
    ["com.affine.office.comment-count_one"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Summarize`
      */
    ["com.affine.ai.action-label.summarize"](): string;
    /**
      * `DB-backed support bundle requests and minimal manifest metadata`
      */
    ["com.affine.admin.db-backed-support-bundle-requests-and-minimal-manifest-metadata"](): string;
    /**
      * `Upgrade to Team`
      */
    ["com.affine.admin.upgrade-to-team"](): string;
    /**
      * `Catalog source`
      */
    ["com.affine.admin.catalog-source"](): string;
    /**
      * `Storage`
      */
    ["com.affine.ui.storage"](): string;
    /**
      * `Reject all`
      */
    ["com.affine.office.reject-all"](): string;
    /**
      * `Route policy JSON`
      */
    ["com.affine.admin.route-policy-json"](): string;
    /**
      * `The latest Office revision is behind task evidence.`
      */
    ["com.affine.office.the-latest-office-revision-is-behind-task-evidence"](): string;
    /**
      * `Copilot Conversations`
      */
    ["com.affine.admin.copilot-conversations"](): string;
    /**
      * `Checks`
      */
    ["com.affine.admin.checks"](): string;
    /**
      * `Workspace AI credential saved.`
      */
    ["com.affine.admin.workspace-ai-credential-saved"](): string;
    /**
      * `Not initialized`
      */
    ["com.affine.admin.not-initialized"](): string;
    /**
      * `Recommended none`
      */
    ["com.affine.admin.recommended-none"](): string;
    /**
      * `Testing...`
      */
    ["com.affine.admin.testing"](): string;
    /**
      * `No issues`
      */
    ["com.affine.admin.no-issues"](): string;
    /**
      * `Configure web search, image source, copilot storage, and support bundle transfer webhooks.`
      */
    ["com.affine.admin.configure-web-search-image-source-copilot-storage-and-support-bundle-transfer-webhooks"](): string;
    /**
      * `No requested models`
      */
    ["com.affine.admin.no-requested-models"](): string;
    /**
      * `The matched candidate belongs to a registry branch not selected.`
      */
    ["com.affine.ui.the-matched-candidate-belongs-to-a-registry-branch-not-selected"](): string;
    /**
      * `No step protocol pairs`
      */
    ["com.affine.admin.no-step-protocol-pairs"](): string;
    /**
      * `Invalid URL or protocol`
      */
    ["com.affine.ui.invalid-url-or-protocol"](): string;
    /**
      * `Accept all`
      */
    ["com.affine.office.accept-all"](): string;
    /**
      * `Allowed providers Any`
      */
    ["com.affine.admin.allowed-providers-any"](): string;
    /**
      * `No behavior flags`
      */
    ["com.affine.admin.no-behavior-flags"](): string;
    /**
      * `No persisted steps`
      */
    ["com.affine.admin.no-persisted-steps"](): string;
    /**
      * `The latest Office revision is unavailable.`
      */
    ["com.affine.office.the-latest-office-revision-is-unavailable"](): string;
    /**
      * `Failed to login`
      */
    ["com.affine.admin.failed-to-login"](): string;
    /**
      * `Blob Size`
      */
    ["com.affine.admin.blob-size-2"](): string;
    /**
      * `Allow document embedding for search`
      */
    ["com.affine.admin.allow-document-embedding-for-search"](): string;
    /**
      * `No matches`
      */
    ["com.affine.ui.no-matches"](): string;
    /**
      * `Blobs`
      */
    ["com.affine.admin.blobs"](): string;
    /**
      * `Default source`
      */
    ["com.affine.admin.default-source"](): string;
    /**
      * `Text note`
      */
    ["com.affine.office.text-note"](): string;
    /**
      * `Create linked doc`
      */
    ["com.affine.ui.create-linked-doc"](): string;
    /**
      * `Workspace selector`
      */
    ["com.affine.admin.workspace-selector"](): string;
    /**
      * `Overall health`
      */
    ["com.affine.admin.overall-health"](): string;
    /**
      * `Add worksheet`
      */
    ["com.affine.office.add-worksheet"](): string;
    /**
      * `The prompt default model is not routable, so the active default uses a fallback route.`
      */
    ["com.affine.ui.the-prompt-default-model-is-not-routable-so-the-active-default-uses-a-fallback-route"](): string;
    /**
      * `Test passed for this provider configuration`
      */
    ["com.affine.admin.test-passed-for-this-provider-configuration"](): string;
    /**
      * `Copy original link`
      */
    ["com.affine.ui.copy-original-link"](): string;
    /**
      * `Source chain fingerprint`
      */
    ["com.affine.admin.source-chain-fingerprint"](): string;
    /**
      * `The provider model does not satisfy the requested capability.`
      */
    ["com.affine.ui.the-provider-model-does-not-satisfy-the-requested-capability"](): string;
    /**
      * `Blob size`
      */
    ["com.affine.admin.blob-size"](): string;
    /**
      * `Continue with {{provider}}`
      */
    ["com.affine.ui.continue-with-provider"](options: {
        readonly provider: string;
    }): string;
    /**
      * `ServerVersion`
      */
    ["com.affine.admin.serverversion"](): string;
    /**
      * `Failed to encode the redacted PDF page`
      */
    ["com.affine.office.failed-to-encode-the-redacted-pdf-page"](): string;
    /**
      * `LocalMind deployment guide`
      */
    ["com.affine.ui.localmind-deployment-guide"](): string;
    /**
      * `Clay style`
      */
    ["com.affine.ai.action-label.clay-style"](): string;
    /**
      * `A configured provider profile model matched the request.`
      */
    ["com.affine.ui.a-configured-provider-profile-model-matched-the-request"](): string;
    /**
      * `The requested model is outside the provider profile allowlist.`
      */
    ["com.affine.ui.the-requested-model-is-outside-the-provider-profile-allowlist"](): string;
    /**
      * `Delete columns`
      */
    ["com.affine.office.delete-columns"](): string;
    /**
      * `No step requested target pairs`
      */
    ["com.affine.admin.no-step-requested-target-pairs"](): string;
    /**
      * `Provide feedback.`
      */
    ["com.affine.ui.provide-feedback"](): string;
    /**
      * `Send to AI`
      */
    ["com.affine.ai.action-label.send-to-ai"](): string;
    /**
      * `Mail type`
      */
    ["com.affine.admin.mail-type"](): string;
    /**
      * `Series {{number}}`
      */
    ["com.affine.office.series-number"](options: {
        readonly number: string;
    }): string;
    /**
      * `Text note`
      */
    ["com.affine.office.annotation-type.text"](): string;
    /**
      * `Config`
      */
    ["com.affine.admin.config"](): string;
    /**
      * `Prompt default`
      */
    ["com.affine.admin.prompt-default"](): string;
    /**
      * `Theme color slot`
      */
    ["com.affine.office.theme-color-slot"](): string;
    /**
      * `Unknown provider`
      */
    ["com.affine.admin.unknown-provider"](): string;
    /**
      * `Workspace not found.`
      */
    ["com.affine.admin.workspace-not-found"](): string;
    /**
      * `Prompt fallback`
      */
    ["com.affine.admin.prompt-fallback"](): string;
    /**
      * `Params`
      */
    ["com.affine.admin.params"](): string;
    /**
      * `Model strategy`
      */
    ["com.affine.admin.model-strategy"](): string;
    /**
      * `Write a poem about this`
      */
    ["com.affine.ai.action-label.write-a-poem-about-this"](): string;
    /**
      * `Workspace AI Profiles`
      */
    ["com.affine.admin.workspace-ai-profiles"](): string;
    /**
      * `Confirm Import`
      */
    ["com.affine.admin.confirm-import"](): string;
    /**
      * `Prepare trace`
      */
    ["com.affine.ui.prepare-trace"](): string;
    /**
      * `Allow BYOK private endpoint`
      */
    ["com.affine.admin.allow-byok-private-endpoint"](): string;
    /**
      * `timeline gap`
      */
    ["com.affine.admin.timeline-gap"](): string;
    /**
      * `Shared links`
      */
    ["com.affine.admin.shared-links"](): string;
    /**
      * `Snapshot count`
      */
    ["com.affine.admin.snapshot-count"](): string;
    /**
      * `{{name}} worksheet`
      */
    ["com.affine.office.named-worksheet"](options: {
        readonly name: string;
    }): string;
    /**
      * `Chart {{name}}`
      */
    ["com.affine.office.chart-name"](options: {
        readonly name: string;
    }): string;
    /**
      * `Scope`
      */
    ["com.affine.admin.scope"](): string;
    /**
      * `Global AI enablement and workspace BYOK policy.`
      */
    ["com.affine.admin.global-ai-enablement-and-workspace-byok-policy"](): string;
    /**
      * `Choose a file`
      */
    ["com.affine.ui.choose-a-file"](): string;
    /**
      * `Workflow adapters`
      */
    ["com.affine.admin.workflow-adapters"](): string;
    /**
      * `Invalid password.`
      */
    ["com.affine.admin.invalid-password"](): string;
    /**
      * `Fingerprints`
      */
    ["com.affine.admin.fingerprints"](): string;
    /**
      * `Prompt overrides JSON`
      */
    ["com.affine.admin.prompt-overrides-json"](): string;
    /**
      * `Apply geometry`
      */
    ["com.affine.office.apply-geometry"](): string;
    /**
      * `Admin account created successfully.`
      */
    ["com.affine.admin.admin-account-created-successfully"](): string;
    /**
      * `The selected image format is not supported.`
      */
    ["com.affine.office.the-selected-image-format-is-not-supported"](): string;
    /**
      * `Support bundle forwarding filter`
      */
    ["com.affine.admin.support-bundle-forwarding-filter"](): string;
    /**
      * `Dashboard menu`
      */
    ["com.affine.admin.dashboard-menu"](): string;
    /**
      * `Diagnostics manifest JSON`
      */
    ["com.affine.admin.diagnostics-manifest-json"](): string;
    /**
      * `Prompt defaults`
      */
    ["com.affine.admin.prompt-defaults"](): string;
    /**
      * `apply`
      */
    ["com.affine.office.task-action.apply"](): string;
    /**
      * `Loading comments…`
      */
    ["com.affine.office.loading-comments"](): string;
    /**
      * `Copy failed, please try again later`
      */
    ["com.affine.ui.copy-failed-please-try-again-later"](): string;
    /**
      * `Source chain`
      */
    ["com.affine.admin.source-chain"](): string;
    /**
      * `Failed to load PDF ({{status}})`
      */
    ["com.affine.office.pdf-load-failed"](options: {
        readonly status: string;
    }): string;
    /**
      * `Remote attachment not supported`
      */
    ["com.affine.ui.remote-attachment-not-supported"](): string;
    /**
      * `{{name}} chart`
      */
    ["com.affine.office.named-chart"](options: {
        readonly name: string;
    }): string;
    /**
      * `Insert or delete count`
      */
    ["com.affine.office.insert-or-delete-count"](): string;
    /**
      * `Slide {{name}}`
      */
    ["com.affine.office.slide-name"](options: {
        readonly name: string;
    }): string;
    /**
      * `Enter a password of {{min}}–{{max}} characters. We recommend using at least two of: uppercase letters, lowercase letters, numbers, and symbols.`
      */
    ["com.affine.admin.password-requirements"](options: Readonly<{
        min: string;
        max: string;
    }>): string;
    /**
      * `Pages`
      */
    ["com.affine.ui.pages"](): string;
    /**
      * `Enable URL preview`
      */
    ["com.affine.admin.enable-url-preview"](): string;
    /**
      * `Update Workspace`
      */
    ["com.affine.admin.update-workspace"](): string;
    /**
      * `Copied HTML to clipboard`
      */
    ["com.affine.ui.copied-html-to-clipboard"](): string;
    /**
      * `Search members...`
      */
    ["com.affine.ui.search-members"](): string;
    /**
      * `{{width}} × {{height}} pt`
      */
    ["com.affine.office.page-dimensions"](options: Readonly<{
        width: string;
        height: string;
    }>): string;
    /**
      * `CSV file format is incorrect or empty`
      */
    ["com.affine.admin.csv-file-format-is-incorrect-or-empty"](): string;
    /**
      * `Active Members`
      */
    ["com.affine.admin.active-members"](): string;
    /**
      * `Trace diagnostics text`
      */
    ["com.affine.admin.trace-diagnostics-text"](): string;
    /**
      * `Failed to restart to upgrade`
      */
    ["com.affine.ui.failed-to-restart-to-upgrade"](): string;
    /**
      * `Queue`
      */
    ["com.affine.admin.queue"](): string;
    /**
      * `Provider health probe status`
      */
    ["com.affine.admin.provider-health-probe-status"](): string;
    /**
      * `Details`
      */
    ["com.affine.admin.details"](): string;
    /**
      * `Open this doc`
      */
    ["com.affine.ai.action-label.open-this-doc"](): string;
    /**
      * `Read-only task route checks for self-hosted AI providers`
      */
    ["com.affine.admin.read-only-task-route-checks-for-self-hosted-ai-providers"](): string;
    /**
      * `Apply animation for setting subpage open/close`
      */
    ["com.affine.ui.apply-animation-for-setting-subpage-open-close"](): string;
    /**
      * `Region on page {{number}}`
      */
    ["com.affine.office.page-region"](options: {
        readonly number: string;
    }): string;
    /**
      * `Gutter`
      */
    ["com.affine.office.gutter"](): string;
    /**
      * `Failed to change language`
      */
    ["com.affine.settings.language.change-failed"](): string;
    /**
      * `Current`
      */
    ["com.affine.admin.current"](): string;
    /**
      * `Range format`
      */
    ["com.affine.office.range-format"](): string;
    /**
      * `Not selected`
      */
    ["com.affine.admin.not-selected"](): string;
    /**
      * `Action route dry-run evidence`
      */
    ["com.affine.admin.action-route-dry-run-evidence"](): string;
    /**
      * `Delete credential`
      */
    ["com.affine.admin.delete-credential"](): string;
    /**
      * `Text {{start}} to {{end}}`
      */
    ["com.affine.office.text-span"](options: Readonly<{
        start: string;
        end: string;
    }>): string;
    /**
      * `Instance administrators`
      */
    ["com.affine.admin.instance-administrators"](): string;
    /**
      * `Merge cells`
      */
    ["com.affine.office.merge-cells"](): string;
    /**
      * `{{count}} match`
      */
    ["com.affine.office.match-count_one"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Office AI changes`
      */
    ["com.affine.office.office-ai-changes"](): string;
    /**
      * `Failed to import users: `
      */
    ["com.affine.admin.failed-to-import-users-2"](): string;
    /**
      * `Enable Doc Embedding`
      */
    ["com.affine.admin.enable-doc-embedding-2"](): string;
    /**
      * `Reset scale`
      */
    ["com.affine.ui.reset-scale"](): string;
    /**
      * `Copy metadata JSON`
      */
    ["com.affine.admin.copy-metadata-json"](): string;
    /**
      * `New access tokens now use the replacement key.`
      */
    ["com.affine.admin.new-access-tokens-now-use-the-replacement-key"](): string;
    /**
      * `Annotation type`
      */
    ["com.affine.office.annotation-type"](): string;
    /**
      * `Copy manifest metadata JSON`
      */
    ["com.affine.admin.copy-manifest-metadata-json"](): string;
    /**
      * `projection gap`
      */
    ["com.affine.admin.projection-gap"](): string;
    /**
      * `Wait for upload`
      */
    ["com.affine.ui.wait-for-upload"](): string;
    /**
      * `Click to download`
      */
    ["com.affine.ui.click-to-download"](): string;
    /**
      * `Show detail`
      */
    ["com.affine.ai.action-label.show-detail"](): string;
    /**
      * `Email (required): e.g., user@example.com.`
      */
    ["com.affine.admin.email-required-e-g-user-example-com"](): string;
    /**
      * `Support bundles`
      */
    ["com.affine.admin.support-bundles"](): string;
    /**
      * `Repair execution executor payload JSON`
      */
    ["com.affine.admin.repair-execution-executor-payload-json"](): string;
    /**
      * `Enter a title for the new doc.`
      */
    ["com.affine.ui.enter-a-title-for-the-new-doc"](): string;
    /**
      * `Restart`
      */
    ["com.affine.ui.restart"](): string;
    /**
      * `Save credential`
      */
    ["com.affine.admin.save-credential"](): string;
    /**
      * `Admin panel for managing accounts, AI, config, and settings`
      */
    ["com.affine.admin.admin-panel-for-managing-accounts-ai-config-and-settings"](): string;
    /**
      * `Failed to load quota`
      */
    ["com.affine.ui.failed-to-load-quota"](): string;
    /**
      * `Invalid cell address`
      */
    ["com.affine.office.invalid-cell-address"](): string;
    /**
      * `Change Icon`
      */
    ["com.affine.ui.change-icon"](): string;
    /**
      * `Route`
      */
    ["com.affine.admin.route"](): string;
    /**
      * `No Workspace AI credentials are available. Create and verify credentials above before adding them to a profile.`
      */
    ["com.affine.admin.no-workspace-ai-credentials-are-available-create-and-verify-credentials-above-before-adding-them-to-"](): string;
    /**
      * `Agent runtime projected schema components none`
      */
    ["com.affine.admin.agent-runtime-projected-schema-components-none"](): string;
    /**
      * `Japanese`
      */
    ["com.affine.ai.action-label.japanese"](): string;
    /**
      * `Request API style`
      */
    ["com.affine.admin.request-api-style"](): string;
    /**
      * `Search Workspace / Owner`
      */
    ["com.affine.admin.search-workspace-owner"](): string;
    /**
      * `Policy allowed`
      */
    ["com.affine.ui.policy-allowed"](): string;
    /**
      * `Enter a valid cell address, for example A1.`
      */
    ["com.affine.office.enter-a-valid-cell-address-for-example-a1"](): string;
    /**
      * `No prepared models`
      */
    ["com.affine.admin.no-prepared-models"](): string;
    /**
      * `Allow Workspace Sharing`
      */
    ["com.affine.admin.allow-workspace-sharing"](): string;
    /**
      * `Usage`
      */
    ["com.affine.admin.usage"](): string;
    /**
      * `Delete Account`
      */
    ["com.affine.admin.delete-account-2"](): string;
    /**
      * `Normal`
      */
    ["com.affine.office.normal"](): string;
    /**
      * `Delete rows`
      */
    ["com.affine.office.delete-rows"](): string;
    /**
      * `You need to import the accounts by importing a CSV file in the correct format. Please download the CSV template.`
      */
    ["com.affine.admin.you-need-to-import-the-accounts-by-importing-a-csv-file-in-the-correct-format-please-download-the-cs"](): string;
    /**
      * `Content exceeds token limit`
      */
    ["com.affine.ui.content-exceeds-token-limit"](): string;
    /**
      * `Repair action preflight not checked`
      */
    ["com.affine.admin.repair-action-preflight-not-checked"](): string;
    /**
      * `Repair action catalog 0`
      */
    ["com.affine.admin.repair-action-catalog-0"](): string;
    /**
      * `run`
      */
    ["com.affine.admin.run-2"](): string;
    /**
      * `Page and section setup`
      */
    ["com.affine.office.page-and-section-setup"](): string;
    /**
      * `Allows trusted private-network targets. Takes effect only when custom endpoints are enabled.`
      */
    ["com.affine.admin.allows-trusted-private-network-targets-takes-effect-only-when-custom-endpoints-are-enabled"](): string;
    /**
      * `Loading persisted repair execution requests.`
      */
    ["com.affine.admin.loading-persisted-repair-execution-requests"](): string;
    /**
      * `This PDF has no pages.`
      */
    ["com.affine.office.this-pdf-has-no-pages"](): string;
    /**
      * `Create AI Profile`
      */
    ["com.affine.admin.create-ai-profile"](): string;
    /**
      * `The Office artifact may have been removed or you may not have access.`
      */
    ["com.affine.office.the-office-artifact-may-have-been-removed-or-you-may-not-have-access"](): string;
    /**
      * `Agent runtime`
      */
    ["com.affine.admin.agent-runtime"](): string;
    /**
      * `Preview unavailable`
      */
    ["com.affine.office.preview-unavailable"](): string;
    /**
      * `{{window}}, grouped by hour in UTC`
      */
    ["com.affine.admin.mail-bucket-hour"](options: {
        readonly window: string;
    }): string;
    /**
      * `Agent runtime projected step statuses none`
      */
    ["com.affine.admin.agent-runtime-projected-step-statuses-none"](): string;
    /**
      * `Worksheet insertion`
      */
    ["com.affine.office.worksheet-insertion"](): string;
    /**
      * `Selection ready`
      */
    ["com.affine.office.selection-ready"](): string;
    /**
      * `Prompt metadata is not available for the submitted prompt name.`
      */
    ["com.affine.admin.prompt-metadata-is-not-available-for-the-submitted-prompt-name"](): string;
    /**
      * `No policy candidate diagnostics returned.`
      */
    ["com.affine.admin.no-policy-candidate-diagnostics-returned"](): string;
    /**
      * `Approve execution`
      */
    ["com.affine.admin.approve-execution"](): string;
    /**
      * `Members and Invitations`
      */
    ["com.affine.admin.members-and-invitations"](): string;
    /**
      * `Clear filter`
      */
    ["com.affine.office.clear-filter"](): string;
    /**
      * `Wrap text`
      */
    ["com.affine.office.wrap-text"](): string;
    /**
      * `Embedding and rerank route readiness`
      */
    ["com.affine.admin.embedding-and-rerank-route-readiness"](): string;
    /**
      * `Remove Office selection from AI context`
      */
    ["com.affine.office.remove-office-selection-from-ai-context"](): string;
    /**
      * `Select a workspace`
      */
    ["com.affine.admin.select-a-workspace"](): string;
    /**
      * `Enable doc embedding`
      */
    ["com.affine.admin.enable-doc-embedding"](): string;
    /**
      * `removed`
      */
    ["com.affine.office.removed"](): string;
    /**
      * `No route`
      */
    ["com.affine.admin.no-route"](): string;
    /**
      * `Verification failed`
      */
    ["com.affine.ui.verification-failed"](): string;
    /**
      * `AI image filter`
      */
    ["com.affine.ai.action-label.ai-image-filter"](): string;
    /**
      * `Shared Pages`
      */
    ["com.affine.admin.shared-pages-2"](): string;
    /**
      * `Model and endpoint`
      */
    ["com.affine.admin.model-and-endpoint"](): string;
    /**
      * `Insert after selection`
      */
    ["com.affine.office.insert-after-selection"](): string;
    /**
      * `Cancel execution`
      */
    ["com.affine.admin.cancel-execution"](): string;
    /**
      * `Chart series {{number}} must have one numeric value per category.`
      */
    ["com.affine.office.series-values-required"](options: {
        readonly number: string;
    }): string;
    /**
      * `Clear validation`
      */
    ["com.affine.office.clear-validation"](): string;
    /**
      * `Top Shared Links`
      */
    ["com.affine.admin.top-shared-links"](): string;
    /**
      * `Workspace AI Profile deleted.`
      */
    ["com.affine.admin.workspace-ai-profile-deleted"](): string;
    /**
      * `Object type`
      */
    ["com.affine.office.object-type"](): string;
    /**
      * `Apply theme color`
      */
    ["com.affine.office.apply-theme-color"](): string;
    /**
      * `Delete key`
      */
    ["com.affine.admin.delete-key"](): string;
    /**
      * `French`
      */
    ["com.affine.ai.action-label.french"](): string;
    /**
      * `Prepared providers`
      */
    ["com.affine.admin.prepared-providers"](): string;
    /**
      * `No prompts match the current filters.`
      */
    ["com.affine.admin.no-prompts-match-the-current-filters"](): string;
    /**
      * `Prepared`
      */
    ["com.affine.admin.prepared"](): string;
    /**
      * `Well Done !`
      */
    ["com.affine.ui.well-done"](): string;
    /**
      * `No model candidates returned for this prompt.`
      */
    ["com.affine.admin.no-model-candidates-returned-for-this-prompt"](): string;
    /**
      * `Please type to confirm`
      */
    ["com.affine.admin.please-type-to-confirm"](): string;
    /**
      * `Email Delivery Trend`
      */
    ["com.affine.admin.email-delivery-trend"](): string;
    /**
      * `Workspace BYOK`
      */
    ["com.affine.admin.workspace-byok"](): string;
    /**
      * `We will continue to enhance our products based on your feedback. Thank you once again for your supports.`
      */
    ["com.affine.ui.we-will-continue-to-enhance-our-products-based-on-your-feedback-thank-you-once-again-for-your-suppor"](): string;
    /**
      * `Prompt registry publish gate is not available for non-registry prompts.`
      */
    ["com.affine.admin.prompt-registry-publish-gate-is-not-available-for-non-registry-prompts"](): string;
    /**
      * `Choose a PNG, JPEG, or GIF image.`
      */
    ["com.affine.office.choose-a-png-jpeg-or-gif-image"](): string;
    /**
      * `review text`
      */
    ["com.affine.ai.action-label.review-text"](): string;
    /**
      * `Fallback`
      */
    ["com.affine.admin.fallback"](): string;
    /**
      * `Prepare schema error`
      */
    ["com.affine.ui.prepare-schema-error"](): string;
    /**
      * `Unrecognized route diagnostic reason.`
      */
    ["com.affine.ui.unrecognized-route-diagnostic-reason"](): string;
    /**
      * `Chat With LocalMind AI`
      */
    ["com.affine.admin.chat-with-localmind-ai"](): string;
    /**
      * `Optional static headers sent to compatible endpoints.`
      */
    ["com.affine.admin.optional-static-headers-sent-to-compatible-endpoints"](): string;
    /**
      * `This server generated and stored its signing key automatically. Rotate it here when needed; key material is never shown in the admin panel.`
      */
    ["com.affine.admin.this-server-generated-and-stored-its-signing-key-automatically-rotate-it-here-when-needed-key-materi"](): string;
    /**
      * `Brainstorm ideas with mind map`
      */
    ["com.affine.ai.action-label.brainstorm-ideas-with-mind-map"](): string;
    /**
      * `A new key will become active immediately. The current key remains available only long enough to verify access tokens already issued.`
      */
    ["com.affine.admin.a-new-key-will-become-active-immediately-the-current-key-remains-available-only-long-enough-to-verif"](): string;
    /**
      * `Continue`
      */
    ["com.affine.admin.continue"](): string;
    /**
      * `Open menu`
      */
    ["com.affine.admin.open-menu"](): string;
    /**
      * `No runtime metadata`
      */
    ["com.affine.admin.no-runtime-metadata"](): string;
    /**
      * `Chart value range`
      */
    ["com.affine.office.chart-value-range"](): string;
    /**
      * `Edit Office comment`
      */
    ["com.affine.office.edit-office-comment"](): string;
    /**
      * `run(s)`
      */
    ["com.affine.office.run-s"](): string;
    /**
      * `No workspaces match this search.`
      */
    ["com.affine.admin.no-workspaces-match-this-search"](): string;
    /**
      * `copilot.providers.defaults: defaults for text, object, embedding, image, rerank, structured, and fallback provider ids.`
      */
    ["com.affine.admin.copilot-providers-defaults-defaults-for-text-object-embedding-image-rerank-structured-and-fallback-p"](): string;
    /**
      * `Change tone to`
      */
    ["com.affine.ai.action-label.change-tone-to"](): string;
    /**
      * `Ink`
      */
    ["com.affine.office.annotation-type.Ink"](): string;
    /**
      * `please try again later.`
      */
    ["com.affine.ui.please-try-again-later"](): string;
    /**
      * `Input not supported`
      */
    ["com.affine.ui.input-not-supported"](): string;
    /**
      * `package comment(s)`
      */
    ["com.affine.office.package-comment-s"](): string;
    /**
      * `Section`
      */
    ["com.affine.office.section"](): string;
    /**
      * `New Office comment`
      */
    ["com.affine.office.new-office-comment"](): string;
    /**
      * `Collaborators`
      */
    ["com.affine.office.collaborators"](): string;
    /**
      * `PDF page operations`
      */
    ["com.affine.office.pdf-page-operations"](): string;
    /**
      * `Please type email to confirm`
      */
    ["com.affine.admin.please-type-email-to-confirm"](): string;
    /**
      * `retry`
      */
    ["com.affine.office.task-action.retry"](): string;
    /**
      * `Fix spelling`
      */
    ["com.affine.ai.action-label.fix-spelling"](): string;
    /**
      * `no annotations`
      */
    ["com.affine.office.no-annotations"](): string;
    /**
      * `Data validation`
      */
    ["com.affine.office.data-validation"](): string;
    /**
      * `Active source chain`
      */
    ["com.affine.admin.active-source-chain"](): string;
    /**
      * `Persisted AgentRun, AgentStep, and timeline state`
      */
    ["com.affine.admin.persisted-agentrun-agentstep-and-timeline-state"](): string;
    /**
      * `Select row`
      */
    ["com.affine.admin.select-row"](): string;
    /**
      * `Range formatting`
      */
    ["com.affine.office.range-formatting"](): string;
    /**
      * `Actor`
      */
    ["com.affine.admin.actor"](): string;
    /**
      * `Don&apos;t have the app?`
      */
    ["com.affine.ui.don-apos-t-have-the-app"](): string;
    /**
      * `Filter...`
      */
    ["com.affine.ui.filter"](): string;
    /**
      * `Equation`
      */
    ["com.affine.office.equation"](): string;
    /**
      * `Modified`
      */
    ["com.affine.admin.modified"](): string;
    /**
      * `Health`
      */
    ["com.affine.admin.health"](): string;
    /**
      * `Failed to save Workspace AI Profile.`
      */
    ["com.affine.admin.failed-to-save-workspace-ai-profile"](): string;
    /**
      * `Account ID`
      */
    ["com.affine.admin.account-id"](): string;
    /**
      * `Disable AI for all Project conversations? New requests will stop until global Project BYOK is enabled again.`
      */
    ["com.affine.admin.disable-ai-for-all-project-conversations-new-requests-will-stop-until-global-project-byok-is-enabled"](): string;
    /**
      * `Task route evidence`
      */
    ["com.affine.admin.task-route-evidence"](): string;
    /**
      * `Remediation`
      */
    ["com.affine.admin.remediation"](): string;
    /**
      * `Slide thumbnails`
      */
    ["com.affine.office.slide-thumbnails"](): string;
    /**
      * `Enter user name`
      */
    ["com.affine.admin.enter-user-name"](): string;
    /**
      * `• Blob`
      */
    ["com.affine.admin.blob"](): string;
    /**
      * `{{label}} must be at least {{minimum}}.`
      */
    ["com.affine.office.minimum-value"](options: Readonly<{
        label: string;
        minimum: string;
    }>): string;
    /**
      * `No phase diagnostics returned.`
      */
    ["com.affine.admin.no-phase-diagnostics-returned"](): string;
    /**
      * `No detailed error stack is provided.`
      */
    ["com.affine.ui.no-detailed-error-stack-is-provided"](): string;
    /**
      * `All forwarding`
      */
    ["com.affine.admin.all-forwarding"](): string;
    /**
      * `Request, prompt, action, approval, audit, side effect, failure, lease, or fingerprint`
      */
    ["com.affine.admin.request-prompt-action-approval-audit-side-effect-failure-lease-or-fingerprint"](): string;
    /**
      * `Failed to revoke invitation link`
      */
    ["com.affine.ui.failed-to-revoke-invitation-link"](): string;
    /**
      * `This document revision has no editable state.`
      */
    ["com.affine.office.this-document-revision-has-no-editable-state"](): string;
    /**
      * `Anthropic Vertex JSON`
      */
    ["com.affine.admin.anthropic-vertex-json"](): string;
    /**
      * `Expand from this mind map node`
      */
    ["com.affine.ai.action-label.expand-from-this-mind-map-node"](): string;
    /**
      * `Dashboard`
      */
    ["com.affine.admin.dashboard"](): string;
    /**
      * `Unable to refresh Office revision`
      */
    ["com.affine.office.unable-to-refresh-office-revision"](): string;
    /**
      * `Loading Workspace AI Profiles...`
      */
    ["com.affine.admin.loading-workspace-ai-profiles"](): string;
    /**
      * `Native Office requires a DOCX, XLSX, PPTX, or PDF file`
      */
    ["com.affine.office.native-office-requires-a-docx-xlsx-pptx-or-pdf-file"](): string;
    /**
      * `This legacy platform candidate is not eligible for BYOK-only execution.`
      */
    ["com.affine.ui.this-legacy-platform-candidate-is-not-eligible-for-byok-only-execution"](): string;
    /**
      * `Failed to create document`
      */
    ["com.affine.ui.failed-to-create-document"](): string;
    /**
      * `The explicit profile applies in its workspace. Other workspaces use their enabled default profile.`
      */
    ["com.affine.admin.the-explicit-profile-applies-in-its-workspace-other-workspaces-use-their-enabled-default-profile"](): string;
    /**
      * `What are your thoughts?`
      */
    ["com.affine.ai.chat.input-placeholder"](): string;
    /**
      * `{{hours}}h active window`
      */
    ["com.affine.admin.active-window"](options: {
        readonly hours: string;
    }): string;
    /**
      * `{{days}}d aggregation`
      */
    ["com.affine.admin.conversation-aggregation"](options: {
        readonly days: string;
    }): string;
    /**
      * `{{hours}}h`
      */
    ["com.affine.admin.range-hours"](options: {
        readonly hours: string;
    }): string;
    /**
      * `{{days}}d`
      */
    ["com.affine.admin.range-days"](options: {
        readonly days: string;
    }): string;
    /**
      * `Top shared links range`
      */
    ["com.affine.admin.shared-links-range"](): string;
    /**
      * `Email delivery range`
      */
    ["com.affine.admin.mail-delivery-range"](): string;
    /**
      * `Email delivery trend`
      */
    ["com.affine.admin.mail-delivery-chart"](): string;
    /**
      * `Copilot conversations range`
      */
    ["com.affine.admin.conversation-range"](): string;
    /**
      * `Sync active users range`
      */
    ["com.affine.admin.sync-users-range"](): string;
    /**
      * `Sync active users trend`
      */
    ["com.affine.admin.sync-users-chart"](): string;
    /**
      * `Sync Active Users`
      */
    ["com.affine.admin.sync-users-series"](): string;
    /**
      * `Storage trend range`
      */
    ["com.affine.admin.storage-range"](): string;
    /**
      * `Workspace and blob storage trend`
      */
    ["com.affine.admin.storage-chart"](): string;
    /**
      * `Workspace Storage`
      */
    ["com.affine.admin.workspace-storage-series"](): string;
    /**
      * `Blob Storage`
      */
    ["com.affine.admin.blob-storage-series"](): string;
    /**
      * `Allow {{provider}} connections`
      */
    ["com.affine.admin.allow-provider-connections"](options: {
        readonly provider: string;
    }): string;
    /**
      * `Transcript and workspace indexing require an enabled server Gemini BYOK key.`
      */
    ["com.affine.admin.byok-transcript-warning"](): string;
    /**
      * `Workspace indexing requires an enabled server Gemini BYOK key.`
      */
    ["com.affine.admin.byok-indexing-warning"](): string;
    /**
      * `Import timed out. Please retry.`
      */
    ["com.affine.localmind.workspace-import.timeout"](): string;
    /**
      * `Import permission changed. Check source access before retrying.`
      */
    ["com.affine.localmind.workspace-import.permissionDenied"](): string;
    /**
      * `The source file is unavailable. Check that it still exists.`
      */
    ["com.affine.localmind.workspace-import.sourceUnavailable"](): string;
    /**
      * `The file changed during import. Please retry.`
      */
    ["com.affine.localmind.workspace-import.conflict"](): string;
    /**
      * `Table name`
      */
    ["com.affine.office.table-name-label"](): string;
    /**
      * `An internal error occurred.`
      */
    ["error.INTERNAL_SERVER_ERROR"](): string;
    /**
      * `Network error.`
      */
    ["error.NETWORK_ERROR"](): string;
    /**
      * `Too many requests.`
      */
    ["error.TOO_MANY_REQUEST"](): string;
    /**
      * `Resource not found.`
      */
    ["error.NOT_FOUND"](): string;
    /**
      * `Bad request.`
      */
    ["error.BAD_REQUEST"](): string;
    /**
      * `GraphQL bad request, code: {{code}}, {{message}}`
      */
    ["error.GRAPHQL_BAD_REQUEST"](options: Readonly<{
        code: string;
        message: string;
    }>): string;
    /**
      * `HTTP request error, message: {{message}}`
      */
    ["error.HTTP_REQUEST_ERROR"](options: {
        readonly message: string;
    }): string;
    /**
      * `URL blocked by SSRF protection: {{reason}}`
      */
    ["error.SSRF_BLOCKED_ERROR"](options: {
        readonly reason: string;
    }): string;
    /**
      * `Response too large ({{receivedBytes}} bytes), limit is {{limitBytes}} bytes`
      */
    ["error.RESPONSE_TOO_LARGE_ERROR"](options: Readonly<{
        receivedBytes: string;
        limitBytes: string;
    }>): string;
    /**
      * `Email service is not configured.`
      */
    ["error.EMAIL_SERVICE_NOT_CONFIGURED"](): string;
    /**
      * `Image format not supported: {{format}}`
      */
    ["error.IMAGE_FORMAT_NOT_SUPPORTED"](options: {
        readonly format: string;
    }): string;
    /**
      * `Query is too long, max length is {{max}}.`
      */
    ["error.QUERY_TOO_LONG"](options: {
        readonly max: string;
    }): string;
    /**
      * `Validation error, errors: {{errors}}`
      */
    ["error.VALIDATION_ERROR"](options: {
        readonly errors: string;
    }): string;
    /**
      * `User not found.`
      */
    ["error.USER_NOT_FOUND"](): string;
    /**
      * `User avatar not found.`
      */
    ["error.USER_AVATAR_NOT_FOUND"](): string;
    /**
      * `This email has already been registered.`
      */
    ["error.EMAIL_ALREADY_USED"](): string;
    /**
      * `You are trying to update your account email to the same as the old one.`
      */
    ["error.SAME_EMAIL_PROVIDED"](): string;
    /**
      * `Wrong user email or password: {{email}}`
      */
    ["error.WRONG_SIGN_IN_CREDENTIALS"](options: {
        readonly email: string;
    }): string;
    /**
      * `Unknown authentication provider {{name}}.`
      */
    ["error.UNKNOWN_OAUTH_PROVIDER"](options: {
        readonly name: string;
    }): string;
    /**
      * `OAuth state expired, please try again.`
      */
    ["error.OAUTH_STATE_EXPIRED"](): string;
    /**
      * `Invalid callback state parameter.`
      */
    ["error.INVALID_OAUTH_CALLBACK_STATE"](): string;
    /**
      * `Invalid callback code parameter, provider response status: {{status}} and body: {{body}}.`
      */
    ["error.INVALID_OAUTH_CALLBACK_CODE"](options: Readonly<{
        status: string;
        body: string;
    }>): string;
    /**
      * `Invalid auth state. You might start the auth progress from another device.`
      */
    ["error.INVALID_AUTH_STATE"](): string;
    /**
      * `Missing query parameter `{{name}}`.`
      */
    ["error.MISSING_OAUTH_QUERY_PARAMETER"](options: {
        readonly name: string;
    }): string;
    /**
      * `The third-party account has already been connected to another user.`
      */
    ["error.OAUTH_ACCOUNT_ALREADY_CONNECTED"](): string;
    /**
      * `Invalid OAuth response: {{reason}}.`
      */
    ["error.INVALID_OAUTH_RESPONSE"](options: {
        readonly reason: string;
    }): string;
    /**
      * `An invalid email provided: {{email}}`
      */
    ["error.INVALID_EMAIL"](options: {
        readonly email: string;
    }): string;
    /**
      * `Password must be between {{min}} and {{max}} characters`
      */
    ["error.INVALID_PASSWORD_LENGTH"](options: Readonly<{
        min: string;
        max: string;
    }>): string;
    /**
      * `Password is required.`
      */
    ["error.PASSWORD_REQUIRED"](): string;
    /**
      * `You are trying to sign in by a different method than you signed up with.`
      */
    ["error.WRONG_SIGN_IN_METHOD"](): string;
    /**
      * `You are not allowed to sign up.`
      */
    ["error.SIGN_UP_FORBIDDEN"](): string;
    /**
      * `The email token provided is not found.`
      */
    ["error.EMAIL_TOKEN_NOT_FOUND"](): string;
    /**
      * `An invalid email token provided.`
      */
    ["error.INVALID_EMAIL_TOKEN"](): string;
    /**
      * `The link has expired.`
      */
    ["error.LINK_EXPIRED"](): string;
    /**
      * `You must sign in first to access this resource.`
      */
    ["error.AUTHENTICATION_REQUIRED"](): string;
    /**
      * `The access token has expired.`
      */
    ["error.ACCESS_TOKEN_EXPIRED"](): string;
    /**
      * `The access token is invalid.`
      */
    ["error.ACCESS_TOKEN_INVALID"](): string;
    /**
      * `The auth session has expired.`
      */
    ["error.AUTH_SESSION_EXPIRED"](): string;
    /**
      * `The auth session has been revoked.`
      */
    ["error.AUTH_SESSION_REVOKED"](): string;
    /**
      * `The refresh token is invalid.`
      */
    ["error.REFRESH_TOKEN_INVALID"](): string;
    /**
      * `The refresh token has already been used.`
      */
    ["error.REFRESH_TOKEN_REUSED"](): string;
    /**
      * `Auth session service is temporarily unavailable.`
      */
    ["error.AUTH_SESSION_TEMPORARILY_UNAVAILABLE"](): string;
    /**
      * `You are not allowed to perform this action.`
      */
    ["error.ACTION_FORBIDDEN"](): string;
    /**
      * `You do not have permission to access this resource.`
      */
    ["error.ACCESS_DENIED"](): string;
    /**
      * `You must verify your email before accessing this resource.`
      */
    ["error.EMAIL_VERIFICATION_REQUIRED"](): string;
    /**
      * `Space {{spaceId}} permission not found.`
      */
    ["error.WORKSPACE_PERMISSION_NOT_FOUND"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `Space {{spaceId}} not found.`
      */
    ["error.SPACE_NOT_FOUND"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `Member not found in Space {{spaceId}}.`
      */
    ["error.MEMBER_NOT_FOUND_IN_SPACE"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `You should join in Space {{spaceId}} before broadcasting messages.`
      */
    ["error.NOT_IN_SPACE"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `You have already joined in Space {{spaceId}}.`
      */
    ["error.ALREADY_IN_SPACE"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `You do not have permission to access Space {{spaceId}}.`
      */
    ["error.SPACE_ACCESS_DENIED"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `Owner of Space {{spaceId}} not found.`
      */
    ["error.SPACE_OWNER_NOT_FOUND"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `Space should have only one owner.`
      */
    ["error.SPACE_SHOULD_HAVE_ONLY_ONE_OWNER"](): string;
    /**
      * `Owner can not leave the workspace.`
      */
    ["error.OWNER_CAN_NOT_LEAVE_WORKSPACE"](): string;
    /**
      * `You can not revoke your own permission.`
      */
    ["error.CAN_NOT_REVOKE_YOURSELF"](): string;
    /**
      * `Doc {{docId}} under Space {{spaceId}} not found.`
      */
    ["error.DOC_NOT_FOUND"](options: Readonly<{
        docId: string;
        spaceId: string;
    }>): string;
    /**
      * `You do not have permission to perform {{action}} action on doc {{docId}}.`
      */
    ["error.DOC_ACTION_DENIED"](options: Readonly<{
        action: string;
        docId: string;
    }>): string;
    /**
      * `Doc {{docId}} under Space {{spaceId}} is blocked from updating.`
      */
    ["error.DOC_UPDATE_BLOCKED"](options: Readonly<{
        docId: string;
        spaceId: string;
    }>): string;
    /**
      * `Your client with version {{version}} is rejected by remote sync server. Please upgrade to {{serverVersion}}.`
      */
    ["error.VERSION_REJECTED"](options: Readonly<{
        version: string;
        serverVersion: string;
    }>): string;
    /**
      * `Invalid doc history timestamp provided.`
      */
    ["error.INVALID_HISTORY_TIMESTAMP"](): string;
    /**
      * `History of {{docId}} at {{timestamp}} under Space {{spaceId}}.`
      */
    ["error.DOC_HISTORY_NOT_FOUND"](options: Readonly<{
        docId: string;
        timestamp: string;
        spaceId: string;
    }>): string;
    /**
      * `Blob {{blobId}} not found in Space {{spaceId}}.`
      */
    ["error.BLOB_NOT_FOUND"](options: Readonly<{
        blobId: string;
        spaceId: string;
    }>): string;
    /**
      * `Blob is invalid.`
      */
    ["error.BLOB_INVALID"](): string;
    /**
      * `Expected to publish a doc, not a Space.`
      */
    ["error.EXPECT_TO_PUBLISH_DOC"](): string;
    /**
      * `Expected to revoke a public doc, not a Space.`
      */
    ["error.EXPECT_TO_REVOKE_PUBLIC_DOC"](): string;
    /**
      * `Expect grant roles on doc {{docId}} under Space {{spaceId}}, not a Space.`
      */
    ["error.EXPECT_TO_GRANT_DOC_USER_ROLES"](options: Readonly<{
        docId: string;
        spaceId: string;
    }>): string;
    /**
      * `Expect revoke roles on doc {{docId}} under Space {{spaceId}}, not a Space.`
      */
    ["error.EXPECT_TO_REVOKE_DOC_USER_ROLES"](options: Readonly<{
        docId: string;
        spaceId: string;
    }>): string;
    /**
      * `Expect update roles on doc {{docId}} under Space {{spaceId}}, not a Space.`
      */
    ["error.EXPECT_TO_UPDATE_DOC_USER_ROLE"](options: Readonly<{
        docId: string;
        spaceId: string;
    }>): string;
    /**
      * `Doc is not public.`
      */
    ["error.DOC_IS_NOT_PUBLIC"](): string;
    /**
      * `Failed to store doc updates.`
      */
    ["error.FAILED_TO_SAVE_UPDATES"](): string;
    /**
      * `Failed to store doc snapshot.`
      */
    ["error.FAILED_TO_UPSERT_SNAPSHOT"](): string;
    /**
      * `A Team workspace is required to perform this action.`
      */
    ["error.ACTION_FORBIDDEN_ON_NON_TEAM_WORKSPACE"](): string;
    /**
      * `Doc default role can not be owner.`
      */
    ["error.DOC_DEFAULT_ROLE_CAN_NOT_BE_OWNER"](): string;
    /**
      * `Can not batch grant doc owner permissions.`
      */
    ["error.CAN_NOT_BATCH_GRANT_DOC_OWNER_PERMISSIONS"](): string;
    /**
      * `Can not set a non-active member as owner.`
      */
    ["error.NEW_OWNER_IS_NOT_ACTIVE_MEMBER"](): string;
    /**
      * `Invalid invitation provided.`
      */
    ["error.INVALID_INVITATION"](): string;
    /**
      * `No more seat available in the Space {{spaceId}}.`
      */
    ["error.NO_MORE_SEAT"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `Unsupported subscription plan: {{plan}}.`
      */
    ["error.UNSUPPORTED_SUBSCRIPTION_PLAN"](options: {
        readonly plan: string;
    }): string;
    /**
      * `Failed to create checkout session.`
      */
    ["error.FAILED_TO_CHECKOUT"](): string;
    /**
      * `Invalid checkout parameters provided.`
      */
    ["error.INVALID_CHECKOUT_PARAMETERS"](): string;
    /**
      * `You have already subscribed to the {{plan}} plan.`
      */
    ["error.SUBSCRIPTION_ALREADY_EXISTS"](options: {
        readonly plan: string;
    }): string;
    /**
      * `Invalid subscription parameters provided.`
      */
    ["error.INVALID_SUBSCRIPTION_PARAMETERS"](): string;
    /**
      * `You didn't subscribe to the {{plan}} plan.`
      */
    ["error.SUBSCRIPTION_NOT_EXISTS"](options: {
        readonly plan: string;
    }): string;
    /**
      * `Your subscription has already been canceled.`
      */
    ["error.SUBSCRIPTION_HAS_BEEN_CANCELED"](): string;
    /**
      * `Your subscription has not been canceled.`
      */
    ["error.SUBSCRIPTION_HAS_NOT_BEEN_CANCELED"](): string;
    /**
      * `Your subscription has expired.`
      */
    ["error.SUBSCRIPTION_EXPIRED"](): string;
    /**
      * `Your subscription has already been in {{recurring}} recurring state.`
      */
    ["error.SAME_SUBSCRIPTION_RECURRING"](options: {
        readonly recurring: string;
    }): string;
    /**
      * `Failed to create customer portal session.`
      */
    ["error.CUSTOMER_PORTAL_CREATE_FAILED"](): string;
    /**
      * `You are trying to access a unknown subscription plan.`
      */
    ["error.SUBSCRIPTION_PLAN_NOT_FOUND"](): string;
    /**
      * `You cannot update an onetime payment subscription.`
      */
    ["error.CANT_UPDATE_ONETIME_PAYMENT_SUBSCRIPTION"](): string;
    /**
      * `A workspace is required to checkout for team subscription.`
      */
    ["error.WORKSPACE_ID_REQUIRED_FOR_TEAM_SUBSCRIPTION"](): string;
    /**
      * `Workspace id is required to update team subscription.`
      */
    ["error.WORKSPACE_ID_REQUIRED_TO_UPDATE_TEAM_SUBSCRIPTION"](): string;
    /**
      * `This subscription is managed by App Store or Google Play. Please manage it in the corresponding store.`
      */
    ["error.MANAGED_BY_APP_STORE_OR_PLAY"](): string;
    /**
      * `Calendar provider request error, status: {{status}}, message: {{message}}`
      */
    ["error.CALENDAR_PROVIDER_REQUEST_ERROR"](options: Readonly<{
        status: string;
        message: string;
    }>): string;
    /**
      * `Copilot session not found.`
      */
    ["error.COPILOT_SESSION_NOT_FOUND"](): string;
    /**
      * `Copilot session input is invalid.`
      */
    ["error.COPILOT_SESSION_INVALID_INPUT"](): string;
    /**
      * `Copilot session has been deleted.`
      */
    ["error.COPILOT_SESSION_DELETED"](): string;
    /**
      * `No copilot provider available: {{modelId}}`
      */
    ["error.NO_COPILOT_PROVIDER_AVAILABLE"](options: {
        readonly modelId: string;
    }): string;
    /**
      * `Failed to generate text.`
      */
    ["error.COPILOT_FAILED_TO_GENERATE_TEXT"](): string;
    /**
      * `Failed to generate embedding with {{provider}}: {{message}}`
      */
    ["error.COPILOT_FAILED_TO_GENERATE_EMBEDDING"](options: Readonly<{
        provider: string;
        message: string;
    }>): string;
    /**
      * `Failed to create chat message.`
      */
    ["error.COPILOT_FAILED_TO_CREATE_MESSAGE"](): string;
    /**
      * `Unsplash is not configured.`
      */
    ["error.UNSPLASH_IS_NOT_CONFIGURED"](): string;
    /**
      * `Action has been taken, no more messages allowed.`
      */
    ["error.COPILOT_ACTION_TAKEN"](): string;
    /**
      * `Doc {{docId}} not found.`
      */
    ["error.COPILOT_DOC_NOT_FOUND"](options: {
        readonly docId: string;
    }): string;
    /**
      * `Some docs not found.`
      */
    ["error.COPILOT_DOCS_NOT_FOUND"](): string;
    /**
      * `Copilot message {{messageId}} not found.`
      */
    ["error.COPILOT_MESSAGE_NOT_FOUND"](options: {
        readonly messageId: string;
    }): string;
    /**
      * `Copilot prompt {{name}} not found.`
      */
    ["error.COPILOT_PROMPT_NOT_FOUND"](options: {
        readonly name: string;
    }): string;
    /**
      * `Copilot prompt is invalid.`
      */
    ["error.COPILOT_PROMPT_INVALID"](): string;
    /**
      * `Copilot provider {{provider}} does not support output type {{kind}}`
      */
    ["error.COPILOT_PROVIDER_NOT_SUPPORTED"](options: Readonly<{
        provider: string;
        kind: string;
    }>): string;
    /**
      * `Provider {{provider}} failed with {{kind}} error: {{message}}`
      */
    ["error.COPILOT_PROVIDER_SIDE_ERROR"](options: Readonly<{
        provider: string;
        kind: string;
        message: string;
    }>): string;
    /**
      * `Invalid copilot context {{contextId}}.`
      */
    ["error.COPILOT_INVALID_CONTEXT"](options: {
        readonly contextId: string;
    }): string;
    /**
      * `File {{fileName}} is not supported to use as context: {{message}}`
      */
    ["error.COPILOT_CONTEXT_FILE_NOT_SUPPORTED"](options: Readonly<{
        fileName: string;
        message: string;
    }>): string;
    /**
      * `Failed to modify context {{contextId}}: {{message}}`
      */
    ["error.COPILOT_FAILED_TO_MODIFY_CONTEXT"](options: Readonly<{
        contextId: string;
        message: string;
    }>): string;
    /**
      * `Failed to match context {{contextId}} with "%7B%7Bcontent%7D%7D": {{message}}`
      */
    ["error.COPILOT_FAILED_TO_MATCH_CONTEXT"](options: Readonly<{
        contextId: string;
        message: string;
    }>): string;
    /**
      * `Failed to match context in workspace {{workspaceId}} with "%7B%7Bcontent%7D%7D": {{message}}`
      */
    ["error.COPILOT_FAILED_TO_MATCH_GLOBAL_CONTEXT"](options: Readonly<{
        workspaceId: string;
        message: string;
    }>): string;
    /**
      * `Embedding feature is disabled, please contact the administrator to enable it in the workspace settings.`
      */
    ["error.COPILOT_EMBEDDING_DISABLED"](): string;
    /**
      * `Embedding feature not available, you may need to install pgvector extension to your database`
      */
    ["error.COPILOT_EMBEDDING_UNAVAILABLE"](): string;
    /**
      * `Transcription job already exists`
      */
    ["error.COPILOT_TRANSCRIPTION_JOB_EXISTS"](): string;
    /**
      * `Transcription job not found.`
      */
    ["error.COPILOT_TRANSCRIPTION_JOB_NOT_FOUND"](): string;
    /**
      * `Audio not provided.`
      */
    ["error.COPILOT_TRANSCRIPTION_AUDIO_NOT_PROVIDED"](): string;
    /**
      * `Failed to add workspace file embedding: {{message}}`
      */
    ["error.COPILOT_FAILED_TO_ADD_WORKSPACE_FILE_EMBEDDING"](options: {
        readonly message: string;
    }): string;
    /**
      * `No available AI provider is configured for this workspace. Contact your LocalMind instance administrator.`
      */
    ["error.COPILOT_BYOK_NOT_CONFIGURED"](): string;
    /**
      * `You have exceeded your blob size quota.`
      */
    ["error.BLOB_QUOTA_EXCEEDED"](): string;
    /**
      * `You have exceeded your storage quota.`
      */
    ["error.STORAGE_QUOTA_EXCEEDED"](): string;
    /**
      * `You have exceeded your workspace member quota.`
      */
    ["error.MEMBER_QUOTA_EXCEEDED"](): string;
    /**
      * `You have reached the limit of actions in this workspace, please upgrade your plan.`
      */
    ["error.COPILOT_QUOTA_EXCEEDED"](): string;
    /**
      * `Runtime config {{key}} not found.`
      */
    ["error.RUNTIME_CONFIG_NOT_FOUND"](options: {
        readonly key: string;
    }): string;
    /**
      * `Invalid runtime config type  for '{{key}}', want '{{want}}', but get {{get}}.`
      */
    ["error.INVALID_RUNTIME_CONFIG_TYPE"](options: Readonly<{
        key: string;
        want: string;
        get: string;
    }>): string;
    /**
      * `Mailer service is not configured.`
      */
    ["error.MAILER_SERVICE_IS_NOT_CONFIGURED"](): string;
    /**
      * `Cannot delete all admin accounts.`
      */
    ["error.CANNOT_DELETE_ALL_ADMIN_ACCOUNT"](): string;
    /**
      * `Cannot delete own account.`
      */
    ["error.CANNOT_DELETE_OWN_ACCOUNT"](): string;
    /**
      * `Cannot delete account. You are the owner of one or more team workspaces. Please transfer ownership or delete them first.`
      */
    ["error.CANNOT_DELETE_ACCOUNT_WITH_OWNED_TEAM_WORKSPACE"](): string;
    /**
      * `Captcha verification failed.`
      */
    ["error.CAPTCHA_VERIFICATION_FAILED"](): string;
    /**
      * `Invalid session id to generate license key.`
      */
    ["error.INVALID_LICENSE_SESSION_ID"](): string;
    /**
      * `License key has been revealed. Please check your mail box of the one provided during checkout.`
      */
    ["error.LICENSE_REVEALED"](): string;
    /**
      * `Workspace already has a license applied.`
      */
    ["error.WORKSPACE_LICENSE_ALREADY_EXISTS"](): string;
    /**
      * `License not found.`
      */
    ["error.LICENSE_NOT_FOUND"](): string;
    /**
      * `Invalid license to activate. {{reason}}`
      */
    ["error.INVALID_LICENSE_TO_ACTIVATE"](options: {
        readonly reason: string;
    }): string;
    /**
      * `Invalid license update params. {{reason}}`
      */
    ["error.INVALID_LICENSE_UPDATE_PARAMS"](options: {
        readonly reason: string;
    }): string;
    /**
      * `License has expired.`
      */
    ["error.LICENSE_EXPIRED"](): string;
    /**
      * `Unsupported client with version [{{clientVersion}}], required version is [{{requiredVersion}}].`
      */
    ["error.UNSUPPORTED_CLIENT_VERSION"](options: Readonly<{
        clientVersion: string;
        requiredVersion: string;
    }>): string;
    /**
      * `This LocalMind server is too old for this client. Please upgrade the server to {{requiredVersion}}.`
      */
    ["error.UNSUPPORTED_SERVER_VERSION"](options: {
        readonly requiredVersion: string;
    }): string;
    /**
      * `Notification not found.`
      */
    ["error.NOTIFICATION_NOT_FOUND"](): string;
    /**
      * `Mentioned user can not access doc {{docId}}.`
      */
    ["error.MENTION_USER_DOC_ACCESS_DENIED"](options: {
        readonly docId: string;
    }): string;
    /**
      * `You can not mention yourself.`
      */
    ["error.MENTION_USER_ONESELF_DENIED"](): string;
    /**
      * `Invalid app config for module `{{module}}` with key `{{key}}`. {{hint}}.`
      */
    ["error.INVALID_APP_CONFIG"](options: Readonly<{
        module: string;
        key: string;
        hint: string;
    }>): string;
    /**
      * `Invalid app config input: {{message}}`
      */
    ["error.INVALID_APP_CONFIG_INPUT"](options: {
        readonly message: string;
    }): string;
    /**
      * `Search provider not found.`
      */
    ["error.SEARCH_PROVIDER_NOT_FOUND"](): string;
    /**
      * `Invalid request argument to search provider: {{reason}}`
      */
    ["error.INVALID_SEARCH_PROVIDER_REQUEST"](options: {
        readonly reason: string;
    }): string;
    /**
      * `Invalid indexer input: {{reason}}`
      */
    ["error.INVALID_INDEXER_INPUT"](options: {
        readonly reason: string;
    }): string;
    /**
      * `Comment not found.`
      */
    ["error.COMMENT_NOT_FOUND"](): string;
    /**
      * `Reply not found.`
      */
    ["error.REPLY_NOT_FOUND"](): string;
    /**
      * `Comment attachment not found.`
      */
    ["error.COMMENT_ATTACHMENT_NOT_FOUND"](): string;
    /**
      * `You have exceeded the comment attachment size quota.`
      */
    ["error.COMMENT_ATTACHMENT_QUOTA_EXCEEDED"](): string;
    /**
      * - com.affine.office.page-count_one: `{{count}} page`

      * - com.affine.office.page-count_other: `{{count}} pages`
      */
    ["com.affine.office.page-count"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * - com.affine.office.pdf-page-label_other: `PDF page {{number}}, {{count}} annotations`

      * - com.affine.office.pdf-page-label_one: `PDF page {{number}}, {{count}} annotation`

      * - com.affine.office.pdf-page-label_zero: `PDF page {{number}}, no annotations`
      */
    ["com.affine.office.pdf-page-label"](options: Readonly<{
        number: (string & string) & string;
        count?: string | number | bigint;
    }>): string;
    /**
      * - com.affine.office.tracked-change-count_one: `{{count}} tracked change`

      * - com.affine.office.tracked-change-count_other: `{{count}} tracked changes`
      */
    ["com.affine.office.tracked-change-count"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * - com.affine.admin.import-preview-count_one: `{{count}} user detected in the CSV file. Confirm the list below to import.`

      * - com.affine.admin.import-preview-count_other: `{{count}} users detected in the CSV file. Confirm the list below to import.`
      */
    ["com.affine.admin.import-preview-count"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * - com.affine.office.comment-count_other: `{{count}} package comments`

      * - com.affine.office.comment-count_one: `{{count}} package comment`
      */
    ["com.affine.office.comment-count"](options: {
        readonly count: string | number | bigint;
    }): string;
} { const { t } = useTranslation(); return useMemo(() => createProxy((key) => t.bind(null, key)), [t]); }
function createComponent(i18nKey: string) {
    return (props) => createElement(Trans, { i18nKey, shouldUnescape: true, ...props });
}
export const TypedTrans: {
    /**
      * `Go to <a>{{link}}</a> for learn more details about LocalMind AI.`
      */
    ["com.affine.ai-onboarding.general.5.description"]: ComponentType<TypedTransProps<{
        readonly link: string;
    }, {
        a: JSX.Element;
    }>>;
    /**
      * `By continuing, you are agreeing to our <a>AI Terms</a>.`
      */
    ["com.affine.ai-onboarding.general.privacy"]: ComponentType<TypedTransProps<Readonly<{}>, {
        a: JSX.Element;
    }>>;
    /**
      * `Opening <1>LocalMind</1> app now`
      */
    ["com.affine.auth.open.affine.prompt"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `This doc is now opened in <1>LocalMind</1> app`
      */
    ["com.affine.auth.open.affine.open-doc-prompt"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `To continue signing in, please enter the code that was sent to <a>{{email}}</a>.`
      */
    ["com.affine.auth.sign.auth.code.hint"]: ComponentType<TypedTransProps<{
        readonly email: string;
    }, {
        a: JSX.Element;
    }>>;
    /**
      * `Or <1>sign in with password</1> instead.`
      */
    ["com.affine.auth.sign.auth.code.message.password"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `This is an LocalMind server hosted by you or your team. After signing in, workspace data is saved to the LocalMind server you enter, not to LocalMind Cloud. <1>Learn more about self-hosting.</1>`
      */
    ["com.affine.auth.sign.add-selfhosted.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `By clicking “Continue with Google/Email” above, you acknowledge that you agree to LocalMind's <1>Terms of Conditions</1> and <3>Privacy Policy</3>.`
      */
    ["com.affine.auth.sign.message"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
        ["3"]: JSX.Element;
    }>>;
    /**
      * `This demo is limited. <1>Download the LocalMind Client</1> for the latest features and Performance.`
      */
    ["com.affine.banner.content"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> selected`

      * - com.affine.collection.toolbar.selected_one: `<0>{{count}}</0> collection selected`

      * - com.affine.collection.toolbar.selected_other: `<0>{{count}}</0> collection(s) selected`
      */
    ["com.affine.collection.toolbar.selected"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> collection selected`
      */
    ["com.affine.collection.toolbar.selected_one"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> collection(s) selected`
      */
    ["com.affine.collection.toolbar.selected_other"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> collection(s) selected`
      */
    ["com.affine.collection.toolbar.selected_others"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `Deleting <1>{{tag}}</1> cannot be undone, please proceed with caution.`
      */
    ["com.affine.delete-tags.confirm.description"]: ComponentType<TypedTransProps<{
        readonly tag: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Selected <1>{{selectedCount}}</1>, filtered <3>{{filteredCount}}</3>`
      */
    ["com.affine.editCollection.rules.countTips"]: ComponentType<TypedTransProps<Readonly<{
        selectedCount: string;
        filteredCount: string;
    }>, {
        ["1"]: JSX.Element;
        ["3"]: JSX.Element;
    }>>;
    /**
      * `Showing <1>{{count}}</1> docs.`
      */
    ["com.affine.editCollection.rules.countTips.more"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Showing <1>{{count}}</1> doc.`
      */
    ["com.affine.editCollection.rules.countTips.one"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Showing <1>{{count}}</1> docs.`
      */
    ["com.affine.editCollection.rules.countTips.zero"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Please <1>add rules</1> to save this collection or switch to <3>Docs</3>, use manual selection mode`
      */
    ["com.affine.editCollection.rules.empty.noRules.tips"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
        ["3"]: JSX.Element;
    }>>;
    /**
      * `Docs that meet the rules will be added to the current collection <2>{{highlight}}</2>`
      */
    ["com.affine.editCollection.rules.tips"]: ComponentType<TypedTransProps<{
        readonly highlight: string;
    }, {
        ["2"]: JSX.Element;
    }>>;
    /**
      * `If you are still experiencing this issue, please <1>contact us through the community</1>.`
      */
    ["com.affine.error.contact-us"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `With the workspace creator's free account, every member can access up to <1>7 days<1> of version history.`
      */
    ["com.affine.history.confirm-restore-modal.free-plan-prompt.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `With the workspace creator's Pro account, every member enjoys the privilege of accessing up to <1>30 days<1> of version history.`
      */
    ["com.affine.history.confirm-restore-modal.pro-plan-prompt.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> selected`

      * - com.affine.page.toolbar.selected_one: `<0>{{count}}</0> doc selected`

      * - com.affine.page.toolbar.selected_other: `<0>{{count}}</0> doc(s) selected`
      */
    ["com.affine.page.toolbar.selected"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> doc selected`
      */
    ["com.affine.page.toolbar.selected_one"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> doc(s) selected`
      */
    ["com.affine.page.toolbar.selected_other"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> doc(s) selected`
      */
    ["com.affine.page.toolbar.selected_others"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `You are currently on the <a>free plan</a>.`
      */
    ["com.affine.payment.billing-setting.ai.free-desc"]: ComponentType<TypedTransProps<Readonly<{}>, {
        a: JSX.Element;
    }>>;
    /**
      * `You have purchased <a>Believer plan</a>. Enjoy with your benefits!`
      */
    ["com.affine.payment.billing-setting.believer.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        a: JSX.Element;
    }>>;
    /**
      * `You are currently on the <1>{{planName}} plan</1>.`
      */
    ["com.affine.payment.billing-setting.current-plan.description"]: ComponentType<TypedTransProps<{
        readonly planName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `You are currently on the believer <1>{{planName}} plan</1>.`
      */
    ["com.affine.payment.billing-setting.current-plan.description.lifetime"]: ComponentType<TypedTransProps<{
        readonly planName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `You are currently on the monthly <1>{{planName}} plan</1>.`
      */
    ["com.affine.payment.billing-setting.current-plan.description.monthly"]: ComponentType<TypedTransProps<{
        readonly planName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `You are currently on the annually <1>{{planName}} plan</1>.`
      */
    ["com.affine.payment.billing-setting.current-plan.description.yearly"]: ComponentType<TypedTransProps<{
        readonly planName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `One-time Purchase. Personal use rights for up to 150 years. <a>Fair Usage Policies</a> may apply.`
      */
    ["com.affine.payment.lifetime.caption-2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        a: JSX.Element;
    }>>;
    /**
      * `You are currently on the {{currentPlan}} plan. If you have any questions, please contact our <3>customer support</3>.`
      */
    ["com.affine.payment.subtitle-active"]: ComponentType<TypedTransProps<{
        readonly currentPlan: string;
    }, {
        ["3"]: JSX.Element;
    }>>;
    /**
      * `If you have any questions, please contact our <1> customer support</1>.`
      */
    ["com.affine.payment.upgrade-success-page.support"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `If you have any questions, please contact our <1>customer support</1>.`
      */
    ["com.affine.payment.upgrade-success-page.team.text-2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `If you have any questions, please contact our <1>customer support</1>.`
      */
    ["com.affine.payment.license-success.text-2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `This action deletes the old Favorites section. <b>Your documents are safe</b>, ensure you've moved your frequently accessed documents to the new personal Favorites section.`
      */
    ["com.affine.rootAppSidebar.migration-data.clean-all.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        b: JSX.Element;
    }>>;
    /**
      * `<b>Your documents are safe</b>, but you'll need to re-pin your most-used ones. "Favorites" are now personal. Move items from the old shared section to your new personal section or remove the old one by clicking "Empty the old favorites" now.`
      */
    ["com.affine.rootAppSidebar.migration-data.help.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        b: JSX.Element;
    }>>;
    /**
      * `No doc titles contain <1>{{search}}</1>`
      */
    ["com.affine.selectPage.empty.tips"]: ComponentType<TypedTransProps<{
        readonly search: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Are you sure you want to delete your account from <1>{{server}}</1>?`
      */
    ["com.affine.setting.account.delete.confirm-delete-description-1"]: ComponentType<TypedTransProps<{
        readonly server: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Your account will be inaccessible, and your personal space on the server will be permanently deleted. You can remove local data by uninstalling the app or clearing your browser storage. <1>This action is irreversible.</1>`
      */
    ["com.affine.setting.account.delete.confirm-delete-description-2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Don't have the app? <1>Click to download</1>.`
      */
    ["com.affine.open-in-app.card.subtitle"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Settings changed; please restart the app. <1>Restart</1>`
      */
    ["com.affine.settings.editorSettings.general.spell-check.restart-hint"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Love our app? <1>Star us on GitHub</1> and <2>create issues</2> for your valuable feedback!`
      */
    ["com.affine.settings.suggestion-2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `Meeting Features Available <strong>Free</strong> in Beta Phase`
      */
    ["com.affine.settings.meetings.setting.prompt.2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        strong: JSX.Element;
    }>>;
    /**
      * `<strong>Where AI meets your meetings - refine your collaboration.</strong>
    <ul><li>Extract Action Items & Key Insights Instantly</li><li>Smart Auto-Capture Starts With Your Meeting</li><li>Seamless Integration Across All Meeting Platforms</li><li>One Unified Space for All Your Meeting's Context</li><li>Your AI Assistant with Every Meeting Context Preserved</li></ul>`
      */
    ["com.affine.settings.meetings.setting.welcome.hints"]: ComponentType<TypedTransProps<Readonly<{}>, {
        strong: JSX.Element;
        ul: JSX.Element;
        li: JSX.Element;
    }>>;
    /**
      * `Utilize the meeting notes and AI summarization features provided by LocalMind. <1>Discuss more in the community</1>.`
      */
    ["com.affine.settings.meetings.enable.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Activate using the local key from <1>Infinimesh</1>`
      */
    ["com.affine.settings.workspace.license.self-host-team.team.license"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Copy your workspace id and <1>reach out to us</1>.`
      */
    ["com.affine.settings.workspace.license.self-host-team.upload-license-file.tips.content"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `If you encounter any issues, contact LocalMind support. No license yet? <1>Click to purchase</1>.`
      */
    ["com.affine.settings.workspace.license.activate-modal.tips"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `This will make the workspace read-only. Your key remains usable elsewhere. Deactivation doesn't cancel your Team plan. To cancel, go to <1>Manage Payment</1>.`
      */
    ["com.affine.settings.workspace.license.deactivate-modal.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `The "<1>{{ name }}</1>" property will be removed. This action cannot be undone.`
      */
    ["com.affine.settings.workspace.properties.delete-property-desc"]: ComponentType<TypedTransProps<{
        readonly name: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> doc`
      */
    ["com.affine.settings.workspace.properties.doc"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> docs`
      */
    ["com.affine.settings.workspace.properties.doc_others"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `Manage workspace <1>{{name}}</1> properties`
      */
    ["com.affine.settings.workspace.properties.header.subtitle"]: ComponentType<TypedTransProps<{
        readonly name: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> selected`

      * - com.affine.tag.toolbar.selected_one: `<0>{{count}}</0> tag selected`

      * - com.affine.tag.toolbar.selected_other: `<0>{{count}}</0> tag(s) selected`
      */
    ["com.affine.tag.toolbar.selected"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> tag selected`
      */
    ["com.affine.tag.toolbar.selected_one"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> tag(s) selected`
      */
    ["com.affine.tag.toolbar.selected_other"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> tag(s) selected`
      */
    ["com.affine.tag.toolbar.selected_others"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `Deleting <1>{{workspace}}</1> cannot be undone, please proceed with caution. All contents will be lost.`
      */
    ["com.affine.workspaceDelete.description"]: ComponentType<TypedTransProps<{
        readonly workspace: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Deleting <1>{{workspace}}</1> will delete both local data and synced server data. This cannot be undone, so please proceed with caution.`
      */
    ["com.affine.workspaceDelete.description2"]: ComponentType<TypedTransProps<{
        readonly workspace: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * ` We recommend the <1>Chrome</1> browser for optimal experience.`
      */
    recommendBrowser: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Are you sure you want to upgrade <1>{{workspaceName}}</1> to a Team Workspace? This will allow unlimited members to collaborate in this workspace.`
      */
    ["com.affine.upgrade-to-team-page.upgrade-confirm.description"]: ComponentType<TypedTransProps<{
        readonly workspaceName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> mentioned you in <2>{{docTitle}}</2>`
      */
    ["com.affine.notification.mention"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        docTitle: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> commented in <2>{{docTitle}}</2>`
      */
    ["com.affine.notification.comment"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        docTitle: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> mentioned you in a comment in <2>{{docTitle}}</2>`
      */
    ["com.affine.notification.comment-mention"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        docTitle: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> has accepted your invitation`
      */
    ["com.affine.notification.invitation-accepted"]: ComponentType<TypedTransProps<{
        readonly username: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> has requested to join <2>{{workspaceName}}</2>`
      */
    ["com.affine.notification.invitation-review-request"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        workspaceName: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> has declined your request to join <2>{{workspaceName}}</2>`
      */
    ["com.affine.notification.invitation-review-declined"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        workspaceName: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> has approved your request to join <2>{{workspaceName}}</2>`
      */
    ["com.affine.notification.invitation-review-approved"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        workspaceName: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `There is an issue regarding your invitation to <1>{{workspaceName}}</1> `
      */
    ["com.affine.notification.invitation-blocked"]: ComponentType<TypedTransProps<{
        readonly workspaceName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> invited you to join <2>{{workspaceName}}</2>`
      */
    ["com.affine.notification.invitation"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        workspaceName: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `Unable to join <1/> <2>{{workspaceName}}</2> due to insufficient seats available.`
      */
    ["com.affine.fail-to-join-workspace.description-1"]: ComponentType<TypedTransProps<{
        readonly workspaceName: string;
    }, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `You requested to join <1/> <2>{{workspaceName}}</2> with <3>{{userEmail}}</3>, the workspace owner and team admins will review your request.`
      */
    ["com.affine.sent-request-to-join-workspace.description"]: ComponentType<TypedTransProps<Readonly<{
        workspaceName: string;
        userEmail: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
        ["3"]: JSX.Element;
    }>>;
    /**
      * `Unable to process your request to join <1/> <2>{{workspaceName}}</2> with <3>{{userEmail}}</3>, the workspace has reached its member limit. Please contact the workspace owner for available seats.`
      */
    ["com.affine.failed-to-send-request.description"]: ComponentType<TypedTransProps<Readonly<{
        workspaceName: string;
        userEmail: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
        ["3"]: JSX.Element;
    }>>;
    /**
      * `Import your Readwise highlights to LocalMind. Please visit Readwise, <br />click <a>"Get Access Token"</a>, and paste the token below.`
      */
    ["com.affine.integration.readwise.connect.desc"]: ComponentType<TypedTransProps<Readonly<{}>, {
        br: JSX.Element;
        a: JSX.Element;
    }>>;
    /**
      * `Updates to be imported since last successful import on {{lastImportedAt}} <a>Import everything instead</a>`
      */
    ["com.affine.integration.readwise.import.desc-from-last"]: ComponentType<TypedTransProps<{
        readonly lastImportedAt: string;
    }, {
        a: JSX.Element;
    }>>;
    /**
      * `Please contact <1>{{user}}</1> to upgrade AI rights or resend the attachment.`
      */
    ["com.affine.audio.transcribe.non-owner.confirm.message"]: ComponentType<TypedTransProps<{
        readonly user: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Enable the account? The email <strong>{{email}}</strong> can then be used to log in.`
      */
    ["com.affine.admin.enable-account-description"]: ComponentType<TypedTransProps<{
        readonly email: string;
    }, {
        strong: JSX.Element;
    }>>;
    /**
      * `<strong>{{email}}</strong> will be permanently deleted. This operation is irreversible. Please proceed with caution.`
      */
    ["com.affine.admin.delete-account-description"]: ComponentType<TypedTransProps<{
        readonly email: string;
    }, {
        strong: JSX.Element;
    }>>;
    /**
      * `The data associated with <strong>{{email}}</strong> will be deleted and the account cannot be used for logging in. This operation is irreversible. Please proceed with caution.`
      */
    ["com.affine.admin.disable-account-description"]: ComponentType<TypedTransProps<{
        readonly email: string;
    }, {
        strong: JSX.Element;
    }>>;
} = /*#__PURE__*/ createProxy(createComponent);
