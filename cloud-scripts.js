import { cloudConfig } from './cloud-config.js?v=cloud-gate-1';
import { createScriptStore } from './cloud-client.js';

const PREFIX = 'line-by-line-memorize:';
const emptyState = () => ({ body: '', redaction: 0, redaction_style: 'full', scroll_speed: 30 });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function setupCloudScripts({ app, doc = document, win = window, config = cloudConfig, createClient }) {
  const $ = id => doc.getElementById(id);
  const ui = Object.fromEntries([
    'accountButton', 'loginDialog', 'closeLogin', 'continueGuest', 'googleLogin', 'emailLogin',
    'emailAddress', 'emailSubmit', 'codeLogin', 'emailCode', 'codeSubmit', 'changeEmail',
    'loginMessage', 'cloudUnavailable', 'loginOptions', 'cloudTools', 'scriptTitle', 'saveCloud',
    'saveCopy', 'newScript', 'cloudStatus', 'libraryDialog', 'closeLibrary', 'libraryAccount',
    'libraryList', 'libraryMessage', 'refreshLibrary', 'libraryNew', 'libraryMore', 'signOut',
    'deleteConfirm', 'deleteName', 'deleteCancel', 'deleteAccept',
  ].map(id => [id, $(id)]));
  let client, store, user, active = null, baseline = null, epoch = 0, workspace = 0;
  let busy = false, loading = false, suppress = false, listEpoch = 0, rows = [], deleteTarget;
  let guest = read('guest-draft') || app.getState();
  const restored = read('workspace');
  let dirty = false;
  ui.accountButton.hidden = false;

  function read(key) {
    try { return JSON.parse(win.localStorage.getItem(PREFIX + key)); } catch { return null; }
  }
  function write(key, value) {
    try { win.localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
  function snapshot() {
    return { title: ui.scriptTitle.value.trim() || 'Untitled script', ...app.getState() };
  }
  function message(el, text = '', error = false) {
    el.textContent = text;
    el.dataset.error = String(error);
  }
  function notify(text, error = false) { message(ui.cloudStatus, text, error); }
  function persist() {
    if (suppress) return;
    const current = snapshot();
    if (user) {
      const cached = write('draft:' + user.id, { state: current, active, baseline });
      write('workspace', { owner: user.id });
      dirty = !same(current, baseline);
      if (!busy) notify(cached ? (dirty ? 'Changes saved on this device. Save to update your cloud copy.' : 'Saved to your cloud library.') : 'Device storage is full. Save to the cloud to keep your changes.', !cached);
    } else {
      guest = app.getState();
      write('guest-draft', guest);
      try { win.localStorage.setItem(PREFIX + 'script', guest.body); } catch { /* Keep practicing if device storage is unavailable. */ }
    }
    refreshButtons();
  }
  function refreshButtons() {
    ui.saveCloud.disabled = busy || loading || !user || !dirty;
    ui.saveCopy.disabled = busy || loading || !user;
    ui.newScript.disabled = busy || loading;
    ui.libraryNew.disabled = busy || loading;
    ui.refreshLibrary.disabled = busy || loading;
    ui.libraryMore.disabled = busy || loading;
    ui.signOut.disabled = busy || loading;
    for (const button of ui.libraryList.querySelectorAll('button')) button.disabled = busy || loading;
    ui.saveCloud.textContent = busy ? 'Saving…' : 'Save to cloud';
  }
  function loadState(state, title = '') {
    suppress = true;
    app.finishEditing();
    app.loadState(state);
    ui.scriptTitle.value = title;
    suppress = false;
  }
  function discardOK() {
    app.finishEditing();
    return !dirty || win.confirm('This script has changes that are not saved to the cloud. Continue without saving them?');
  }
  function closeDelete() { deleteTarget = null; ui.deleteConfirm.hidden = true; }
  function newScript() {
    if (busy || loading || !discardOK()) return;
    workspace++;
    active = null;
    baseline = null;
    loadState(emptyState());
    ui.saveCopy.hidden = true;
    persist();
    ui.libraryDialog.close();
    ui.scriptTitle.focus();
  }
  async function applySession(session) {
    const next = session?.user || null;
    if (next?.id === user?.id) return;
    epoch++;
    workspace++;
    listEpoch++;
    busy = false;
    loading = false;
    closeDelete();
    ui.libraryDialog.close();
    rows = [];
    ui.libraryList.replaceChildren();
    if (!user && !restored?.owner) {
      guest = app.getState();
      write('guest-draft', guest);
    }
    user = next;
    active = null;
    baseline = null;
    ui.saveCopy.hidden = true;
    ui.emailLogin.reset();
    ui.codeLogin.reset();
    ui.emailLogin.hidden = !config.providers?.email;
    ui.codeLogin.hidden = true;
    message(ui.loginMessage);
    ui.cloudTools.hidden = !user;
    ui.accountButton.textContent = user ? 'My scripts' : 'Log in';
    ui.accountButton.setAttribute('aria-haspopup', 'dialog');
    if (user) {
      store = createScriptStore(client, user.id);
      const draft = read('draft:' + user.id);
      active = draft?.active || null;
      baseline = draft?.baseline || null;
      loadState(draft?.state || guest, draft?.state?.title || '');
      ui.libraryAccount.textContent = user.email || 'Your private script library';
      ui.loginDialog.close();
      persist();
    } else {
      store = null;
      loadState(guest);
      write('workspace', null);
      dirty = false;
      notify('Saved on this device. Log in to save scripts across devices.');
      refreshButtons();
    }
  }
  function humanError(error) {
    if (error?.code === 'SCRIPT_CONFLICT') return error.message;
    if (error?.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (error?.code === 'otp_expired') return 'That login code has expired. Request a new code and try again.';
    if (error?.code === '23514') return 'This script is too long to save. Please keep it under 500,000 characters.';
    if (error?.code === 'PGRST116') return 'This script is no longer available. Refresh your library.';
    if (error?.message?.includes('Failed to fetch') || error?.name === 'TypeError') return 'Could not connect. Your draft is still on this device. Please try again when you’re online.';
    return 'Something went wrong. Your draft is still on this device. Please try again.';
  }
  async function save(asCopy = false) {
    if (busy || loading || !user || !store) return;
    app.finishEditing();
    const draft = snapshot(), originalTitle = draft.title, token = epoch, currentWorkspace = workspace;
    if (draft.body.length > 500000) { notify('Please keep scripts under 500,000 characters.', true); return; }
    if (asCopy) draft.title = (draft.title.slice(0, 113) + ' (copy)').slice(0, 120);
    busy = true;
    notify('Saving to your cloud library…');
    refreshButtons();
    try {
      const saved = await store.save(draft, asCopy ? null : active);
      if (token !== epoch || currentWorkspace !== workspace) return;
      active = { id: saved.id, version: saved.version };
      baseline = { title: saved.title, body: saved.body, redaction: saved.redaction, redaction_style: saved.redaction_style || 'full', scroll_speed: saved.scroll_speed };
      if (asCopy && snapshot().title === originalTitle) ui.scriptTitle.value = draft.title;
      if (!asCopy && !ui.scriptTitle.value.trim()) ui.scriptTitle.value = saved.title;
      ui.saveCopy.hidden = true;
      busy = false;
      persist();
    } catch (error) {
      if (token !== epoch || currentWorkspace !== workspace) return;
      ui.saveCopy.hidden = error?.code !== 'SCRIPT_CONFLICT';
      notify(humanError(error), true);
    } finally {
      if (token === epoch && currentWorkspace === workspace) { busy = false; refreshButtons(); }
    }
  }
  function renderLibrary() {
    ui.libraryList.replaceChildren();
    for (const row of rows) {
      const item = doc.createElement('li'); item.className = 'library-row';
      const open = doc.createElement('button'); open.type = 'button'; open.className = 'library-open';
      const title = doc.createElement('strong'); title.textContent = row.title;
      const date = doc.createElement('span');
      date.textContent = 'Updated ' + new Date(row.updated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      open.append(title, date); open.addEventListener('click', () => openScript(row.id));
      const remove = doc.createElement('button'); remove.type = 'button'; remove.className = 'library-delete';
      remove.textContent = 'Delete'; remove.setAttribute('aria-label', 'Delete ' + row.title);
      remove.addEventListener('click', () => { deleteTarget = row; ui.deleteName.textContent = row.title; ui.deleteConfirm.hidden = false; ui.deleteCancel.focus(); });
      item.append(open, remove); ui.libraryList.append(item);
    }
    refreshButtons();
  }
  async function list(more = false) {
    if (!user || !store || busy || loading) return;
    const token = epoch, request = ++listEpoch;
    loading = true; closeDelete(); refreshButtons();
    message(ui.libraryMessage, 'Loading your scripts…');
    try {
      const page = await store.list(more ? rows.length : 0);
      if (token !== epoch || request !== listEpoch) return;
      rows = more ? [...new Map([...rows, ...page].map(row => [row.id, row])).values()] : page;
      renderLibrary();
      ui.libraryMore.hidden = page.length < 50;
      message(ui.libraryMessage, rows.length ? '' : 'Your cloud library is empty. Save your current script to find it here on every device.');
    } catch (error) {
      if (token === epoch && request === listEpoch) message(ui.libraryMessage, humanError(error), true);
    } finally {
      if (token === epoch && request === listEpoch) { loading = false; refreshButtons(); }
    }
  }
  async function openScript(id) {
    if (!store || busy || loading || !discardOK()) return;
    const token = epoch;
    loading = true; refreshButtons();
    message(ui.libraryMessage, 'Opening script…');
    try {
      const row = await store.open(id);
      if (token !== epoch) return;
      workspace++;
      active = { id: row.id, version: row.version };
      baseline = { title: row.title, body: row.body, redaction: row.redaction, redaction_style: row.redaction_style || 'full', scroll_speed: row.scroll_speed };
      loadState(baseline, row.title);
      ui.saveCopy.hidden = true;
      persist();
      ui.libraryDialog.close();
    } catch (error) { if (token === epoch) message(ui.libraryMessage, humanError(error), true); }
    finally { if (token === epoch) { loading = false; refreshButtons(); } }
  }
  async function removeScript() {
    if (!deleteTarget || !store || busy || loading) return;
    const row = deleteTarget, token = epoch;
    loading = true; refreshButtons(); ui.deleteAccept.disabled = true;
    try {
      await store.remove(row.id, row.version);
      if (token !== epoch) return;
      rows = rows.filter(item => item.id !== row.id);
      if (active?.id === row.id) { active = null; baseline = null; persist(); }
      closeDelete(); renderLibrary();
      message(ui.libraryMessage, 'Script deleted. A script already open in the editor stays on this device.');
    } catch (error) { if (token === epoch) message(ui.libraryMessage, humanError(error), true); }
    finally { if (token === epoch) { loading = false; ui.deleteAccept.disabled = false; refreshButtons(); } }
  }
  function authBusy(value) {
    for (const item of [ui.googleLogin, ui.emailSubmit, ui.codeSubmit, ui.changeEmail]) item.disabled = value;
  }
  ui.accountButton.addEventListener('click', () => {
    app.finishEditing();
    if (user) { ui.libraryDialog.showModal(); list(); }
    else { message(ui.loginMessage); ui.loginDialog.showModal(); }
  });
  for (const el of [ui.closeLogin, ui.continueGuest]) el.addEventListener('click', () => ui.loginDialog.close());
  ui.closeLibrary.addEventListener('click', () => ui.libraryDialog.close());
  for (const dialog of [ui.loginDialog, ui.libraryDialog]) dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  ui.googleLogin.hidden = !config.providers?.google;
  ui.emailLogin.hidden = !config.providers?.email;
  const divider = doc.getElementById('authDivider');
  if (divider) divider.hidden = !config.providers?.google || !config.providers?.email;
  ui.googleLogin.addEventListener('click', async () => {
    if (!client) return;
    persist(); authBusy(true); message(ui.loginMessage, 'Opening Google…');
    try {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: win.location.origin + win.location.pathname, scopes: 'openid email profile' } });
      if (error) throw error;
    } catch (error) { message(ui.loginMessage, humanError(error), true); }
    finally { authBusy(false); }
  });
  ui.emailLogin.addEventListener('submit', async event => {
    event.preventDefault(); if (!client || !ui.emailLogin.reportValidity()) return;
    authBusy(true); message(ui.loginMessage, 'Sending your login code…');
    try {
      const { error } = await client.auth.signInWithOtp({ email: ui.emailAddress.value.trim() });
      if (error) throw error;
      ui.emailLogin.hidden = true; ui.codeLogin.hidden = false;
      message(ui.loginMessage, 'Check your email for a login code. You can enter it here on any device.');
      ui.emailCode.focus();
    } catch (error) { message(ui.loginMessage, humanError(error), true); }
    finally { authBusy(false); }
  });
  ui.changeEmail.addEventListener('click', () => {
    ui.emailLogin.hidden = false; ui.codeLogin.hidden = true; ui.emailCode.value = ''; message(ui.loginMessage); ui.emailAddress.focus();
  });
  ui.codeLogin.addEventListener('submit', async event => {
    event.preventDefault(); if (!client || !ui.codeLogin.reportValidity()) return;
    authBusy(true); message(ui.loginMessage, 'Checking your code…');
    try {
      const { error } = await client.auth.verifyOtp({ email: ui.emailAddress.value.trim(), token: ui.emailCode.value.trim(), type: 'email' });
      if (error) throw error;
    } catch (error) { message(ui.loginMessage, humanError(error), true); }
    finally { authBusy(false); }
  });
  ui.scriptTitle.addEventListener('input', persist);
  ui.saveCloud.addEventListener('click', () => save());
  ui.saveCopy.addEventListener('click', () => save(true));
  ui.newScript.addEventListener('click', newScript);
  ui.libraryNew.addEventListener('click', newScript);
  ui.refreshLibrary.addEventListener('click', () => list());
  ui.libraryMore.addEventListener('click', () => list(true));
  ui.deleteCancel.addEventListener('click', closeDelete);
  ui.deleteAccept.addEventListener('click', removeScript);
  ui.signOut.addEventListener('click', async () => {
    if (!client || busy || loading) return;
    app.finishEditing(); persist();
    loading = true; refreshButtons();
    const token = epoch;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      await applySession(null);
    } catch (error) { message(ui.libraryMessage, humanError(error), true); }
    finally { if (token === epoch) { loading = false; refreshButtons(); } }
  });
  win.addEventListener('linebyline:change', persist);
  // A signed-out workspace must never inherit another account's selected script.
  if (restored?.owner) loadState(guest);
  notify('Saved on this device. Log in to save scripts across devices.');
  refreshButtons();

  const ready = (async () => {
    authBusy(true);
    if (!config.url || !config.publishableKey) {
      ui.loginOptions.hidden = true; ui.cloudUnavailable.hidden = false; return;
    }
    try {
      const factory = createClient || (await import('./assets/vendor/supabase.js')).createClient;
      client = factory(config.url, config.publishableKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      let authSequence = 0;
      client.auth.onAuthStateChange((_event, session) => {
        const sequence = ++authSequence;
        // Defer API work until Supabase has released its auth lock.
        win.setTimeout(() => { if (sequence === authSequence) applySession(session); }, 0);
      });
      const sequence = authSequence;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (sequence === authSequence) await applySession(data.session);
    } catch (error) {
      message(ui.loginMessage, humanError(error), true);
      ui.loginDialog.showModal();
    } finally { authBusy(false); }
  })();
  return { ready };
}
