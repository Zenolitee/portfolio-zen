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
  const titles = [...read('projects/index.html').matchAll(/<h2 class="show-title">([^<]+)<\/h2>/g)].map(m => m[1]);
  assert.deepEqual(titles, ['Project Athena', 'Relicore', 'AgentPresence', 'asciify-ps']);
});

test('each card has a poster and names its preview; one shared pop-out window plays it', () => {
  const page = read('projects/index.html');
  const rows = page.split('<li class="show-row">').slice(1);
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.match(row, /<img class="show-poster" src="[^"]+poster\.jpg"/);
    assert.match(row, /data-url="[^"]+"/);
  }
  // only projects with real footage get a clip; the rest pop out as a still image
  const withClip = rows.filter(r => /data-preview="[^"]+preview\.mp4"/.test(r)).map(r => r.match(/href="([^"]+)\.html"/)[1]);
  assert.deepEqual(withClip, ['project-athena', 'relicore']);
  assert.equal(page.match(/class="peek"/g).length, 1);
  assert.match(page, /<video class="peek-video" muted loop playsinline preload="none"><\/video>/);
});

test('projects without footage show a still image on their detail page, not a video', () => {
  for (const slug of ['agent-presence', 'asciify-ps']) {
    const page = read(`projects/${slug}.html`);
    assert.doesNotMatch(page, /<video/);
    assert.match(page, new RegExp(`<div class="frame detail-hero"><img src="../assets/projects/${slug}/poster\\.jpg"`));
  }
});
