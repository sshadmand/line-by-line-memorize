import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { cloudConfig } from '../cloud-config.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (match[1].trim()) new Script(match[1], { filename: 'index.html:inline' });
}
for (const file of ['cloud-config.js', 'cloud-client.js', 'cloud-scripts.js']) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
console.log('Application JavaScript syntax passed.');
const key = cloudConfig.publishableKey || '';
if (key.startsWith('sb_secret_')) throw new Error('A server secret must never be included in the public cloud configuration.');
if (key.split('.').length === 3) {
  const role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role;
  if (role !== 'anon') throw new Error('Only a public anon or publishable key may be shipped to the browser.');
}
if (!!cloudConfig.url !== !!key) throw new Error('Configure both the Supabase URL and publishable key.');
if (!key) console.log('Cloud backend is not configured; guest mode remains available.');
