import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const sitePages = [
  ...readdirSync(root).filter(f => f.endsWith('.html')),
  ...readdirSync(join(root, 'projects')).filter(f => f.endsWith('.html')).map(f => `projects/${f}`),
  ...readdirSync(join(root, '_templates')).map(f => `_templates/${f}`),
];

test('the display name is "Zenolite" everywhere (the GitHub handle stays in URLs only)', () => {
  for (const page of sitePages) {
    // drop URLs and URL-like link text: github.com/Zenolitee..., zenolitee.github.io/...
    const text = read(page).replace(/(https?:\/\/)?[\w.-]*github\.(com|io)[^\s"<]*/gi, '');
    assert.doesNotMatch(text, /Zenolitee/i, `${page} still shows "Zenolitee"`);
  }
  assert.match(read('index.html'), /<p class="identity">Zenolite<\/p>/);
});

test('projects page shows Project Athena, Relicore, AgentPresence and asciify-ps, in that order', () => {
  const titles = [...read('projects/index.html').matchAll(/<div class="card-head"><h2>([^<]+)<\/h2>/g)].map(m => m[1]);
  assert.deepEqual(titles, ['Project Athena', 'Relicore', 'AgentPresence', 'asciify-ps']);
});
