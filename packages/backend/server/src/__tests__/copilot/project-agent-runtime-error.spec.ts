import test from 'ava';

import { AccessDenied } from '../../base';
import { projectTaskFailure } from '../../plugins/copilot/project-agent-runtime-error';

test('task failures distinguish recoverable database timeouts without exposing exception messages', t => {
  const error = Object.assign(
    new Error(
      'Transaction already closed: expired transaction. private source content and credentials\n    at private source content'
    ),
    { code: 'P2028' }
  );
  const result = projectTaskFailure(error);
  t.is(result.code, 'project_operation_timeout');
  t.is(result.diagnostic.errorCode, 'P2028');
  t.false(JSON.stringify(result).includes('private source'));
  t.is(
    projectTaskFailure(new AccessDenied()).code,
    'project_operation_permission_denied'
  );
  t.is(
    projectTaskFailure(new Error('private source')).code,
    'project_operation_failed'
  );
});
