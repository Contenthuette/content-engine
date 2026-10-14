// usage: node src/fast/tools/stills.mjs <outDir> <spec.json|-> t1 t2 ...   (times in seconds)
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'fs';
import path from 'path';
const [outDir, specPath, ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, {recursive: true});
const inputProps = specPath && specPath !== '-' ? JSON.parse(fs.readFileSync(specPath, 'utf8')) : undefined;
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
import {existsSync} from 'node:fs';
const _chrome = process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = existsSync(_chrome) ? _chrome : null;
const composition = await selectComposition({serveUrl, id: process.env.COMP || 'ReelFromSpec', inputProps, browserExecutable});
for (const t of times) {
  const frame = Math.round(parseFloat(t) * 30);
  await renderStill({composition, serveUrl, output: `${outDir}/f${String(frame).padStart(4, '0')}.png`, frame, inputProps, browserExecutable, imageFormat: 'png', scale: 0.5});
  process.stdout.write('.');
}
fs.rmSync(serveUrl, {recursive: true, force: true});  // Bundle (~1 GB) wieder löschen, sonst läuft die Platte voll
console.log('done');
