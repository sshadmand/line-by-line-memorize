// Local browser QA only: no email is sent and no external account is accessed.
// Run with: node tests/preview-server.mjs (http://127.0.0.1:8090).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const rows = new Map();
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'demo@example.test', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
function session() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aud: 'authenticated', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return { access_token: header + '.' + payload + '.local-test-signature', token_type: 'bearer', expires_in: 3600, refresh_token: 'local-test-refresh', user };
}
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8090');
  const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  try {
    if (url.pathname === '/cloud-config.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(`export const cloudConfig = ${JSON.stringify({ url: 'http://127.0.0.1:8090/mock', publishableKey: 'local-public-test-key', providers: { google: true, email: true } })};`); return;
    }
    if (url.pathname.startsWith('/mock/')) {
      let body = ''; for await (const chunk of req) body += chunk;
      if (url.pathname.endsWith('/otp')) return send({});
      if (url.pathname.endsWith('/verify') || url.pathname.endsWith('/token')) return send(session());
      if (url.pathname.endsWith('/user')) return send(user);
      if (url.pathname.endsWith('/logout')) return send({});
      if (url.pathname.endsWith('/scripts')) {
        if (!req.headers.authorization?.includes('.local-test-signature')) return send({ message: 'Unauthorized' }, 401);
        let selected = [...rows.values()].filter(row => ['id', 'user_id', 'version'].every(key => !url.searchParams.has(key) || String(row[key]) === url.searchParams.get(key).slice(3)));
        if (req.method === 'POST') {
          const value = JSON.parse(body), row = { ...value, id: randomUUID(), version: 1, updated_at: new Date().toISOString() };
          rows.set(row.id, row); selected = [row];
        }
        if (req.method === 'PATCH') {
          selected = selected.map(row => ({ ...row, ...JSON.parse(body), version: row.version + 1, updated_at: new Date().toISOString() }));
          selected.forEach(row => rows.set(row.id, row));
        }
        if (req.method === 'DELETE') selected.forEach(row => rows.delete(row.id));
        selected.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        const single = req.headers.accept?.includes('vnd.pgrst.object');
        return send(single ? selected[0] || null : selected, req.method === 'POST' ? 201 : 200);
      }
      return send({ message: 'Unknown local test endpoint' }, 404);
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root + '/')) return send({}, 403);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'text/plain' }); res.end(data);
  } catch (error) { send({ message: error.code === 'ENOENT' ? 'Not found' : 'Local preview error' }, error.code === 'ENOENT' ? 404 : 500); }
}).listen(8090, '127.0.0.1', () => console.log('Local QA backend: http://127.0.0.1:8090 (demo@example.test; any numeric login code)'));
