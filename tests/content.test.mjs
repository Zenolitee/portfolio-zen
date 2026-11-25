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
  assert.match(read('index.html'), /<p class="identity"[^>]*>Zenolite<\/p>/);
});

test('projects without footage show a still image on their detail page, not a video', () => {
  for (const slug of ['agent-presence', 'asciify-ps']) {
    const page = read(`projects/${slug}.html`);
    assert.doesNotMatch(page, /<video/);
    assert.match(page, new RegExp(`<div class="frame detail-hero"><img src="../assets/projects/${slug}/poster\\.jpg"`));
  }
});
