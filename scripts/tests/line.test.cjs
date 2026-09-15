const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.resolve(__dirname, "../../src/lib/line.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  },
}).outputText;

// Every HTTP call, timer and environment variable is isolated from real services.
function loadLine(responses, { configured = true } = {}) {
  const calls = [];
  const delays = [];
  const timeouts = [];
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require,
    Buffer,
    process: { env: configured ? { LINE_CHANNEL_ACCESS_TOKEN: "test-token" } : {} },
    AbortSignal: {
      timeout(ms) {
        timeouts.push(ms);
        return { timeout: ms };
      },
    },
    setTimeout(callback, ms) {
      delays.push(ms);
      callback();
    },
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      const response = responses[calls.length - 1];
      if (response instanceof Error) throw response;
      assert.ok(response, "Unexpected HTTP request");
      return response;
    },
  });
  return { ...exports, calls, delays, timeouts };
}

function response(status, headers = {}) {
  return new Response(JSON.stringify({ message: `response ${status}` }), { status, headers });
}

function card(line, id = "content-123") {
  return line.proposalFlex({
    id,
    theme: "New promotion",
    reason: "Requested campaign",
    goal: "Awareness",
    audience: "Members",
    channels: ["LINE"],
    cta: "Join us",
    expectedEffect: "More participation",
    cautions: "",
    bodyPreview: "Promotion content is ready.",
  }, "https://example.test/");
}

test("completion notification and approval card are delivered together", async () => {
  const line = loadLine([response(200)]);
  const messages = [line.textMessage("広報案が完成しました。"), card(line)];
  await line.pushMessage("line-user-123", messages);

  assert.equal(line.calls.length, 1);
  assert.equal(line.calls[0].url, "https://api.line.me/v2/bot/message/push");
  assert.equal(line.calls[0].method, "POST");
  assert.deepEqual(JSON.parse(line.calls[0].body), JSON.parse(JSON.stringify({ to: "line-user-123", messages })));
  assert.match(line.calls[0].headers["X-Line-Retry-Key"], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.deepEqual(line.timeouts, [10_000]);

  const footer = JSON.parse(line.calls[0].body).messages[1].contents.footer.contents;
  assert.equal(footer[0].contents[0].action.data, "action=approve&id=content-123");
  assert.equal(footer[0].contents[1].action.data, "action=revise&id=content-123");
  assert.deepEqual(footer[2].action, {
    type: "uri", label: "詳細を確認", uri: "https://example.test/dashboard/content/content-123",
  });
});

test("temporary failures retry identical messages with one retry key", async () => {
  const line = loadLine([new Error("network timeout"), response(503), response(200)]);
  const retryKey = "b2e13ed0-68c9-4b1b-a8fa-6225ce9ecfcb";
  await line.pushMessage("line-user-123", [line.textMessage("Complete"), card(line)], { retryKey });

  assert.equal(line.calls.length, 3);
  assert.equal(new Set(line.calls.map((call) => call.body)).size, 1);
  assert.ok(line.calls.every((call) => call.headers["X-Line-Retry-Key"] === retryKey));
  assert.deepEqual(line.delays, [500, 1000]);
  assert.deepEqual(line.timeouts, [10_000, 10_000, 10_000]);
});

test("accepted retries stop on LINE's duplicate acknowledgment", async () => {
  const line = loadLine([new Error("response lost"), response(409, { "x-line-accepted-request-id": "accepted-123" })]);
  await line.pushMessage("line-user-123", [line.textMessage("Complete")]);
  assert.equal(line.calls.length, 2);
  assert.equal(line.calls[0].headers["X-Line-Retry-Key"], line.calls[1].headers["X-Line-Retry-Key"]);
});

test("response cleanup cannot turn an accepted notification into a failure", async () => {
  const line = loadLine([{
    ok: true,
    status: 200,
    headers: new Headers(),
    body: { cancel: async () => { throw new Error("stream closed"); } },
  }]);
  await line.pushMessage("line-user-123", [line.textMessage("Complete")]);
  assert.equal(line.calls.length, 1);
});

test("client errors and unconfirmed conflicts surface without retries", async () => {
  for (const status of [400, 401, 403, 409, 429]) {
    const line = loadLine([response(status, { "x-line-request-id": "failed-123" })]);
    await assert.rejects(line.pushMessage("line-user-123", [line.textMessage("Complete")]), {
      message: `LINE push ${status} (request failed-123): {"message":"response ${status}"}`,
    });
    assert.equal(line.calls.length, 1);
    assert.deepEqual(line.delays, []);
  }
});

test("exhausted server retries expose the final LINE request ID", async () => {
  const line = loadLine([response(500), response(503), response(502, { "x-line-request-id": "last-123" })]);
  await assert.rejects(line.pushMessage("line-user-123", [line.textMessage("Complete")]), {
    message: 'LINE push 502 (request last-123): {"message":"response 502"}',
  });
  assert.equal(line.calls.length, 3);
});

test("exhausted network retries expose the original cause", async () => {
  const failure = new Error("connection refused");
  const line = loadLine([failure, failure, failure]);
  await assert.rejects(line.pushMessage("line-user-123", [line.textMessage("Complete")]), (error) => {
    assert.match(error.message, /LINE push failed after 3 attempts: .*connection refused/);
    assert.equal(error.cause, failure);
    return true;
  });
  assert.equal(line.calls.length, 3);
});

test("invalid message counts cannot silently omit an approval card", async () => {
  const line = loadLine([]);
  for (const messages of [[], Array.from({ length: 6 }, () => line.textMessage("Complete"))]) {
    await assert.rejects(line.pushMessage("line-user-123", messages), /between 1 and 5 messages/);
  }
  assert.equal(line.calls.length, 0);
});

test("missing LINE credentials fail before any HTTP request", async () => {
  const line = loadLine([], { configured: false });
  await assert.rejects(line.pushMessage("line-user-123", [line.textMessage("Complete")]), /LINE_CHANNEL_ACCESS_TOKEN is not configured/);
  assert.equal(line.calls.length, 0);
});
