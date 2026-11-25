import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const css = read('css/style.css');

test('looping detail-page clips can be paused (WCAG 2.2.2)', () => {
  for (const slug of ['relicore']) {
    const video = read(`projects/${slug}.html`).match(/<video[^>]*data-autoplay[^>]*>/)[0];
    assert.match(video, /\scontrols[\s>]/, `${slug} hero video needs controls`);
  }
});

test('detail-page screenshots all have alt text', () => {
  for (const slug of ['project-athena', 'seer', 'asciify-ps']) {
    for (const [img] of read(`projects/${slug}.html`).matchAll(/<img [^>]*>/g)) assert.match(img, /alt="[^"]+"/, img);
  }
});
