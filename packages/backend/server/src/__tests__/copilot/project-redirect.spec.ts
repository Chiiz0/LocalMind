import test from 'ava';
import express from 'express';
import request from 'supertest';

import { registerProjectRedirects } from '../../core/project/redirect';

test('legacy Project URLs permanently redirect with resource identity and deployment prefix', async t => {
  const app = express();
  registerProjectRedirects(app, '/localmind');
  for (const path of [
    '/chat',
    '/intelligence',
    '/workspace/old/chat',
    '/workspace/old/intelligence',
  ]) {
    const result = await request(app)
      .get(`/localmind${path}?project=p%2F1&resource=r%202&fileRequest=request`)
      .expect(301);
    t.is(
      result.headers.location,
      '/localmind/project/p%2F1/resources/r%202?fileRequest=request'
    );
    const pathResult = await request(app)
      .get(`/localmind${path}/p/resources/r?project=ignored`)
      .expect(301);
    t.is(pathResult.headers.location, '/localmind/project/p/resources/r');
  }
  await request(app).get('/localmind/intelligence-other').expect(404);
  const result = await request(app)
    .get('/localmind/chat?resource=orphan')
    .expect(301);
  t.is(result.headers.location, '/localmind/project');
});
