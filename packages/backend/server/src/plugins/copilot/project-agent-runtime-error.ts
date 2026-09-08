import { UserFriendlyError } from '../../base';
import { ProjectPublicationConflict } from '../../core/project-transfer';

export function projectTaskFailure(error: unknown) {
  const header =
    error instanceof Error ? `${error.name}: ${error.message}\n` : '';
  const stack =
    error instanceof Error && error.stack?.startsWith(header)
      ? error.stack.slice(header.length)
      : undefined;
  const errorCode =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^P\d{4}$/.test(error.code)
      ? error.code
      : undefined;
  const code =
    error instanceof ProjectPublicationConflict
      ? 'publication_conflict'
      : (errorCode && ['P2024', 'P1008'].includes(errorCode)) ||
          (errorCode === 'P2028' &&
            error instanceof Error &&
            /expired transaction|timed out|timeout/i.test(error.message))
        ? 'project_operation_timeout'
        : errorCode === 'P2034'
          ? 'project_operation_conflict'
          : error instanceof UserFriendlyError &&
              [401, 403].includes(error.status)
            ? 'project_operation_permission_denied'
            : error instanceof UserFriendlyError && error.status === 404
              ? 'project_operation_source_unavailable'
              : 'project_operation_failed';
  return {
    code,
    message:
      error instanceof ProjectPublicationConflict
        ? error.message
        : 'Project operation could not execute; review membership, resource versions and tool availability',
    // Record bounded call sites, excluding the entire exception message (including newlines).
    diagnostic: {
      code,
      errorCode,
      errorType:
        error instanceof Error &&
        /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(error.name)
          ? error.name
          : 'UnknownError',
      frames: stack
        ?.split('\n')
        .filter(line => /^\s+at /.test(line))
        .slice(0, 6)
        .map(line => line.slice(0, 240)),
    },
  };
}
