import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { setupCloudScripts } from '../cloud-scripts.js';
import { startCloudScripts, cloudEnabledForLocation } from '../cloud-bootstrap.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const config = { url: 'https://example.supabase.co', publishableKey: 'public-test-key', providers: { google: true, email: true } };
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

class Backend {
  rows = new Map();
  nextId = 1;
  failSave = false;
  clients = [];
  makeClient(id = null) {
    const backend = this;
    let current = id ? { user: { id, email: id + '@example.test' } } : null;
    const listeners = [];
    const auth = {
      async getSession() { return { data: { session: current }, error: null }; },
      onAuthStateChange(fn) { listeners.push(fn); },
      login(id) { current = id ? { user: { id, email: id + '@example.test' } } : null; for (const fn of listeners) fn('SIGNED_IN', current); },
      async signOut() { auth.login(null); return { error: null }; },
      async signInWithOtp(input) { auth.sent = input; return { error: null }; },
      async verifyOtp(input) { auth.verified = input; auth.login(input.email.split('@')[0]); return { error: null }; },
      async signInWithOAuth(input) { auth.oauth = input; return { error: null }; },
    };
    const client = { auth, from(table) {
      assert.equal(table, 'scripts');
      let mode = 'select', fields, filters = [], start = 0, end = 49;
      const q = {
        select() { return q; }, eq(key, value) { filters.push([key, value]); return q; },
        order() { return q; }, range(a, b) { start = a; end = b; return q; },
        update(value) { mode = 'update'; fields = value; return q; },
        insert(value) { mode = 'insert'; fields = value; return q; },
        delete() { mode = 'delete'; return q; },
        async run(single) {
          const userId = current?.user.id;
          if (mode === 'insert' || mode === 'update') {
            if (backend.saveGate) await backend.saveGate.promise;
            if (backend.failSave) throw new TypeError('Failed to fetch');
          } else if (backend.listGate) await backend.listGate.promise;
          let result = [...backend.rows.values()].filter(row => row.user_id === userId && filters.every(([k, v]) => row[k] === v));
          if (mode === 'insert') {
            assert.equal(fields.user_id, userId);
            const row = { ...fields, id: String(backend.nextId++), version: 1, updated_at: new Date().toISOString() };
            backend.rows.set(row.id, row); result = [row];
          } else if (mode === 'update') {
            result = result.map(row => ({ ...row, ...fields, version: row.version + 1, updated_at: new Date().toISOString() }));
            result.forEach(row => backend.rows.set(row.id, row));
          } else if (mode === 'delete') result.forEach(row => backend.rows.delete(row.id));
          return { data: single ? result[0] || null : result.slice(start, end + 1), error: null };
        },
        maybeSingle() { return q.run(true); }, single() { return q.run(true); },
        then(resolve, reject) { return q.run(false).then(resolve, reject); },
      };
      return q;
    } };
    this.clients.push(client);
    return client;
  }
}

async function mount(t, { backend = new Backend(), account = null, storage = {}, configured = true, providers = config.providers, production = false, productionEnabled = false, initialAuthError = false } = {}) {
  const dom = new JSDOM(html, {
    url: production ? 'https://linebyline.online/' : 'https://linebyline.test/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(win) {
      win.ResizeObserver = class { observe() {} };
      win.HTMLElement.prototype.scrollIntoView = () => {};
      win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      win.HTMLDialogElement.prototype.close = function () { this.open = false; };
      win.confirm = () => true;
      Object.entries(storage).forEach(([key, value]) => win.localStorage.setItem(key, value));
    },
  });
  t.after(() => dom.window.close());
  const client = backend.makeClient(account), app = dom.window.lineByLineApp;
  if (initialAuthError) client.auth.getSession = async () => ({ data: { session: null }, error: new Error('Authentication unavailable') });
  let clientInitializations = 0;
  const options = { app, doc: dom.window.document, win: dom.window, config: configured ? { ...config, providers, enabledInProduction: productionEnabled } : {}, createClient: () => { clientInitializations++; return client; } };
  const setup = production ? await startCloudScripts(options) : setupCloudScripts(options);
  await setup?.ready;
  const $ = id => dom.window.document.getElementById(id);
  const input = (id, value) => { $(id).value = value; $(id).dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  const click = async id => { $(id).click(); await settle(); };
  const setBody = body => { app.loadState({ ...app.getState(), body }); };
  return { dom, app, client, backend, $, input, click, setBody, started: !!setup, clientInitializations };
}

