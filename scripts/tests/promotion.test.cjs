const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript, createSupabase } = require('./helpers.cjs');

const request = { intakeItemId: 'intake-1', orgId: 'org-1', subjectId: 'subject-1', lineUserId: 'line-requester' };

function setup(options = {}) {
  const rows = {
    subjects: [{ id: 'subject-1', org_id: 'org-1', name: 'Example', active: true, website: 'https://example.test', ...options.subject }],
    intake_items: [{ id: 'intake-1', org_id: 'org-1', subject_id: 'subject-1', title: 'Summer campaign', kind: 'event', raw_text: 'The details from this interview', disclosable: true, used_count: 0, status: 'new', ...options.intake }],
    channels: [{ id: 'channel-1', org_id: 'org-1', subject_id: 'subject-1', type: 'x', auto_publish: true, auto_publish_max_risk: 'low' }],
    pr_objectives: [{ org_id: 'org-1', subject_id: 'subject-1', goal: 'inquiry', active: true, priority: 1 }],
    personas: [{ org_id: 'org-1', subject_id: 'subject-1', name: 'Customers', segment: 'Local customers' }],
    crisis_incidents: options.crisis ? [{ id: 'crisis-1', org_id: 'org-1', subject_id: 'subject-1', title: 'Incident', status: 'open', posts_paused: true }] : [],
    proposals: [], content_items: [], risk_checks: [], content_variants: [], creatives: [], notifications: [], approvals: [], posts: [], audit_logs: [],
    line_accounts: [{ org_id: 'org-1', line_user_id: 'line-requester' }, { org_id: 'org-1', line_user_id: 'line-colleague' }],
  };
  const events = [];
  const pushes = [];
  const writes = [];
  const sb = createSupabase((query) => {
    assert.ok(Object.hasOwn(rows, query.table), `Unexpected table ${query.table}`);
    if (options.failQuery?.(query)) return { data: null, error: new Error('database unavailable') };
    const table = rows[query.table];
    let matches = table.filter((row) => query.filters.every(({ method, args: [key, value] }) => {
      if (method === 'eq' || method === 'is') return row[key] === value;
      if (method === 'neq') return row[key] !== value;
      if (method === 'in') return value.includes(row[key]);
      if (method === 'order' || method === 'limit') return true;
      throw new Error(`Unexpected filter ${method}`);
    }));
    if (query.operation === 'insert') {
      const row = { id: `${query.table}-${table.length + 1}`, ...query.values };
      table.push(row);
      matches = [row];
    } else if (query.operation === 'update') {
      matches.forEach((row) => Object.assign(row, query.values));
    } else {
      assert.equal(query.operation, 'select');
    }
    events.push(`${query.table}:${query.operation}`);
    const limit = query.filters.find((filter) => filter.method === 'limit');
    if (limit) matches = matches.slice(0, limit.args[0]);
    return { data: query.terminal === 'single' || query.terminal === 'maybeSingle' ? matches[0] ?? null : matches, error: null };
  });
  const check = { overall: 'none', passed: true, blocked: false, findings: [], unverified_claims: [], summary: 'Checked', ...options.check };
  const api = loadTypeScript('src/lib/agents/orchestrator.ts', {
    '@/lib/supabase/admin': { supabaseAdmin: () => sb },
    '@/lib/agents/strategist': {},
    '@/lib/agents/writer': { writeContent: async (params) => {
      writes.push(params);
      return { title: 'Completed campaign', body: 'The generated promotional content.', summary: 'Campaign preview', keywords: [], cta: 'Contact us' };
    } },
    '@/lib/agents/marketer': { adaptToChannels: async () => [] },
    '@/lib/agents/analyst': { factCheck: async () => check },
    '@/lib/agents/creator': { generateCreative: async () => ({ width: 100, height: 100, svg: '<svg/>', spec: { reason: 'Campaign', palette: {} } }) },
    '@/lib/scoring': {},
    '@/lib/tracking': { appUrl: (path = '') => `https://example.test${path}`, createTrackingLink: async () => ({ url: 'https://example.test/t/campaign' }) },
    '@/lib/publishers': {},
    '@/lib/line': {
      isLineConfigured: () => true,
      textMessage: (text) => ({ type: 'text', text }),
      proposalFlex: (card) => ({ type: 'flex', card }),
      pushMessage: async (to, messages) => {
        events.push('push');
        if (options.pushError) throw options.pushError;
        pushes.push({ to, messages });
      },
    },
    '@/lib/constants': loadTypeScript('src/lib/constants.ts', {}),
    '@/lib/user-error': { humanizeError: (error) => String(error) },
    'next/cache': { revalidatePath: () => undefined },
  });
  return { ...api, rows, events, pushes, writes };
}

