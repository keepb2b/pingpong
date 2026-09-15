const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript, deferred, createSupabase } = require('./helpers.cjs');

const event = {
  type: 'message',
  replyToken: 'single-use-reply',
  source: { type: 'user', userId: 'line-user-1' },
  message: { id: 'message-1', type: 'text', text: 'The launch takes place on Friday.' },
};

function fixture(options = {}) {
  const calls = [];
  const unexpected = [];
  const queries = [];
  const account = { id: 'account-1', org_id: 'org-1', user_id: 'user-1', active_subject_id: 'subject-1' };
  const conversation = { id: 'conversation-1', question_index: 2, topic: options.topic ?? null };
  const fail = (label) => {
    unexpected.push(label);
    throw new Error(`Unexpected service call: ${label}`);
  };
  const sb = createSupabase((query) => {
    queries.push(query);
    calls.push(`${query.table}:${query.operation}`);
    if (options.failAt === `${query.table}:${query.operation}`) {
      return { data: null, error: new Error('Database unavailable') };
    }
    if (query.table === 'line_accounts' && query.operation === 'select') return { data: account };
    if (query.table === 'messages' && query.operation === 'select') {
      if (query.filters.some((filter) => filter.method === 'contains')) {
        assert.deepEqual(query.filters.find((filter) => filter.method === 'contains').args, [
          'meta', { line_message_id: 'message-1' },
        ]);
        return { data: options.received ? { id: 'stored-message' } : null };
      }
      return { data: [
        { role: 'user', content: event.message.text },
        { role: 'assistant', content: 'When is the launch?' },
        { role: 'user', content: 'We have a launch.' },
      ] };
    }
    if (query.table === 'messages' && query.operation === 'insert') return { error: null };
    if (query.table === 'conversations' && query.operation === 'select') return { data: conversation };
    if (query.table === 'conversations' && query.operation === 'update') {
      assert.ok(query.filters.some((filter) => filter.method === 'eq' && filter.args[0] === 'status' && filter.args[1] === 'open'));
      return { data: options.alreadyClosed ? null : { id: conversation.id } };
    }
    if (query.table === 'dialogue_settings' && query.operation === 'select') {
      return { data: { max_questions_per_session: 5 } };
    }
    if (query.table === 'intake_items' && query.operation === 'select') return { data: options.existingIntake ?? null };
    if (query.table === 'intake_items' && query.operation === 'insert') return { data: { id: 'intake-1' } };
    if (query.table === 'intake_items' && query.operation === 'update') return { error: null };
    if (query.table === 'media_assets' && query.operation === 'insert' && options.attachment) return { error: null };
    return fail(`${query.table}:${query.operation}`);
  });
  sb.storage = {
    from(bucket) {
      assert.equal(bucket, 'pr-media');
      if (!options.attachment) return fail('storage');
      return {
        async upload(path, buffer, metadata) {
          calls.push('upload');
          assert.match(path, /^org-1\/subject-1\/\d+-message-1\.png$/);
          assert.equal(metadata.contentType, 'image/png');
          assert.ok(buffer.byteLength > 0);
          return { error: null };
        },
        getPublicUrl() { return { data: { publicUrl: options.attachment } }; },
      };
    },
  };
  const replies = [];
  const productions = [];
  const notifications = [];
  const interviews = [];
  const turn = options.turn ?? { complete: true, reply: 'Secretary completion text', extracted: { title: 'Product launch', facts: [] } };
  const handler = loadTypeScript('src/app/api/line/webhook/handle-events.ts', {
    '@/lib/supabase/admin': { supabaseAdmin: () => sb },
    '@/lib/line': {
      textMessage: (text) => ({ type: 'text', text }),
      async replyMessage(token, messages) {
        calls.push('reply:start');
        replies.push({ token, messages });
        await options.reply?.();
        calls.push('reply:end');
      },
      async getMessageContent(messageId) {
        if (!options.attachment) return fail('getMessageContent');
        assert.equal(messageId, 'message-1');
        return { buffer: Buffer.from('mock image'), contentType: 'image/png' };
      },
      getProfile: () => fail('getProfile'),
      quickReply: () => fail('quickReply'),
      proposalFlex: () => fail('proposalFlex'),
    },
    '@/lib/agents/secretary': {
      async secretaryInterview(input) { calls.push('interview'); interviews.push(input); return turn; },
    },
    '@/lib/agents/orchestrator': {
      async produceFromIntake(input) {
        calls.push('produce');
        productions.push(input);
        return await options.produce?.();
      },
      async notify(input) {
        calls.push('notify');
        notifications.push(input);
        return await options.notify?.();
      },
      approveContent: () => fail('approveContent'),
    },
    '@/lib/tracking': { appUrl: (path = '') => `https://app.example${path}` },
    '@/lib/constants': { CHANNEL_LABEL: {} },
  });
  return {
    ...handler, calls, queries, replies, productions, notifications, interviews,
    assertNoUnexpected() { assert.deepEqual(unexpected, []); },
  };
}