test('production gate keeps login hidden and never initializes cloud services', async t => {
  const f = await mount(t, { production: true, account: 'alice', storage: { 'line-by-line-memorize:script': 'Keep my guest script\n\nExactly' } });
  assert.equal(f.started, false);
  assert.equal(f.clientInitializations, 0);
  assert.equal(f.$('accountButton').hidden, true);
  assert.equal(f.$('cloudTools').hidden, true);
  assert.equal(f.$('loginDialog').open, false);
  assert.equal(f.app.getState().body, 'Keep my guest script\n\nExactly');
  await f.click('toggleEditor');
  assert.equal(f.dom.window.document.body.classList.contains('practice-mode'), true);
  await f.click('exitPractice');
  assert.equal(f.dom.window.localStorage.getItem('line-by-line-memorize:workspace'), null);
});

test('cloud initialization is available locally and requires explicit enablement on every public host', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) assert.equal(cloudEnabledForLocation({}, { hostname }), true);
  for (const hostname of ['linebyline.online', 'www.linebyline.online', 'sshadmand.github.io', 'preview.example.com']) {
    assert.equal(cloudEnabledForLocation({}, { hostname }), false);
    assert.equal(cloudEnabledForLocation({ enabledInProduction: false }, { hostname }), false);
    assert.equal(cloudEnabledForLocation({ enabledInProduction: true }, { hostname }), true);
  }
});

test('the enabled production release offers login without requiring a guest to sign in', async t => {
  const f = await mount(t, { production: true, productionEnabled: true, providers: { google: true, email: false } });
  assert.equal(f.started, true);
  assert.equal(f.clientInitializations, 1);
  assert.equal(f.$('accountButton').hidden, false);
  assert.equal(f.$('cloudTools').hidden, true);
  assert.equal(f.$('loginDialog').open, false);
  await f.click('accountButton');
  assert.equal(f.$('loginDialog').open, true);
  assert.equal(f.$('emailLogin').hidden, true);
  await f.click('continueGuest');
  await f.click('toggleEditor');
  assert.equal(f.dom.window.document.body.classList.contains('practice-mode'), true);
});

test('an authentication startup outage does not open a modal or interrupt guest practice', async t => {
  const f = await mount(t, { production: true, productionEnabled: true, initialAuthError: true, storage: { 'line-by-line-memorize:script': 'My existing guest script' } });
  assert.equal(f.$('loginDialog').open, false);
  assert.equal(f.app.getState().body, 'My existing guest script');
  assert.match(f.$('cloudStatus').textContent, /temporarily unavailable/);
  await f.click('toggleEditor');
  assert.equal(f.dom.window.document.body.classList.contains('practice-mode'), true);
});

test('guest practice, exact whitespace, and modal keyboard isolation need no cloud configuration', async t => {
  const f = await mount(t, { configured: false });
  f.setBody('First line\n\n  second line  \n');
  assert.equal(f.$('script').value, 'First line\n\n  second line  \n');
  await f.click('accountButton');
  assert.equal(f.$('loginDialog').open, true);
  assert.equal(f.$('cloudUnavailable').hidden, false);
  const before = f.$('omit').value;
  f.dom.window.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: '+', metaKey: true }));
  assert.equal(f.$('omit').value, before);
  await f.click('continueGuest');
  await f.click('toggleEditor');
  assert.equal(f.dom.window.document.body.classList.contains('practice-mode'), true);
  await f.click('exitPractice');
  assert.equal(f.$('cloudTools').hidden, true);
});

test('Google-only launch hides email controls and returns OAuth to the current page', async t => {
  const f = await mount(t, { providers: { google: true, email: false } });
  await f.click('accountButton');
  assert.equal(f.$('googleLogin').hidden, false);
  assert.equal(f.$('emailLogin').hidden, true);
  assert.equal(f.$('codeLogin').hidden, true);
  assert.equal(f.$('authDivider').hidden, true);
  await f.click('googleLogin');
  assert.deepEqual(f.client.auth.oauth, { provider: 'google', options: { redirectTo: 'https://linebyline.test/', scopes: 'openid email profile' } });
});