test('completed interview produces its own intake, waits for approval and sends completion + card to requester', async () => {
  const app = setup();
  await app.produceFromIntake(request);
  assert.equal(app.writes.length, 1);
  assert.equal(app.writes[0].intakeItemId, request.intakeItemId);
  assert.equal(app.writes[0].subjectId, request.subjectId);
  assert.equal(app.rows.proposals[0].intake_item_id, request.intakeItemId);
  assert.equal(app.rows.content_items[0].status, 'pending_approval');
  assert.equal(app.rows.intake_items[0].status, 'used');
  assert.equal(app.rows.approvals.length, 0, 'auto-publish settings must not bypass LINE approval');
  assert.equal(app.rows.posts.length, 0);
  assert.equal(app.pushes.length, 1);
  assert.equal(app.pushes[0].to, 'line-requester');
  const messages = app.pushes[0].messages;
  assert.equal(messages[0].type, 'text');
  assert.match(messages[0].text, /完成/);
  assert.equal(messages[1].type, 'flex');
  assert.equal(messages[1].card.id, app.rows.content_items[0].id);
  assert.match(messages[1].card.bodyPreview, /Campaign preview|generated promotional content/);
  assert.ok(app.events.indexOf('risk_checks:insert') < app.events.indexOf('push'));
  assert.ok(app.events.lastIndexOf('content_items:update') < app.events.indexOf('push'));
  assert.equal(app.rows.notifications[0].sent_to_line, true);
});

for (const [name, options] of [
  ['private material', { intake: { disclosable: false } }],
  ['inactive subject', { subject: { active: false } }],
  ['crisis mode', { crisis: true }],
]) {
  test(`${name} sends a notice without creating or publishing a promotion`, async () => {
    const app = setup(options);
    await app.produceFromIntake(request);
    assert.equal(app.writes.length, 0);
    assert.equal(app.rows.proposals.length, 0);
    assert.equal(app.rows.posts.length, 0);
    assert.equal(app.pushes.length, 1);
    assert.equal(app.pushes[0].to, 'line-requester');
    assert.ok(app.pushes[0].messages.every((message) => message.type === 'text'));
  });
}

test('risk-blocked content sends a warning in place of an approval card', async () => {
  const app = setup({ check: { overall: 'critical', passed: false, blocked: true } });
  await app.produceFromIntake(request);
  assert.equal(app.rows.content_items[0].status, 'on_hold');
  assert.equal(app.pushes[0].to, 'line-requester');
  assert.ok(app.pushes[0].messages.every((message) => message.type === 'text'));
  assert.equal(app.rows.approvals.length, 0);
  assert.equal(app.rows.posts.length, 0);
});

test('saving approval status must succeed before sending a completion card', async () => {
  const app = setup({ failQuery: (q) => q.table === 'content_items' && q.values?.status === 'pending_approval' });
  await assert.rejects(app.produceFromIntake(request), /database unavailable/);
  assert.equal(app.pushes.length, 0);
});

test('the intake must belong to the requesting organization and subject', async () => {
  const app = setup({ intake: { org_id: 'another-organization' } });
  await assert.rejects(app.produceFromIntake(request));
  assert.equal(app.writes.length, 0);
  assert.equal(app.pushes.length, 0);
});

test('completed intake is not generated again', async () => {
  const app = setup();
  await app.produceFromIntake(request);
  await app.produceFromIntake(request);
  assert.equal(app.writes.length, 1);
  assert.equal(app.rows.content_items.length, 1);
});

test('failed LINE delivery stays recorded as unsent without losing the finished draft', async () => {
  const app = setup({ pushError: new Error('LINE quota exceeded') });
  await app.produceFromIntake(request);
  assert.equal(app.rows.content_items[0].status, 'pending_approval');
  assert.equal(app.rows.notifications[0].sent_to_line, false);
});
