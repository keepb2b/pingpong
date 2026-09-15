const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTypeScript(relativePath, mocks) {
  const filename = path.resolve(__dirname, '../..', relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  const loaded = { exports: {} };
  const injectedRequire = (name) => {
    if (!Object.hasOwn(mocks, name)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  };
  new Function('require', 'module', 'exports', outputText)(injectedRequire, loaded, loaded.exports);
  return loaded.exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function createSupabase(handler) {
  return {
    from(table) {
      const query = { table, operation: undefined, values: undefined, filters: [] };
      let result;
      const finish = (terminal) => {
        query.terminal = terminal;
        result ??= Promise.resolve().then(() => handler(query));
        return result;
      };
      const builder = {
        select(selection) {
          query.operation ??= 'select';
          query.selection = selection;
          return builder;
        },
        single() { return finish('single'); },
        maybeSingle() { return finish('maybeSingle'); },
        then(resolve, reject) { return finish('await').then(resolve, reject); },
      };
      for (const operation of ['insert', 'update', 'upsert', 'delete']) {
        builder[operation] = (values, options) => {
          query.operation = operation;
          query.values = values;
          query.options = options;
          return builder;
        };
      }
      for (const method of ['eq', 'neq', 'contains', 'in', 'is', 'order', 'limit', 'gt', 'gte', 'lt', 'lte']) {
        builder[method] = (...args) => {
          query.filters.push({ method, args });
          return builder;
        };
      }
      return builder;
    },
  };
}

module.exports = { loadTypeScript, deferred, createSupabase };
