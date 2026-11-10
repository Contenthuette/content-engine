// Writes simple-icons SVGs for a logo wall.  node toolnews/engine/logos.mjs <outDir> <slug> [<slug> …]
// stdout: JSON {slug: "file.svg" | null}. Icons are drawn in ink (#0A0A0A); tiles are white in every look.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const si = require('simple-icons');
const [out, ...slugs] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const res = {};
for (const slug of slugs) {
  const key = 'si' + slug.charAt(0).toUpperCase() + slug.slice(1);
  const icon = si[key];
  if (!icon) { res[slug] = null; continue; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512"><path fill="#0A0A0A" d="${icon.path}"/></svg>`;
  const f = path.join(out, `logo_${slug}.svg`);
  fs.writeFileSync(f, svg);
  res[slug] = f;
}
process.stdout.write(JSON.stringify(res));
