const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const adminRequire = createRequire(path.join(root, 'admin-frontend', 'package.json'));
const ts = adminRequire('typescript');
const adapterPath = path.join(root, 'admin-frontend', 'src', 'api', 'service-requests.ts');

function loadAdapter() {
  const calls = [];
  const api = { get: (url, options) => { calls.push({ url, options }); return Promise.resolve(); } };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(adapterPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (name) => {
      assert.equal(name, './index');
      return api;
    },
  }, { filename: adapterPath });
  return { adapter: module.exports.serviceRequestsApi, calls };
}

test('empty admin request filters are omitted rather than invalid enum strings', async () => {
  const { adapter, calls } = loadAdapter();
  await adapter.list({ page: 1, size: 20, serviceType: '', processStatus: '', citySlug: '', q: '' });
  const params = JSON.parse(JSON.stringify(calls[0].options.params));
  assert.deepEqual(params, { page: 1, size: 20 });
  assert.equal(calls[0].url, '/service-requests');
});

test('real filters and pagination survive adapter normalization', async () => {
  const { adapter, calls } = loadAdapter();
  await adapter.list({ page: 2, size: 10, serviceType: 'free_route', processStatus: 'received', citySlug: 'chaozhou', q: 'traveler' });
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options.params)), {
    page: 2, size: 10, serviceType: 'free_route', processStatus: 'received', citySlug: 'chaozhou', q: 'traveler',
  });
});

test('private conversation paging carries the actual cursor', async () => {
  const { adapter, calls } = loadAdapter();
  await adapter.messages('request-id', 'message-id');
  assert.equal(calls[0].url, '/service-requests/request-id/messages');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options.params)), { after: 'message-id', size: 50 });
});