test('complete interview persists and closes before acknowledgement, then awaits production for the exact intake and recipient', async () => {
  const replyStarted = deferred();
  const releaseReply = deferred();
  const productionStarted = deferred();
  const releaseProduction = deferred();
  const f = fixture({
    reply: () => { replyStarted.resolve(); return releaseReply.promise; },
    produce: () => { productionStarted.resolve(); return releaseProduction.promise; },
  });
  let settled = false;
  const work = f.processLineEvents([event]).then(() => { settled = true; });
  await replyStarted.promise;
  assert.deepEqual(f.productions, []);
  assert.equal(settled, false);
  const intake = f.queries.find((query) => query.table === 'intake_items' && query.operation === 'insert');
  assert.equal(intake.values.conversation_id, 'conversation-1');
  assert.equal(intake.values.subject_id, 'subject-1');
  assert.equal(intake.values.org_id, 'org-1');
  assert.equal(intake.values.raw_text, event.message.text);
  const closed = f.queries.find((query) => query.table === 'conversations' && query.operation === 'update');
  assert.equal(closed.values.status, 'closed');
  assert.equal(closed.values.pending_question, null);
  assert.equal(f.replies[0].token, event.replyToken);
  assert.match(f.replies[0].messages[0].text, /広報案を作成/);
  assert.match(f.replies[0].messages[0].text, /承認カード/);
  assert.equal(f.calls.indexOf('intake_items:insert') < f.calls.indexOf('reply:start'), true);
  assert.equal(f.calls.indexOf('conversations:update') < f.calls.indexOf('reply:start'), true);
  releaseReply.resolve();
  await productionStarted.promise;
  assert.deepEqual(f.productions, [{ intakeItemId: 'intake-1', orgId: 'org-1', subjectId: 'subject-1', lineUserId: 'line-user-1' }]);
  assert.equal(f.calls.indexOf('reply:end') < f.calls.indexOf('produce'), true);
  assert.equal(settled, false, 'webhook processing must remain pending until production finishes');
  releaseProduction.resolve();
  await work;
  assert.equal(settled, true);
  assert.equal(f.replies.length, 1);
  assert.equal(f.notifications.length, 0);
  assert.deepEqual(f.interviews[0].history, [
    { role: 'user', content: 'We have a launch.' },
    { role: 'assistant', content: 'When is the launch?' },
  ]);
  f.assertNoUnexpected();
});

test('unfinished interview saves details without a title and asks the next question without producing', async () => {
  const f = fixture({ turn: { complete: false, reply: 'Who is the audience?', extracted: { facts: [{ key: 'date', value: 'Friday' }] } } });
  await f.processLineEvents([event]);
  assert.equal(f.replies.length, 1);
  assert.equal(f.replies[0].messages[0].text, 'Who is the audience?');
  assert.deepEqual(f.productions, []);
  const intake = f.queries.find((query) => query.table === 'intake_items' && query.operation === 'insert');
  assert.deepEqual(intake.values.structured.facts, [{ key: 'date', value: 'Friday' }]);
  const conversation = f.queries.find((query) => query.table === 'conversations' && query.operation === 'update');
  assert.equal(conversation.values.status, 'open');
  assert.equal(conversation.values.question_index, 3);
  assert.equal(conversation.values.pending_question, 'Who is the audience?');
  f.assertNoUnexpected();
});

