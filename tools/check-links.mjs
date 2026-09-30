// Verifies every internal href/src in the site's HTML points at a file that exists.
// Relative links resolve from the page; absolute links must live under the Pages base.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SITE_BASE = '/portfolio-zen/';
const SKIP_DIRS = new Set(['.git', 'node_modules', '_templates']);

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

function exists(target) {
  if (!existsSync(target)) return false;
  return statSync(target).isDirectory() ? existsSync(join(target, 'index.html')) : true;
}

export function checkLinks(root, base = SITE_BASE) {
  const broken = [];
  for (const file of htmlFiles(root)) {
    // commented-out markup (e.g. "how to add a note" examples) isn't a link
    const html = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const [, ref] of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      if (ref === '' || /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref)) continue;
      const path = ref.split(/[?#]/)[0];
      let target = null;
      if (path.startsWith(base)) target = join(root, path.slice(base.length));
      else if (!path.startsWith('/')) target = resolve(dirname(file), path);
      if (!target || !exists(target)) broken.push({ file: relative(root, file).replaceAll('\\', '/'), ref });
    }
  }
  return broken;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const broken = checkLinks(root);
  for (const { file, ref } of broken) console.log(`${file}: ${ref}`);
  console.log(broken.length ? `${broken.length} broken link(s)` : 'all internal links resolve');
  process.exitCode = broken.length ? 1 : 0;
}
