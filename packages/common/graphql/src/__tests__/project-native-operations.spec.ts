/// <reference types="vite/client" />

import { buildSchema, parse, validate } from 'graphql';
import { expect, test } from 'vitest';

import serverSchema from '../../../../backend/server/src/schema.gql?raw';
import * as operations from '../graphql';

const schema = buildSchema(serverSchema);

test.each(
  Object.values(operations)
    .filter(operation => typeof operation !== 'string')
    .filter(operation => /project/i.test(operation.id))
)(
  '$id sends a complete executable operation including its fragments',
  operation => {
    expect(
      validate(schema, parse(operation.query)).map(error => error.message)
    ).toEqual([]);
  }
);