test('production failure sends a LINE error notification and never reuses the reply token', async () => {
  const f = fixture({ produce: async () => { throw new Error('Production failed'); } });
  await f.processLineEvents([event]);
  assert.equal(f.replies.length, 1);
  assert.equal(f.productions.length, 1);
  assert.equal(f.notifications.length, 1);
  assert.equal(f.notifications[0].kind, 'error');
  assert.equal(f.notifications[0].orgId, 'org-1');
  assert.equal(f.notifications[0].subjectId, 'subject-1');
  assert.equal(f.notifications[0].lineUserId, 'line-user-1');
  assert.equal(f.notifications[0].toLine, true);
  assert.equal(f.notifications[0].link, undefined);
  assert.equal(f.calls.indexOf('produce') < f.calls.indexOf('notify'), true);
  f.assertNoUnexpected();
});

test('failure to send the acknowledgement does not discard a persisted promotion request', async () => {
  const f = fixture({ reply: async () => { throw new Error('Reply token expired'); } });
  await f.processLineEvents([event]);
  assert.equal(f.replies.length, 1);
  assert.equal(f.productions.length, 1);
  f.assertNoUnexpected();
});

test('failure notification errors do not fall through to reuse the acknowledgement token', async () => {
  const f = fixture({
    produce: async () => { throw new Error('Production failed'); },
    notify: async () => { throw new Error('Push failed'); },
  });
  await f.processLineEvents([event]);
  assert.equal(f.replies.length, 1);
  assert.equal(f.notifications.length, 1);
  f.assertNoUnexpected();
});

for (const failAt of ['messages:insert', 'intake_items:select', 'intake_items:insert', 'conversations:update']) {
  test(`persistence failure at ${failAt} prevents production`, async () => {
    const f = fixture({ failAt });
    await f.processLineEvents([event]);
    assert.deepEqual(f.productions, []);
    assert.equal(f.replies.length, 1);
    assert.doesNotMatch(f.replies[0].messages[0].text, /広報案を作成/);
    f.assertNoUnexpected();
  });
}

test('later turns preserve prior facts, attachments, raw details and non-disclosure while updating known facts', async () => {
  const f = fixture({
    existingIntake: {
      id: 'saved-intake', raw_text: 'Earlier private details', disclosable: false,
      structured: {
        summary: 'Original summary',
        facts: [{ key: 'date', value: 'Friday' }, { key: 'venue', value: 'Old venue' }],
        assets: ['https://assets.example/first.png'], missing: ['audience'],
      },
    },
    attachment: 'https://assets.example/second.png',
    turn: { complete: true, reply: 'Ready', extracted: { facts: [{ key: 'venue', value: 'New venue' }] } },
  });
  await f.processLineEvents([{ ...event, message: { id: 'message-1', type: 'image' } }]);
  const update = f.queries.find((query) => query.table === 'intake_items' && query.operation === 'update');
  assert.deepEqual(update.values.structured.facts, [{ key: 'date', value: 'Friday' }, { key: 'venue', value: 'New venue' }]);
  assert.deepEqual(update.values.structured.assets, ['https://assets.example/first.png', 'https://assets.example/second.png']);
  assert.deepEqual(update.values.structured.missing, ['audience']);
  assert.equal(update.values.structured.summary, 'Original summary');
  assert.equal(update.values.disclosable, false);
  assert.match(update.values.raw_text, /^Earlier private details\n/);
  assert.equal(f.productions[0].intakeItemId, 'saved-intake');
  f.assertNoUnexpected();
});