test('email code sign-in preserves the guest draft and provides a separate cloud workspace', async t => {
  const f = await mount(t);
  f.setBody('My guest draft\n');
  await f.click('accountButton');
  f.input('emailAddress', 'alice@example.test');
  f.$('emailLogin').dispatchEvent(new f.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  assert.deepEqual(f.client.auth.sent, { email: 'alice@example.test' });
  assert.equal(f.$('codeLogin').hidden, false);
  f.input('emailCode', '12345678');
  f.$('codeLogin').dispatchEvent(new f.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(f.$('accountButton').textContent, 'My scripts');
  assert.equal(f.app.getState().body, 'My guest draft\n');
  assert.equal(f.$('loginDialog').open, false);
  f.input('scriptTitle', 'Opening remarks');
  await f.click('saveCloud');
  assert.equal(f.backend.rows.size, 1);
  assert.equal([...f.backend.rows.values()][0].title, 'Opening remarks');
  assert.equal(f.$('saveCloud').disabled, true);
  f.setBody('Signed-in private changes');
  await f.click('accountButton');
  await f.click('signOut');
  assert.equal(f.app.getState().body, 'My guest draft\n');
  assert.equal(f.$('cloudTools').hidden, true);
  await f.click('accountButton');
  assert.equal(f.$('emailAddress').value, '');
  assert.equal(f.$('emailCode').value, '');
  assert.equal(f.$('emailLogin').hidden, false);
});

test('multiple devices open the same library and stale saves create copies instead of overwriting', async t => {
  const backend = new Backend();
  const a = await mount(t, { backend, account: 'alice' });
  a.input('scriptTitle', 'Talk'); a.setBody('Original\n\nExact breaks');
  a.$('redactionStyle').value = 'half'; a.$('redactionStyle').dispatchEvent(new a.dom.window.Event('change'));
  await a.click('saveCloud');
  const b = await mount(t, { backend, account: 'alice' });
  await b.click('accountButton');
  b.$('libraryList').querySelector('.library-open').click(); await settle();
  assert.equal(b.app.getState().body, 'Original\n\nExact breaks');
  assert.equal(b.app.getState().redaction_style, 'half');
  b.setBody('Edited on device B'); await b.click('saveCloud');
  a.setBody('Edited on device A'); await a.click('saveCloud');
  assert.equal([...backend.rows.values()][0].body, 'Edited on device B');
  assert.equal(a.$('saveCopy').hidden, false);
  await a.click('saveCopy');
  assert.equal(backend.rows.size, 2);
  assert.equal([...backend.rows.values()][1].body, 'Edited on device A');
  assert.equal(a.$('scriptTitle').value, 'Talk (copy)');
});

test('offline failure retains the local draft across a page reload', async t => {
  const backend = new Backend(), a = await mount(t, { backend, account: 'alice' });
  a.input('scriptTitle', 'Offline talk'); a.setBody('Keep\n\nmy words');
  backend.failSave = true; await a.click('saveCloud');
  assert.match(a.$('cloudStatus').textContent, /Could not connect/);
  assert.equal(a.app.getState().body, 'Keep\n\nmy words');
  const storage = Object.fromEntries(Object.keys(a.dom.window.localStorage).map(key => [key, a.dom.window.localStorage.getItem(key)]));
  const b = await mount(t, { backend, account: 'alice', storage });
  assert.equal(b.app.getState().body, 'Keep\n\nmy words');
  backend.failSave = false; await b.click('saveCloud');
  assert.equal([...backend.rows.values()][0].body, 'Keep\n\nmy words');
});

test('typing while a save is pending keeps the newer text dirty', async t => {
  const backend = new Backend(), f = await mount(t, { backend, account: 'alice' });
  f.input('scriptTitle', 'Talk'); f.setBody('Version one');
  backend.saveGate = deferred(); f.$('saveCloud').click(); await settle();
  f.setBody('Version two'); backend.saveGate.resolve(); await settle();
  assert.equal([...backend.rows.values()][0].body, 'Version one');
  assert.equal(f.app.getState().body, 'Version two');
  assert.equal(f.$('saveCloud').disabled, false);
  backend.saveGate = null; await f.click('saveCloud');
  assert.equal([...backend.rows.values()][0].body, 'Version two');
});

test('switching accounts or signing out while a request is pending cannot leak a library', async t => {
  const backend = new Backend(), f = await mount(t, { backend, account: 'alice' });
  f.input('scriptTitle', '<img src=x onerror=alert(1)>'); f.setBody('Private script'); await f.click('saveCloud');
  await f.click('accountButton');
  assert.equal(f.$('libraryList').querySelector('img'), null);
  backend.listGate = deferred(); f.$('refreshLibrary').click(); await settle();
  f.client.auth.login('bob'); await settle(); backend.listGate.resolve(); await settle();
  assert.equal(f.$('libraryList').children.length, 0);
  assert.notEqual(f.app.getState().body, 'Private script');
  await f.click('accountButton');
  assert.equal(f.$('libraryList').children.length, 0);
});

test('delete requires confirmation, and the open text remains a local draft', async t => {
  const f = await mount(t, { account: 'alice' });
  f.input('scriptTitle', 'Talk'); f.setBody('Words to keep locally'); await f.click('saveCloud');
  await f.click('accountButton');
  f.$('libraryList').querySelector('.library-delete').click(); await settle();
  assert.equal(f.backend.rows.size, 1);
  assert.equal(f.$('deleteConfirm').hidden, false);
  await f.click('deleteAccept');
  assert.equal(f.backend.rows.size, 0);
  assert.equal(f.app.getState().body, 'Words to keep locally');
});