test('redelivered messages do not run another interview or generate another promotion', async () => {
  const f = fixture({ received: true });
  await f.processLineEvents([event]);
  assert.deepEqual(f.interviews, []);
  assert.deepEqual(f.productions, []);
  assert.deepEqual(f.replies, []);
  assert.equal(f.queries.some((query) => query.operation !== 'select'), false);
  f.assertNoUnexpected();
});

for (const acknowledgement of ['ありがとうございます', 'Thank you!', '了解です🙏']) {
  test(`acknowledgement ${JSON.stringify(acknowledgement)} stays out of the promotion pipeline`, async () => {
    const f = fixture();
    await f.processLineEvents([{ ...event, message: { ...event.message, text: acknowledgement } }]);
    assert.deepEqual(f.interviews, []);
    assert.deepEqual(f.productions, []);
    assert.equal(f.replies.length, 1);
    assert.match(f.replies[0].messages[0].text, /どういたしまして/);
    assert.equal(f.queries.some((query) => query.table === 'conversations'), false);
    f.assertNoUnexpected();
  });
}

test('revision instructions stay attached to the selected proposal and do not create a new promotion', async () => {
  const f = fixture({ topic: 'revise:content-42' });
  await f.processLineEvents([{ ...event, message: { ...event.message, text: 'Please make the title shorter.' } }]);
  assert.deepEqual(f.interviews, []);
  assert.deepEqual(f.productions, []);
  assert.equal(f.replies.length, 1);
  assert.match(f.replies[0].messages[0].text, /修正内容を承りました/);
  const saved = f.queries.find((query) => query.table === 'messages' && query.operation === 'insert');
  assert.equal(saved.values.meta.revise_content_id, 'content-42');
  f.assertNoUnexpected();
});

test('a conversation closed by another worker cannot launch duplicate production', async () => {
  const f = fixture({ alreadyClosed: true });
  await f.processLineEvents([event]);
  assert.deepEqual(f.productions, []);
  assert.deepEqual(f.replies, []);
  assert.equal(f.queries.some((query) => query.table === 'conversations' && query.operation === 'update'), true);
  f.assertNoUnexpected();
});

function routeFixture({ valid = true, process = async () => {} } = {}) {
  const tasks = [];
  const signatures = [];
  const route = loadTypeScript('src/app/api/line/webhook/route.ts', {
    'next/server': {
      after: (task) => tasks.push(task),
      NextResponse: Response,
    },
    '@/lib/line': {
      verifyLineSignature: (raw, signature) => { signatures.push({ raw, signature }); return valid; },
    },
    './handle-events': { processLineEvents: process },
  });
  return { ...route, tasks, signatures };
}

test('webhook responds before background work starts and the after callback awaits processing', async () => {
  const started = deferred();
  const release = deferred();
  let processed;
  const f = routeFixture({ process: async (events) => { processed = events; started.resolve(); await release.promise; } });
  const raw = JSON.stringify({ events: [event] });
  const response = await f.POST(new Request('https://app.example/api/line/webhook', {
    method: 'POST', body: raw, headers: { 'x-line-signature': 'valid-signature' },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(f.signatures, [{ raw, signature: 'valid-signature' }]);
  assert.equal(processed, undefined);
  assert.equal(f.tasks.length, 1);
  let completed = false;
  const task = f.tasks[0]().then(() => { completed = true; });
  await started.promise;
  assert.deepEqual(processed, [event]);
  assert.equal(completed, false);
  release.resolve();
  await task;
  assert.equal(completed, true);
  assert.equal(f.runtime, 'nodejs');
  assert.equal(f.maxDuration, 300);
});

test('invalid webhook signatures cannot schedule promotion work', async () => {
  const f = routeFixture({ valid: false });
  const response = await f.POST(new Request('https://app.example/api/line/webhook', {
    method: 'POST', body: JSON.stringify({ events: [event] }), headers: { 'x-line-signature': 'invalid' },
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(f.tasks, []);
});
